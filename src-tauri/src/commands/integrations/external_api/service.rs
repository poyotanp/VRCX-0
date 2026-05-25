#![allow(non_snake_case)]

use std::collections::HashMap;

use reqwest::Url;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_integrations::external_api::{
    self, ExternalApiExecuteResponse, ExternalApiPolicy, ExternalApiScope, ExternalHttpRequestInput,
};

use super::types::{
    ExternalApiAvatarSearchInput, ExternalApiImageInput, ExternalApiTranslationInput,
    ExternalApiUrlInput, ExternalApiVrcStatusInput, ExternalApiYoutubeVideoInput,
};

fn normalize_text(value: impl AsRef<str>) -> String {
    value.as_ref().trim().to_string()
}

fn require_text(value: impl AsRef<str>, message: &str) -> Result<String, AppError> {
    let value = normalize_text(value);
    if value.is_empty() {
        return Err(AppError::Custom(message.into()));
    }
    Ok(value)
}

fn external_get_input(url: String, headers: HashMap<String, String>) -> ExternalHttpRequestInput {
    ExternalHttpRequestInput {
        url: Some(url),
        method: Some("GET".into()),
        headers: Some(headers),
        ..Default::default()
    }
}

fn normalize_translation_method(value: impl AsRef<str>) -> Result<String, AppError> {
    let method = normalize_text(value).to_ascii_uppercase();
    let method = if method.is_empty() {
        "GET".to_string()
    } else {
        method
    };
    match method.as_str() {
        "GET" | "POST" => Ok(method),
        _ => Err(AppError::Custom(
            "ExternalApiTranslationRequest supports only GET or POST.".into(),
        )),
    }
}

fn avatar_search_input(
    input: ExternalApiAvatarSearchInput,
) -> Result<ExternalHttpRequestInput, AppError> {
    let url = require_text(input.url, "ExternalApiAvatarSearchGet requires url.")?;
    let vrcx_id = require_text(input.vrcx_id, "ExternalApiAvatarSearchGet requires vrcxId.")?;
    Ok(external_get_input(
        url,
        HashMap::from([
            ("Referer".to_string(), "https://vrcx.app".to_string()),
            ("VRCX-ID".to_string(), vrcx_id),
        ]),
    ))
}

fn translation_input(
    input: ExternalApiTranslationInput,
) -> Result<ExternalHttpRequestInput, AppError> {
    let url = require_text(input.url, "ExternalApiTranslationRequest requires url.")?;
    let method = normalize_translation_method(input.method)?;
    Ok(ExternalHttpRequestInput {
        url: Some(url),
        method: Some(method),
        headers: Some(input.headers),
        body: (!input.body.is_null()).then_some(input.body),
        json_body: Some(false),
        ..Default::default()
    })
}

fn youtube_video_input(
    input: ExternalApiYoutubeVideoInput,
) -> Result<ExternalHttpRequestInput, AppError> {
    let video_id = require_text(
        input.video_id,
        "ExternalApiYoutubeVideoMetadataGet requires videoId.",
    )?;
    let api_key = require_text(
        input.api_key,
        "ExternalApiYoutubeVideoMetadataGet requires apiKey.",
    )?;
    let mut url = Url::parse("https://www.googleapis.com/youtube/v3/videos")
        .map_err(|error| AppError::Custom(format!("bad YouTube API URL: {error}")))?;
    url.query_pairs_mut()
        .append_pair("id", &video_id)
        .append_pair("part", "snippet,contentDetails")
        .append_pair("key", &api_key);
    Ok(external_get_input(url.to_string(), HashMap::new()))
}

fn vrc_status_input(
    input: ExternalApiVrcStatusInput,
) -> Result<ExternalHttpRequestInput, AppError> {
    let path = require_text(input.path, "ExternalApiVrcStatusJsonGet requires path.")?;
    Ok(external_get_input(
        format!(
            "https://status.vrchat.com/api/v2/{}",
            path.trim_start_matches('/')
        ),
        HashMap::from([("Referer".to_string(), "https://vrcx.app".to_string())]),
    ))
}

fn github_releases_input(input: ExternalApiUrlInput) -> Result<ExternalHttpRequestInput, AppError> {
    let url = require_text(input.url, "ExternalApiGithubReleasesGet requires url.")?;
    Ok(external_get_input(url, input.headers))
}

fn image_data_url_input(
    input: ExternalApiImageInput,
) -> Result<ExternalHttpRequestInput, AppError> {
    let url = require_text(input.url, "ExternalApiImageDataUrlGet requires url.")?;
    Ok(external_get_input(url, HashMap::new()))
}

fn external_api_policy(_state: &AppState, _scope: ExternalApiScope) -> ExternalApiPolicy {
    ExternalApiPolicy
}

macro_rules! external_command {
    ($name:ident, $input_ty:ty, $builder:ident, $scope:expr, $detail:expr) => {
        #[tauri::command]
        pub async fn $name(
            state: State<'_, AppState>,
            input: $input_ty,
        ) -> Result<ExternalApiExecuteResponse, AppError> {
            let diagnostics = state.runtime_context.diagnostics.clone();
            let sync = state.runtime_context.sync.clone();
            diagnostics.record_command(stringify!($name), "running", $detail);
            let request = match $builder(input) {
                Ok(request) => request,
                Err(error) => {
                    diagnostics.record_command(stringify!($name), "error", error.to_string());
                    sync.record_failure("external-api", error.to_string());
                    return Err(error);
                }
            };
            let result = execute_external_api(state, request, $scope).await;
            match &result {
                Ok(response) => {
                    diagnostics.record_command(
                        stringify!($name),
                        "ok",
                        format!("status={}", response.status),
                    );
                    sync.record(
                        "external-api",
                        "ready",
                        format!(
                            "{} completed with status {}.",
                            stringify!($name),
                            response.status
                        ),
                        0,
                    );
                }
                Err(error) => {
                    diagnostics.record_command(stringify!($name), "error", error.to_string());
                    sync.record_failure("external-api", error.to_string());
                }
            }
            result
        }
    };
}

async fn execute_external_api(
    state: State<'_, AppState>,
    input: ExternalHttpRequestInput,
    scope: ExternalApiScope,
) -> Result<ExternalApiExecuteResponse, AppError> {
    let policy = external_api_policy(&state, scope);
    let request = external_api::build_web_execute_request_with_policy(input, scope, &policy)?;
    let (status, data) = state.web.execute_external(request).await?;
    if status == -1 {
        return Err(AppError::Custom(data));
    }
    Ok(external_api::execute_response(status, data, scope))
}

external_command!(
    app__external_api_avatar_search_get,
    ExternalApiAvatarSearchInput,
    avatar_search_input,
    ExternalApiScope::AvatarSearch,
    "Searching external avatar provider."
);

external_command!(
    app__external_api_translation_request,
    ExternalApiTranslationInput,
    translation_input,
    ExternalApiScope::Translation,
    "Dispatching external translation request."
);

external_command!(
    app__external_api_youtube_video_metadata_get,
    ExternalApiYoutubeVideoInput,
    youtube_video_input,
    ExternalApiScope::Youtube,
    "Getting YouTube video metadata."
);

external_command!(
    app__external_api_vrc_status_json_get,
    ExternalApiVrcStatusInput,
    vrc_status_input,
    ExternalApiScope::VrcStatus,
    "Getting VRChat status JSON."
);

external_command!(
    app__external_api_github_releases_get,
    ExternalApiUrlInput,
    github_releases_input,
    ExternalApiScope::UpdateRelease,
    "Getting external update release metadata."
);

external_command!(
    app__external_api_image_data_url_get,
    ExternalApiImageInput,
    image_data_url_input,
    ExternalApiScope::Image,
    "Getting external image data."
);

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn avatar_search_contract_sets_expected_headers() {
        let input = avatar_search_input(ExternalApiAvatarSearchInput {
            url: "https://avatars.example.test/search?q=robot".into(),
            vrcx_id: "abc".into(),
        })
        .unwrap();

        assert_eq!(
            input.url.as_deref(),
            Some("https://avatars.example.test/search?q=robot")
        );
        assert_eq!(input.method.as_deref(), Some("GET"));
        let headers = input.headers.unwrap();
        assert_eq!(
            headers.get("Referer").map(String::as_str),
            Some("https://vrcx.app")
        );
        assert_eq!(headers.get("VRCX-ID").map(String::as_str), Some("abc"));
    }

    #[test]
    fn translation_contract_preserves_raw_body_mode() {
        let input = translation_input(ExternalApiTranslationInput {
            url: "https://translate.example.test/v1/chat".into(),
            method: "POST".into(),
            headers: HashMap::from([("Content-Type".into(), "application/json".into())]),
            body: json!({ "messages": [{ "content": "hello" }] }),
        })
        .unwrap();

        assert_eq!(input.method.as_deref(), Some("POST"));
        assert_eq!(input.json_body, Some(false));
        assert_eq!(
            input.body,
            Some(json!({ "messages": [{ "content": "hello" }] }))
        );
    }

    #[test]
    fn translation_contract_rejects_unexpected_methods() {
        let result = translation_input(ExternalApiTranslationInput {
            url: "https://translate.example.test/v1/chat".into(),
            method: "PUT".into(),
            headers: HashMap::new(),
            body: Value::Null,
        });

        assert!(result.is_err());
    }

    #[test]
    fn youtube_contract_builds_fixed_endpoint_and_query() {
        let input = youtube_video_input(ExternalApiYoutubeVideoInput {
            video_id: "video id".into(),
            api_key: "key/1".into(),
        })
        .unwrap();
        let url = Url::parse(input.url.as_deref().unwrap()).unwrap();

        assert_eq!(
            url.origin().unicode_serialization(),
            "https://www.googleapis.com"
        );
        assert_eq!(url.path(), "/youtube/v3/videos");
        assert_eq!(
            url.query_pairs()
                .find(|(key, _)| key == "id")
                .map(|(_, value)| value.to_string())
                .as_deref(),
            Some("video id")
        );
        assert_eq!(
            url.query_pairs()
                .find(|(key, _)| key == "part")
                .map(|(_, value)| value.to_string())
                .as_deref(),
            Some("snippet,contentDetails")
        );
        assert_eq!(
            url.query_pairs()
                .find(|(key, _)| key == "key")
                .map(|(_, value)| value.to_string())
                .as_deref(),
            Some("key/1")
        );
    }

    #[test]
    fn status_contract_uses_status_origin_and_referer() {
        let input = vrc_status_input(ExternalApiVrcStatusInput {
            path: "/status.json".into(),
        })
        .unwrap();

        assert_eq!(
            input.url.as_deref(),
            Some("https://status.vrchat.com/api/v2/status.json")
        );
        assert_eq!(
            input.headers.unwrap().get("Referer").map(String::as_str),
            Some("https://vrcx.app")
        );
    }
}
