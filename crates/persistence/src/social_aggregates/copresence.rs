use std::collections::{BTreeMap, HashSet};

use vrcx_0_core::location::parse_location;

use crate::common::{row_i64, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::realtime::normalize_user_table_prefix;
use crate::Error;

use super::caveats::copresence_caveats;
use super::helpers::{
    append_time_window_filter, date_part, millis_to_minutes, normalize_access_bucket, table_exists,
};
use super::types::{
    CopresenceGroupBy, CopresenceSummaryInput, CopresenceSummaryOutput, CopresenceSummaryRow,
};

pub fn get_copresence_summary(
    db: &DatabaseService,
    input: CopresenceSummaryInput,
) -> Result<CopresenceSummaryOutput, Error> {
    let mut sql = String::from(
        "SELECT user_id, display_name, location, time, created_at
         FROM gamelog_join_leave g
         WHERE type = 'OnPlayerLeft' AND time > 0",
    );
    let mut params = ParamsBuilder::new();
    append_time_window_filter(&mut sql, &mut params, &input.time_window, "created_at");

    if input.friends_only {
        if let Some(owner_user_id) = input
            .owner_user_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let user_prefix = normalize_user_table_prefix(owner_user_id)?;
            let table_name = format!("{user_prefix}_friend_log_current");
            if table_exists(db, &table_name)? {
                sql.push_str(&format!(
                    " AND EXISTS (SELECT 1 FROM {table_name} f WHERE f.user_id = g.user_id)"
                ));
            } else {
                return Ok(CopresenceSummaryOutput {
                    rows: Vec::new(),
                    caveats: copresence_caveats(),
                });
            }
        }
    }
    sql.push_str(" ORDER BY created_at ASC, id ASC");

    let mut grouped: BTreeMap<CopresenceKey, CopresenceAccumulator> = BTreeMap::new();
    for row in db.execute(&sql, &params.build())? {
        let user_id = row_string(&row, 0);
        let display_name = row_string(&row, 1);
        let location = row_string(&row, 2);
        let millis = row_i64(&row, 3).max(0);
        let created_at = row_string(&row, 4);
        if user_id.trim().is_empty() && display_name.trim().is_empty() {
            continue;
        }
        let parsed = parse_location(&location);
        let (world_id, world_name) = match input.group_by {
            CopresenceGroupBy::Friend => (None, None),
            CopresenceGroupBy::FriendWorld => {
                let world_id = (!parsed.world_id.is_empty()).then_some(parsed.world_id.clone());
                (world_id, None)
            }
        };
        let key = CopresenceKey {
            user_id: user_id.clone(),
            display_name: display_name.clone(),
            world_id,
            world_name,
        };
        let access = normalize_access_bucket(&parsed.access_type);
        let entry = grouped.entry(key).or_default();
        entry.total_millis += millis;
        if !created_at.is_empty() {
            entry.days.insert(date_part(&created_at));
            if created_at > entry.last_seen_together {
                entry.last_seen_together = created_at;
            }
        }
        if !location.is_empty() {
            entry.instances.insert(location);
        }
        if millis > 0 {
            *entry.minutes_by_access.entry(access).or_insert(0) += millis;
        }
    }

    let min_minutes = input.min_minutes.unwrap_or(0).max(0);
    let mut rows = grouped
        .into_iter()
        .filter_map(|(key, value)| {
            let total_minutes = millis_to_minutes(value.total_millis);
            (total_minutes >= min_minutes).then_some(CopresenceSummaryRow {
                user_id: key.user_id,
                display_name: key.display_name,
                world_id: key.world_id,
                world_name: key.world_name,
                total_minutes,
                co_days: value.days.len(),
                instances: value.instances.len(),
                last_seen_together: value.last_seen_together,
                minutes_by_access: value
                    .minutes_by_access
                    .into_iter()
                    .map(|(access, millis)| (access, millis_to_minutes(millis)))
                    .collect(),
            })
        })
        .collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        right
            .total_minutes
            .cmp(&left.total_minutes)
            .then_with(|| left.display_name.cmp(&right.display_name))
            .then_with(|| left.user_id.cmp(&right.user_id))
    });

    Ok(CopresenceSummaryOutput {
        rows,
        caveats: copresence_caveats(),
    })
}

#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
struct CopresenceKey {
    user_id: String,
    display_name: String,
    world_id: Option<String>,
    world_name: Option<String>,
}

#[derive(Clone, Debug, Default)]
struct CopresenceAccumulator {
    total_millis: i64,
    days: HashSet<String>,
    instances: HashSet<String>,
    last_seen_together: String,
    minutes_by_access: BTreeMap<String, i64>,
}
