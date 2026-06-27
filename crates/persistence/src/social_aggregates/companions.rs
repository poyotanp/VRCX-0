use std::collections::{BTreeMap, BTreeSet};

use vrcx_0_core::location::parse_location;

use crate::common::{row_i64, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::realtime::normalize_user_table_prefix;
use crate::Error;

use super::caveats::companions_caveats;
use super::helpers::{
    append_time_window_filter, clamped_optional_limit, is_visible_instance_location,
    millis_to_minutes, table_exists, LatestName,
};
use super::types::{CompanionOfRow, CompanionWorldRow, CompanionsOfInput, CompanionsOfOutput};

pub fn get_companions_of(
    db: &DatabaseService,
    input: CompanionsOfInput,
) -> Result<CompanionsOfOutput, Error> {
    let user_prefix = normalize_user_table_prefix(&input.owner_user_id)?;
    let table_name = format!("{user_prefix}_feed_gps");
    if !table_exists(db, &table_name)? {
        return Ok(CompanionsOfOutput {
            rows: Vec::new(),
            caveats: companions_caveats(),
        });
    }

    let limit = clamped_optional_limit(input.limit, 25, 100);
    let mut sql = format!(
        "SELECT other.user_id,
                other.display_name,
                target.location,
                COALESCE(NULLIF(other.world_name, ''), target.world_name),
                MAX(0,
                    MIN(
                        CAST(strftime('%s', target.created_at) AS INTEGER) + (MAX(target.time, 0) / 1000),
                        CAST(strftime('%s', other.created_at) AS INTEGER) + (MAX(other.time, 0) / 1000)
                    ) - MAX(
                        CAST(strftime('%s', target.created_at) AS INTEGER),
                        CAST(strftime('%s', other.created_at) AS INTEGER)
                    )
                ) * 1000,
                CASE WHEN target.created_at > other.created_at THEN target.created_at ELSE other.created_at END,
                other.created_at
         FROM {table_name} target
         JOIN {table_name} other ON other.location = target.location
         WHERE target.user_id = @target_user_id
           AND other.user_id != @target_user_id
           AND target.location LIKE 'wrld_%'
           AND other.location LIKE 'wrld_%'
           AND target.time > 0
           AND other.time > 0
           AND CAST(strftime('%s', target.created_at) AS INTEGER)
                < CAST(strftime('%s', other.created_at) AS INTEGER) + (other.time / 1000)
           AND CAST(strftime('%s', other.created_at) AS INTEGER)
                < CAST(strftime('%s', target.created_at) AS INTEGER) + (target.time / 1000)"
    );
    let mut params = ParamsBuilder::new().set("target_user_id", input.user_id.trim());
    append_time_window_filter(
        &mut sql,
        &mut params,
        &input.time_window,
        "target.created_at",
    );
    sql.push_str(" ORDER BY 6 DESC");

    let mut grouped: BTreeMap<String, CompanionAccumulator> = BTreeMap::new();
    for row in db.execute(&sql, &params.build())? {
        let user_id = row_string(&row, 0);
        if user_id.is_empty() {
            continue;
        }
        let display_name = row_string(&row, 1);
        let location = row_string(&row, 2);
        if !is_visible_instance_location(&location) {
            continue;
        }
        let parsed = parse_location(&location);
        let world_name = row_string(&row, 3);
        let overlap_millis = row_i64(&row, 4).max(0);
        let seen_at = row_string(&row, 5);
        let other_created_at = row_string(&row, 6);
        let entry = grouped
            .entry(user_id.clone())
            .or_insert_with(|| CompanionAccumulator {
                user_id,
                ..CompanionAccumulator::default()
            });
        entry.latest_name.observe(&display_name, &other_created_at);
        entry.overlap_millis += overlap_millis;
        entry.overlap_events += 1;
        if seen_at > entry.last_seen_together {
            entry.last_seen_together = seen_at;
        }
        entry.shared_instances.insert(location.clone());
        entry.worlds.insert(CompanionWorldRow {
            location,
            world_id: parsed.world_id,
            world_name,
        });
    }

    let mut rows = grouped
        .into_values()
        .map(|entry| CompanionOfRow {
            user_id: entry.user_id,
            display_name: entry.latest_name.into_name(),
            overlap_minutes: millis_to_minutes(entry.overlap_millis),
            overlap_events: entry.overlap_events,
            shared_instances: entry.shared_instances.len(),
            last_seen_together: entry.last_seen_together,
            worlds: entry.worlds.into_iter().collect(),
        })
        .collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        right
            .overlap_minutes
            .cmp(&left.overlap_minutes)
            .then_with(|| right.overlap_events.cmp(&left.overlap_events))
            .then_with(|| left.display_name.cmp(&right.display_name))
            .then_with(|| left.user_id.cmp(&right.user_id))
    });
    rows.truncate(limit as usize);

    Ok(CompanionsOfOutput {
        rows,
        caveats: companions_caveats(),
    })
}

#[derive(Clone, Debug, Default)]
struct CompanionAccumulator {
    user_id: String,
    latest_name: LatestName,
    overlap_millis: i64,
    overlap_events: i64,
    shared_instances: BTreeSet<String>,
    last_seen_together: String,
    worlds: BTreeSet<CompanionWorldRow>,
}
