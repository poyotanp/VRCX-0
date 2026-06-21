use super::*;
use serde_json::json;

#[test]
fn rejects_unknown_game_log_entry_kind() {
    let error = game_log_batch_for_kind(
        "UnknownKind",
        vec![json!({
            "created_at": "2026-05-15T00:00:00Z"
        })],
    )
    .unwrap_err();

    assert!(matches!(error, crate::Error::InvalidData(_)));
}
