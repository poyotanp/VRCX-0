use std::collections::HashSet;

use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::CallToolResult;
use rmcp::{schemars, tool, tool_router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use vrcx_0_application::vrchat_api::{self, favorites::favorite_add_input, VrchatScope};
use vrcx_0_core::location::parse_location;
use vrcx_0_persistence::social_aggregates;

use crate::config::MCP_ALLOW_VRCHAT_WRITES_CONFIG_KEY;
use crate::runtime::McpRuntime;
use crate::server::VrcxMcpServer;

impl VrcxMcpServer {
    pub(crate) fn new(runtime: McpRuntime) -> Self {
        Self {
            runtime,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl VrcxMcpServer {
    #[tool(description = "Return observed co-presence summary facts for friends in a time window.")]
    async fn get_copresence_summary(
        &self,
        Parameters(input): Parameters<CopresenceSummaryParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = self.runtime.current_user_id().unwrap_or_default();
        social_aggregates_result(social_aggregates::get_copresence_summary(
            self.runtime.db.as_ref(),
            social_aggregates::CopresenceSummaryInput {
                time_window: input.time_window.into(),
                group_by: input.group_by.into(),
                min_minutes: input.min_minutes,
                owner_user_id: Some(owner_user_id),
                friends_only: input.friends_only,
            },
        ))
    }

    #[tool(description = "Return observed friend online activity buckets by hour or weekday.")]
    async fn get_friend_activity_pattern(
        &self,
        Parameters(input): Parameters<FriendActivityPatternParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = require_current_user_id(&self.runtime)?;
        social_aggregates_result(social_aggregates::get_friend_activity_pattern(
            self.runtime.db.as_ref(),
            social_aggregates::FriendActivityPatternInput {
                owner_user_id,
                user_id: input.user_id,
                time_window: input.time_window.into(),
                bucket: input.bucket.into(),
            },
        ))
    }

    #[tool(description = "Search recently visited worlds from the local game log.")]
    async fn search_worlds_visited(
        &self,
        Parameters(input): Parameters<SearchWorldsVisitedParams>,
    ) -> Result<CallToolResult, String> {
        social_aggregates_result(social_aggregates::search_worlds_visited(
            self.runtime.db.as_ref(),
            social_aggregates::SearchWorldsVisitedInput {
                time_window: input.time_window.into(),
                limit: input.limit.unwrap_or(25),
            },
        ))
    }

    #[tool(description = "Return current realtime friend presence from VRCX-0 memory.")]
    async fn get_online_friends(
        &self,
        Parameters(input): Parameters<OnlineFriendsParams>,
    ) -> Result<CallToolResult, String> {
        structured_result(self.get_online_friends_output(input))
    }

    #[tool(description = "Write a world favorite into VRCX-0 local favorites only.")]
    async fn favorite_world_local(
        &self,
        Parameters(input): Parameters<FavoriteWorldLocalParams>,
    ) -> Result<CallToolResult, String> {
        social_aggregates_result(social_aggregates::favorite_world_local(
            self.runtime.db.as_ref(),
            social_aggregates::FavoriteWorldLocalInput {
                world_id: input.world_id,
                group: input.group,
                dry_run: input.dry_run.unwrap_or(true),
            },
        ))
    }

    #[tool(
        description = "Add a world favorite to the signed-in VRChat account; dry_run defaults to true."
    )]
    async fn favorite_world_vrchat(
        &self,
        Parameters(input): Parameters<FavoriteWorldVrchatParams>,
    ) -> Result<CallToolResult, String> {
        structured_result(self.favorite_world_vrchat_output(input).await?)
    }

    #[tool(description = "Return mutual-friend graph edges and connection degrees.")]
    async fn get_social_graph(
        &self,
        Parameters(input): Parameters<SocialGraphParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = require_current_user_id(&self.runtime)?;
        social_aggregates_result(social_aggregates::get_social_graph(
            self.runtime.db.as_ref(),
            social_aggregates::SocialGraphInput {
                owner_user_id,
                user_id: input.user_id,
                depth: input.depth.unwrap_or(1),
            },
        ))
    }

    #[tool(description = "Infer visible companions of a friend from feed_gps overlap.")]
    async fn get_companions_of(
        &self,
        Parameters(input): Parameters<CompanionsOfParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = require_current_user_id(&self.runtime)?;
        social_aggregates_result(social_aggregates::get_companions_of(
            self.runtime.db.as_ref(),
            social_aggregates::CompanionsOfInput {
                owner_user_id,
                user_id: input.user_id,
                time_window: input.time_window.into(),
                limit: input.limit,
            },
        ))
    }

    #[tool(description = "Return invite and request-invite notification aggregates.")]
    async fn get_invite_history(
        &self,
        Parameters(input): Parameters<InviteHistoryParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = require_current_user_id(&self.runtime)?;
        social_aggregates_result(social_aggregates::get_invite_history(
            self.runtime.db.as_ref(),
            social_aggregates::InviteHistoryInput {
                owner_user_id,
                time_window: input.time_window.into(),
                direction: input.direction.into(),
                limit: input.limit,
            },
        ))
    }

    #[tool(description = "Return observed friend status, avatar, or bio change aggregates.")]
    async fn get_friend_changes(
        &self,
        Parameters(input): Parameters<FriendChangesParams>,
    ) -> Result<CallToolResult, String> {
        let owner_user_id = require_current_user_id(&self.runtime)?;
        social_aggregates_result(social_aggregates::get_friend_changes(
            self.runtime.db.as_ref(),
            social_aggregates::FriendChangesInput {
                owner_user_id,
                time_window: input.time_window.into(),
                kind: input.kind.into(),
                limit: input.limit,
            },
        ))
    }
}

impl VrcxMcpServer {
    fn get_online_friends_output(&self, input: OnlineFriendsParams) -> OnlineFriendsOutput {
        let states = input
            .states
            .unwrap_or_else(|| vec!["online".to_string(), "active".to_string()]);
        let normalized_states = states
            .iter()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .collect::<HashSet<_>>();
        let include_location = input.include_location.unwrap_or(true);

        let mut rows = self
            .runtime
            .realtime_runtime
            .friend_snapshot()
            .into_iter()
            .flat_map(|snapshot| snapshot.friends_by_id.into_values())
            .filter(|friend| normalized_states.contains(&friend.state_bucket))
            .map(|friend| {
                let parsed = parse_location(&friend.location);
                let display_name = friend.display_name_or_id();
                let world_name = friend
                    .extra
                    .get("worldName")
                    .or_else(|| friend.extra.get("world_name"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                OnlineFriendRow {
                    user_id: friend.id,
                    display_name,
                    state: friend.state_bucket,
                    location: include_location.then_some(friend.location),
                    world_id: include_location.then_some(parsed.world_id),
                    world_name: include_location.then_some(world_name),
                    instance_access_type: include_location.then_some(
                        social_aggregates::normalize_access_bucket(&parsed.access_type),
                    ),
                    status: friend.status,
                    platform: if friend.platform.is_empty() {
                        friend.last_platform
                    } else {
                        friend.platform
                    },
                }
            })
            .collect::<Vec<_>>();
        rows.sort_by(|left, right| {
            left.display_name
                .cmp(&right.display_name)
                .then_with(|| left.user_id.cmp(&right.user_id))
        });

        OnlineFriendsOutput {
            rows,
            caveats: vec![
                "Realtime friend presence is maintained from the active VRChat websocket session."
                    .into(),
                "Location visibility still follows VRChat privacy rules; private instances may be redacted."
                    .into(),
            ],
        }
    }

    async fn favorite_world_vrchat_output(
        &self,
        input: FavoriteWorldVrchatParams,
    ) -> Result<FavoriteWorldVrchatOutput, String> {
        let world_id = input.world_id.trim().to_string();
        let tags = input.tags.trim().to_string();
        if world_id.is_empty() {
            return Err("favorite_world_vrchat requires world_id".into());
        }
        if !world_id.starts_with("wrld_") {
            return Err(
                "favorite_world_vrchat world_id must be a VRChat world id (wrld_...)".into(),
            );
        }
        if tags.is_empty() {
            return Err("favorite_world_vrchat requires tags such as worlds1".into());
        }
        let requested_write = !input.dry_run.unwrap_or(true);
        let writes_allowed = self
            .runtime
            .config
            .get_bool(MCP_ALLOW_VRCHAT_WRITES_CONFIG_KEY, false)
            .unwrap_or(false);
        if !requested_write || !writes_allowed {
            return Ok(FavoriteWorldVrchatOutput {
                world_id,
                tags,
                dry_run: true,
                status: None,
                response: None,
                caveats: vrchat_favorite_caveats(requested_write && !writes_allowed),
            });
        }

        let endpoint = self.runtime.current_endpoint();
        let (_, _, request) =
            favorite_add_input(endpoint, "world".into(), world_id.clone(), tags.clone())
                .map_err(|error| error.to_string())?;
        let response = vrchat_api::execute_api_command(
            self.runtime.web.as_ref(),
            self.runtime.db.as_ref(),
            &self.runtime.diagnostics,
            &self.runtime.sync,
            "mcp__favorite_world_vrchat",
            request,
            VrchatScope::Vrchat,
        )
        .await
        .map_err(|error| error.to_string())?;
        Ok(FavoriteWorldVrchatOutput {
            world_id,
            tags,
            dry_run: false,
            status: Some(response.status),
            response: Some(response.raw),
            caveats: vrchat_favorite_caveats(false),
        })
    }
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct TimeWindowParams {
    from: Option<String>,
    to: Option<String>,
}

impl From<TimeWindowParams> for social_aggregates::TimeWindow {
    fn from(value: TimeWindowParams) -> Self {
        Self {
            from: value.from,
            to: value.to,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
enum CopresenceGroupByParam {
    #[default]
    Friend,
    FriendWorld,
}

impl From<CopresenceGroupByParam> for social_aggregates::CopresenceGroupBy {
    fn from(value: CopresenceGroupByParam) -> Self {
        match value {
            CopresenceGroupByParam::Friend => Self::Friend,
            CopresenceGroupByParam::FriendWorld => Self::FriendWorld,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
enum ActivityBucketParam {
    #[default]
    HourOfDay,
    DayOfWeek,
}

impl From<ActivityBucketParam> for social_aggregates::ActivityBucket {
    fn from(value: ActivityBucketParam) -> Self {
        match value {
            ActivityBucketParam::HourOfDay => Self::HourOfDay,
            ActivityBucketParam::DayOfWeek => Self::DayOfWeek,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
enum InviteDirectionParam {
    Received,
    Sent,
    #[default]
    Both,
}

impl From<InviteDirectionParam> for social_aggregates::InviteDirection {
    fn from(value: InviteDirectionParam) -> Self {
        match value {
            InviteDirectionParam::Received => Self::Received,
            InviteDirectionParam::Sent => Self::Sent,
            InviteDirectionParam::Both => Self::Both,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
enum FriendChangeKindParam {
    #[default]
    Status,
    Avatar,
    Bio,
}

impl From<FriendChangeKindParam> for social_aggregates::FriendChangeKind {
    fn from(value: FriendChangeKindParam) -> Self {
        match value {
            FriendChangeKindParam::Status => Self::Status,
            FriendChangeKindParam::Avatar => Self::Avatar,
            FriendChangeKindParam::Bio => Self::Bio,
        }
    }
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct CopresenceSummaryParams {
    time_window: TimeWindowParams,
    #[serde(default)]
    group_by: CopresenceGroupByParam,
    min_minutes: Option<i64>,
    #[serde(default)]
    friends_only: bool,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct FriendActivityPatternParams {
    user_id: Option<String>,
    time_window: TimeWindowParams,
    #[serde(default)]
    bucket: ActivityBucketParam,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SearchWorldsVisitedParams {
    time_window: TimeWindowParams,
    limit: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct OnlineFriendsParams {
    states: Option<Vec<String>>,
    include_location: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct FavoriteWorldLocalParams {
    world_id: String,
    group: String,
    dry_run: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct FavoriteWorldVrchatParams {
    world_id: String,
    tags: String,
    dry_run: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SocialGraphParams {
    user_id: Option<String>,
    depth: Option<u8>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct CompanionsOfParams {
    user_id: String,
    time_window: TimeWindowParams,
    limit: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct InviteHistoryParams {
    time_window: TimeWindowParams,
    #[serde(default)]
    direction: InviteDirectionParam,
    limit: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
struct FriendChangesParams {
    time_window: TimeWindowParams,
    #[serde(default)]
    kind: FriendChangeKindParam,
    limit: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OnlineFriendsOutput {
    rows: Vec<OnlineFriendRow>,
    caveats: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OnlineFriendRow {
    user_id: String,
    display_name: String,
    state: String,
    location: Option<String>,
    world_id: Option<String>,
    world_name: Option<String>,
    instance_access_type: Option<String>,
    status: String,
    platform: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FavoriteWorldVrchatOutput {
    world_id: String,
    tags: String,
    dry_run: bool,
    status: Option<i32>,
    response: Option<Value>,
    caveats: Vec<String>,
}

fn structured_result(value: impl Serialize) -> Result<CallToolResult, String> {
    serde_json::to_value(value)
        .map(CallToolResult::structured)
        .map_err(|error| format!("serialize MCP tool result: {error}"))
}

fn social_aggregates_result<T: Serialize>(
    result: Result<T, vrcx_0_persistence::Error>,
) -> Result<CallToolResult, String> {
    match result {
        Ok(value) => structured_result(value),
        Err(vrcx_0_persistence::Error::InvalidData(message)) => Err(message),
        Err(error) => {
            tracing::warn!("MCP social query failed: {error}");
            Err("internal data error while reading local VRCX-0 data".into())
        }
    }
}

fn require_current_user_id(runtime: &McpRuntime) -> Result<String, String> {
    runtime
        .current_user_id()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "This tool requires an active realtime VRChat session (current user unknown).".into()
        })
}

fn vrchat_favorite_caveats(blocked_by_setting: bool) -> Vec<String> {
    let mut caveats = vec![
        "This writes to the signed-in VRChat account only when dry_run is false.".into(),
        "VRChat favorite groups have capacity limits and API failures are returned as-is.".into(),
    ];
    if blocked_by_setting {
        caveats.push(
            "A real write was requested but VRChat writes are disabled; enable them in VRCX-0 settings first."
                .into(),
        );
    }
    caveats
}
