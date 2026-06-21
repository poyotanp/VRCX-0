pub const ALLOWED_REGISTRY_TYPES: [i32; 3] = [3, 4, 100];
pub const ALLOWED_REGISTRY_KEYS: [&str; 2] = ["LOGGING_ENABLED", "VRC_DEBUG_LOGGING"];
pub const ALLOWED_REGISTRY_KEY_PREFIXES: [&str; 8] = [
    "VRC_",
    "VRChat_",
    "vrchat_",
    "Screenmanager ",
    "UnityGraphicsQuality",
    "UnitySelectMonitor",
    "unity.",
    "PlayerPrefs_",
];

pub fn is_allowed_registry_key(key: &str) -> bool {
    ALLOWED_REGISTRY_KEYS.contains(&key)
        || ALLOWED_REGISTRY_KEY_PREFIXES
            .iter()
            .any(|prefix| key.starts_with(prefix))
        || is_unity_player_prefs_name(key)
        || is_unity_player_prefs_key(key)
}

pub fn is_unity_player_prefs_key(key: &str) -> bool {
    let Some((name, hash)) = key.rsplit_once("_h") else {
        return false;
    };
    !name.is_empty()
        && !hash.is_empty()
        && hash.bytes().all(|byte| byte.is_ascii_digit())
        && name.bytes().all(is_unity_player_prefs_name_byte)
}

fn is_unity_player_prefs_name(key: &str) -> bool {
    !key.is_empty() && key.bytes().all(is_unity_player_prefs_name_byte)
}

fn is_unity_player_prefs_name_byte(byte: u8) -> bool {
    byte == b' ' || byte == b'.' || byte == b'_' || byte == b'-' || byte.is_ascii_alphanumeric()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_allowed_registry_keys() {
        assert!(is_allowed_registry_key("LOGGING_ENABLED"));
        assert!(is_allowed_registry_key("VRC_DEBUG_LOGGING"));
        assert!(is_allowed_registry_key("VRC_TEST"));
        assert!(is_allowed_registry_key("UnityGraphicsQuality"));
        assert!(is_allowed_registry_key("playerHeight_h56066313"));
        assert!(is_allowed_registry_key("playerHeight"));
    }

    #[test]
    fn rejects_unsupported_registry_keys() {
        assert!(!is_allowed_registry_key(""));
        assert!(!is_allowed_registry_key("Bad Key!"));
        assert!(!is_allowed_registry_key("Bad/Key"));
        assert!(!is_allowed_registry_key("Bad\\Key"));
        assert!(!is_allowed_registry_key("Bad\"Key"));
        assert!(!is_allowed_registry_key(""));
    }

    #[test]
    fn recognizes_only_numeric_unity_player_prefs_hash_suffixes() {
        assert!(is_unity_player_prefs_key("playerHeight_h56066313"));
        assert!(!is_unity_player_prefs_key("playerHeight_h"));
        assert!(!is_unity_player_prefs_key("_h56066313"));
        assert!(!is_unity_player_prefs_key("playerHeight_habc"));
    }
}
