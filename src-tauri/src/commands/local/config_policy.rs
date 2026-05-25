use std::path::PathBuf;

use crate::error::AppError;
use vrcx_0_integrations::external_api;
use vrcx_0_persistence::config::ConfigWriteEntry;

pub fn validate_config_writes(entries: &[ConfigWriteEntry]) -> Result<(), AppError> {
    for entry in entries {
        validate_config_write(&entry.key, &entry.value)?;
    }
    Ok(())
}

fn validate_config_write(key: &str, value: &str) -> Result<(), AppError> {
    match normalize_config_key(key).as_str() {
        "config:vrcx_usergeneratedcontentpath" => validate_ugc_path(value),
        "config:vrcx_translationapiendpoint" => validate_optional_provider_url(
            value,
            "translationAPIEndpoint must be an HTTP or HTTPS endpoint.",
        ),
        "config:vrcx_avatarremotedatabaseprovider" => validate_optional_provider_url(
            value,
            "VRCX_avatarRemoteDatabaseProvider must be an HTTP or HTTPS endpoint.",
        ),
        "config:vrcx_avatarremotedatabaseproviderlist" => validate_provider_list(value),
        _ => Ok(()),
    }
}

fn normalize_config_key(key: &str) -> String {
    let key = key.trim();
    if key.starts_with("config:") {
        return key.to_ascii_lowercase();
    }
    let stripped = key.strip_prefix("VRCX_").unwrap_or(key);
    format!("config:vrcx_{}", stripped.to_ascii_lowercase())
}

fn validate_ugc_path(value: &str) -> Result<(), AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(());
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(AppError::Custom(
            "userGeneratedContentPath must be an absolute folder path.".into(),
        ));
    }
    if path.exists() && !path.is_dir() {
        return Err(AppError::Custom(
            "userGeneratedContentPath must point to a folder.".into(),
        ));
    }
    Ok(())
}

fn validate_optional_provider_url(value: &str, message: &str) -> Result<(), AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(());
    }
    if external_api::request_origin(value).is_some() {
        return Ok(());
    }
    Err(AppError::Custom(message.into()))
}

fn validate_provider_list(value: &str) -> Result<(), AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(());
    }
    let providers: Vec<String> = serde_json::from_str(value).map_err(|error| {
        AppError::Custom(format!(
            "VRCX_avatarRemoteDatabaseProviderList must be a JSON string array: {error}"
        ))
    })?;
    for provider in providers {
        validate_optional_provider_url(
            &provider,
            "VRCX_avatarRemoteDatabaseProviderList contains a non-HTTP(S) endpoint.",
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, value: &str) -> ConfigWriteEntry {
        ConfigWriteEntry {
            key: key.into(),
            value: value.into(),
        }
    }

    #[test]
    fn accepts_regular_config_and_http_providers() {
        validate_config_writes(&[
            entry("SomeRegularSetting", "anything"),
            entry(
                "translationAPIEndpoint",
                "http://localhost:8123/v1/chat/completions",
            ),
            entry(
                "VRCX_avatarRemoteDatabaseProviderList",
                r#"["http://127.0.0.1:8123/api","https://10.0.0.5/api"]"#,
            ),
        ])
        .unwrap();
    }

    #[test]
    fn rejects_non_http_provider_config() {
        assert!(validate_config_writes(&[entry(
            "translationAPIEndpoint",
            "ftp://example.com/api"
        )])
        .is_err());
        assert!(validate_config_writes(&[entry(
            "VRCX_avatarRemoteDatabaseProvider",
            "file:///tmp/provider.json"
        )])
        .is_err());
    }

    #[test]
    fn rejects_relative_ugc_config_paths() {
        assert!(
            validate_config_writes(&[entry("userGeneratedContentPath", "relative/path")]).is_err()
        );
    }
}
