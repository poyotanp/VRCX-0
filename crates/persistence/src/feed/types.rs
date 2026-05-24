use serde::{Deserialize, Serialize};
use vrcx_0_core::json::RawJson;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedCursorInput {
    pub created_at: String,
    pub source_rank: i64,
    pub row_id: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedRowsQueryInput {
    pub user_id: String,
    pub mode: String,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub filters: Vec<String>,
    #[serde(default)]
    pub vip_list: Vec<String>,
    #[serde(default)]
    pub excluded_user_ids: Vec<String>,
    pub max_entries: i64,
    #[serde(default)]
    pub date_from: String,
    #[serde(default)]
    pub date_to: String,
    #[serde(default)]
    pub cursor: Option<FeedCursorInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedLiveEntryInput {
    pub sequence: i64,
    #[serde(default)]
    pub entry: RawJson,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedReadModelQueryInput {
    pub user_id: String,
    pub mode: String,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub filters: Vec<String>,
    #[serde(default)]
    pub vip_list: Vec<String>,
    #[serde(default)]
    pub max_entries: i64,
    #[serde(default)]
    pub date_from: String,
    #[serde(default)]
    pub date_to: String,
    #[serde(default)]
    pub cursor: Option<FeedCursorInput>,
    #[serde(default)]
    pub live_entries: Vec<FeedLiveEntryInput>,
    #[serde(default)]
    pub min_live_sequence: i64,
    #[serde(default)]
    pub favorites_only: bool,
    #[serde(default)]
    pub favorite_user_ids: Vec<String>,
    #[serde(default)]
    pub excluded_user_ids: Vec<String>,
    #[serde(default)]
    pub max_rows: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedLiveRowsMergeInput {
    #[serde(default)]
    pub rows: Vec<RawJson>,
    #[serde(default)]
    pub current_user_id: String,
    #[serde(default)]
    pub filters: Vec<String>,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub date_from: String,
    #[serde(default)]
    pub date_to: String,
    #[serde(default)]
    pub favorites_only: bool,
    #[serde(default)]
    pub favorite_user_ids: Vec<String>,
    #[serde(default)]
    pub excluded_user_ids: Vec<String>,
    #[serde(default)]
    pub live_entries: Vec<FeedLiveEntryInput>,
    #[serde(default)]
    pub min_live_sequence: i64,
    #[serde(default)]
    pub max_rows: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedReadModelOutput {
    pub rows: Vec<RawJson>,
    pub max_sequence: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedRowOutput {
    #[serde(rename = "rowId")]
    pub row_id: RawJson,
    #[serde(rename = "sourceRank")]
    pub source_rank: RawJson,
    #[serde(rename = "created_at")]
    pub created_at: RawJson,
    pub user_id: RawJson,
    pub display_name: RawJson,
    pub r#type: RawJson,
    pub location: RawJson,
    pub world_name: RawJson,
    pub previous_location: RawJson,
    pub time: RawJson,
    pub group_name: RawJson,
    pub status: RawJson,
    pub status_description: RawJson,
    pub previous_status: RawJson,
    pub previous_status_description: RawJson,
    pub bio: RawJson,
    pub previous_bio: RawJson,
    pub owner_id: RawJson,
    pub avatar_name: RawJson,
    pub current_avatar_image_url: RawJson,
    pub current_avatar_thumbnail_image_url: RawJson,
    pub previous_current_avatar_image_url: RawJson,
    pub previous_current_avatar_thumbnail_image_url: RawJson,
}
