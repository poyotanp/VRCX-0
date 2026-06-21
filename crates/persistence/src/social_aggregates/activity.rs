use std::collections::BTreeMap;

use crate::common::{row_i64, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::realtime::normalize_user_table_prefix;
use crate::Error;

use super::caveats::friend_activity_caveats;
use super::helpers::{append_time_window_filter, table_exists, typical_online_window};
use super::types::{
    ActivityBucket, FriendActivityPatternInput, FriendActivityPatternOutput,
    FriendActivityPatternRow,
};

pub fn get_friend_activity_pattern(
    db: &DatabaseService,
    input: FriendActivityPatternInput,
) -> Result<FriendActivityPatternOutput, Error> {
    let user_prefix = normalize_user_table_prefix(&input.owner_user_id)?;
    let table_name = format!("{user_prefix}_feed_online_offline");
    if !table_exists(db, &table_name)? {
        return Ok(FriendActivityPatternOutput {
            rows: Vec::new(),
            caveats: friend_activity_caveats(),
        });
    }

    let bucket_expr = match input.bucket {
        ActivityBucket::HourOfDay => "strftime('%H', created_at)",
        ActivityBucket::DayOfWeek => "strftime('%w', created_at)",
    };
    let mut sql = format!(
        "SELECT user_id, display_name, {bucket_expr} AS bucket, COUNT(*)
         FROM {table_name}
         WHERE type = 'Online'"
    );
    let mut params = ParamsBuilder::new();
    append_time_window_filter(&mut sql, &mut params, &input.time_window, "created_at");
    if let Some(user_id) = input
        .user_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sql.push_str(" AND user_id = @user_id");
        params = std::mem::take(&mut params).set("user_id", user_id);
    }
    sql.push_str(" GROUP BY user_id, display_name, bucket ORDER BY user_id ASC, bucket ASC");

    let mut grouped: BTreeMap<String, FriendActivityAccumulator> = BTreeMap::new();
    for row in db.execute(&sql, &params.build())? {
        let user_id = row_string(&row, 0);
        if user_id.is_empty() {
            continue;
        }
        let display_name = row_string(&row, 1);
        let bucket = row_string(&row, 2);
        let count = row_i64(&row, 3);
        let entry = grouped
            .entry(user_id.clone())
            .or_insert_with(|| FriendActivityAccumulator {
                user_id,
                display_name,
                buckets: BTreeMap::new(),
            });
        entry.buckets.insert(bucket, count);
    }

    Ok(FriendActivityPatternOutput {
        rows: grouped
            .into_values()
            .map(|entry| FriendActivityPatternRow {
                typical_online_window: typical_online_window(&entry.buckets, &input.bucket),
                user_id: entry.user_id,
                display_name: entry.display_name,
                buckets: entry.buckets,
            })
            .collect(),
        caveats: friend_activity_caveats(),
    })
}

#[derive(Clone, Debug)]
struct FriendActivityAccumulator {
    user_id: String,
    display_name: String,
    buckets: BTreeMap<String, i64>,
}
