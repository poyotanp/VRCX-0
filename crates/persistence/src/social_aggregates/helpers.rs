use std::collections::BTreeMap;

use vrcx_0_core::location::parse_location;

use crate::common::ParamsBuilder;
use crate::database::DatabaseService;
use crate::Error;

use super::types::{ActivityBucket, TimeWindow};

pub(crate) fn append_time_window_filter(
    sql: &mut String,
    params: &mut ParamsBuilder,
    time_window: &TimeWindow,
    column: &str,
) {
    if let Some(from) = time_window
        .from
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sql.push_str(&format!(" AND {column} >= @from"));
        *params = std::mem::take(params).set("from", from);
    }
    if let Some(to) = time_window
        .to
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sql.push_str(&format!(" AND {column} <= @to"));
        *params = std::mem::take(params).set("to", to);
    }
}

pub(crate) fn table_exists(db: &DatabaseService, table_name: &str) -> Result<bool, Error> {
    Ok(!db
        .execute(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = @name LIMIT 1",
            &ParamsBuilder::new().set("name", table_name).build(),
        )?
        .is_empty())
}

pub(crate) fn is_visible_instance_location(location: &str) -> bool {
    let parsed = parse_location(location);
    parsed.is_real_instance && !parsed.world_id.is_empty()
}

pub fn normalize_access_bucket(access_type: &str) -> String {
    match access_type {
        "" => "unknown".into(),
        "invite+" => "invitePlus".into(),
        "friends+" => "friendsPlus".into(),
        other => other.to_string(),
    }
}

pub(crate) fn millis_to_minutes(millis: i64) -> i64 {
    millis / 60_000
}

pub(crate) fn clamped_optional_limit(limit: Option<i64>, default: i64, max: i64) -> i64 {
    limit.unwrap_or(default).clamp(1, max)
}

pub(crate) fn date_part(value: &str) -> String {
    value.chars().take(10).collect()
}

pub(crate) fn typical_online_window(
    buckets: &BTreeMap<String, i64>,
    bucket: &ActivityBucket,
) -> String {
    let Some((key, _)) = buckets
        .iter()
        .max_by(|left, right| left.1.cmp(right.1).then_with(|| right.0.cmp(left.0)))
    else {
        return String::new();
    };
    bucket_label(bucket, key)
}

pub(crate) fn bucket_label(bucket: &ActivityBucket, key: &str) -> String {
    match bucket {
        ActivityBucket::HourOfDay => {
            let hour = key.parse::<u8>().unwrap_or(0).min(23);
            format!("{hour:02}:00-{next:02}:00", next = (hour + 1) % 24)
        }
        ActivityBucket::DayOfWeek => weekday_name(key).to_string(),
    }
}

#[derive(Clone, Debug, Default)]
pub(crate) struct LatestName {
    name: String,
    at: String,
}

impl LatestName {
    pub(crate) fn observe(&mut self, name: &str, created_at: &str) {
        if self.name.is_empty() || created_at > self.at.as_str() {
            self.name = name.to_string();
            self.at = created_at.to_string();
        }
    }

    pub(crate) fn into_name(self) -> String {
        self.name
    }
}

fn weekday_name(key: &str) -> &'static str {
    match key {
        "0" => "Sunday",
        "1" => "Monday",
        "2" => "Tuesday",
        "3" => "Wednesday",
        "4" => "Thursday",
        "5" => "Friday",
        "6" => "Saturday",
        _ => "",
    }
}
