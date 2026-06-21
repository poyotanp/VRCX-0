use std::{collections::BTreeMap, sync::OnceLock};

use serde::Deserialize;

const SHELL_STRINGS_JSON: &str = include_str!("shell_strings.json");

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TrayLabels {
    pub(crate) open: String,
    pub(crate) background_mode: String,
    pub(crate) disable_theme: String,
    pub(crate) exit: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackgroundModeNotificationLabels {
    pub(crate) title: String,
    pub(crate) body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AuthFailureNotificationLabels {
    pub(crate) title: String,
    pub(crate) body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShellLocaleCatalog {
    fallback_locale: String,
    locales: BTreeMap<String, BTreeMap<String, String>>,
}

pub(crate) fn tray_labels_for_language(language: &str) -> TrayLabels {
    TrayLabels {
        open: text(language, "nativeShell.tray.open"),
        background_mode: text(language, "nativeShell.tray.backgroundMode"),
        disable_theme: text(language, "nativeShell.tray.disableTheme"),
        exit: text(language, "nativeShell.tray.exit"),
    }
}

pub(crate) fn background_mode_notification_labels_for_language(
    language: &str,
) -> BackgroundModeNotificationLabels {
    BackgroundModeNotificationLabels {
        title: text(
            language,
            "nativeShell.notification.backgroundModeStarted.title",
        ),
        body: text(
            language,
            "nativeShell.notification.backgroundModeStarted.body",
        ),
    }
}

pub(crate) fn auth_failure_notification_labels_for_language(
    language: &str,
) -> AuthFailureNotificationLabels {
    AuthFailureNotificationLabels {
        title: text(language, "nativeShell.notification.authFailure.title"),
        body: text(language, "nativeShell.notification.authFailure.body"),
    }
}

fn text(language: &str, key: &str) -> String {
    let catalog = catalog();
    let locale = locale_key(catalog, language);
    localized_text(catalog, &locale, key)
        .or_else(|| localized_text(catalog, &catalog.fallback_locale, key))
        .unwrap_or_default()
        .to_string()
}

fn catalog() -> &'static ShellLocaleCatalog {
    static CATALOG: OnceLock<ShellLocaleCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(SHELL_STRINGS_JSON).expect("shell locale catalog must be valid JSON")
    })
}

fn localized_text<'a>(catalog: &'a ShellLocaleCatalog, locale: &str, key: &str) -> Option<&'a str> {
    catalog
        .locales
        .get(locale)
        .and_then(|values| values.get(key))
        .map(String::as_str)
}

fn locale_key(catalog: &ShellLocaleCatalog, language: &str) -> String {
    let normalized = language.trim().replace('_', "-").to_ascii_lowercase();
    if normalized.is_empty() {
        return catalog.fallback_locale.clone();
    }

    let parts = normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    let base = parts.first().copied().unwrap_or_default();
    if base == "zh" {
        let traditional = parts
            .iter()
            .skip(1)
            .any(|part| matches!(*part, "hant" | "tw" | "hk" | "mo"));
        return if traditional { "zh-TW" } else { "zh-CN" }.to_string();
    }

    catalog
        .locales
        .keys()
        .find(|locale| locale.to_ascii_lowercase() == base)
        .cloned()
        .unwrap_or_else(|| catalog.fallback_locale.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_chinese_script_and_region_variants() {
        assert_eq!(
            auth_failure_notification_labels_for_language("zh-Hant").title,
            "VRChat 登入已失效"
        );
        assert_eq!(
            auth_failure_notification_labels_for_language("zh_HK").title,
            "VRChat 登入已失效"
        );
        assert_eq!(
            auth_failure_notification_labels_for_language("zh-Hans").title,
            "VRChat 登录已失效"
        );
    }

    #[test]
    fn unsupported_locale_falls_back_to_english() {
        assert_eq!(tray_labels_for_language("not-real").open, "Open VRCX-0");
    }
}
