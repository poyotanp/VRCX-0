use std::path::PathBuf;
use std::sync::Arc;

use serde_json::json;

use crate::database::DatabaseService;
use crate::realtime::ensure_realtime_tables;

use super::*;

struct TestDir {
    path: PathBuf,
}

impl TestDir {
    fn new(name: &str) -> Self {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "vrcx-0-social-aggregates-{name}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self { path }
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

fn test_db(name: &str) -> (TestDir, Arc<DatabaseService>) {
    let dir = TestDir::new(name);
    let db = Arc::new(DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap());
    (dir, db)
}

fn create_game_log_tables(db: &DatabaseService) {
    db.execute_non_query(
        "CREATE TABLE gamelog_join_leave (
                id INTEGER PRIMARY KEY,
                created_at TEXT,
                type TEXT,
                display_name TEXT,
                location TEXT,
                user_id TEXT,
                time INTEGER
            )",
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
        "CREATE TABLE gamelog_location (
                id INTEGER PRIMARY KEY,
                created_at TEXT,
                location TEXT,
                world_id TEXT,
                world_name TEXT,
                time INTEGER,
                group_name TEXT
            )",
        &Default::default(),
    )
    .unwrap();
}

#[test]
fn copresence_summary_groups_minutes_days_instances_and_access_type() {
    let (_dir, db) = test_db("copresence");
    create_game_log_tables(&db);
    for (created_at, display_name, user_id, location, millis) in [
        (
            "2026-06-01T10:00:00Z",
            "Alice",
            "usr_alice",
            "wrld_a:1~private(usr_self)",
            600_000,
        ),
        (
            "2026-06-02T11:00:00Z",
            "Alice",
            "usr_alice",
            "wrld_b:2~group(grp_a)~groupAccessType(plus)",
            300_000,
        ),
        ("2026-06-02T12:00:00Z", "Bob", "usr_bob", "wrld_c:3", 60_000),
    ] {
        db.execute_non_query(
                "INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time)
                 VALUES (@created_at, 'OnPlayerLeft', @display_name, @location, @user_id, @time)",
                &crate::common::ParamsBuilder::new()
                    .set("created_at", created_at)
                    .set("display_name", display_name)
                    .set("location", location)
                    .set("user_id", user_id)
                    .set("time", millis)
                    .build(),
            )
            .unwrap();
    }

    let output = get_copresence_summary(
        &db,
        CopresenceSummaryInput {
            time_window: TimeWindow {
                from: Some("2026-06-01T00:00:00Z".into()),
                to: Some("2026-06-03T00:00:00Z".into()),
            },
            group_by: CopresenceGroupBy::Friend,
            min_minutes: Some(2),
            owner_user_id: None,
            friends_only: false,
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 1);
    let row = &output.rows[0];
    assert_eq!(row.user_id, "usr_alice");
    assert_eq!(row.display_name, "Alice");
    assert_eq!(row.total_minutes, 15);
    assert_eq!(row.co_days, 2);
    assert_eq!(row.instances, 2);
    assert_eq!(row.last_seen_together, "2026-06-02T11:00:00Z");
    assert_eq!(row.minutes_by_access.get("invite"), Some(&10));
    assert_eq!(row.minutes_by_access.get("group"), Some(&5));
    assert!(output
        .caveats
        .iter()
        .any(|caveat| caveat.contains("relative sorting")));
}

#[test]
fn friend_activity_pattern_counts_online_events_by_hour() {
    let (_dir, db) = test_db("activity-pattern");
    ensure_realtime_tables(&db, "usrself").unwrap();
    for (user_id, display_name, created_at) in [
        ("usr_alice", "Alice", "2026-06-01T18:05:00Z"),
        ("usr_alice", "Alice", "2026-06-02T18:45:00Z"),
        ("usr_alice", "Alice", "2026-06-02T21:00:00Z"),
        ("usr_bob", "Bob", "2026-06-03T09:00:00Z"),
    ] {
        db.execute_non_query(
                "INSERT INTO usrself_feed_online_offline
                    (created_at, user_id, display_name, type, location, world_name, time, group_name)
                 VALUES (@created_at, @user_id, @display_name, 'Online', '', '', 0, '')",
                &crate::common::ParamsBuilder::new()
                    .set("created_at", created_at)
                    .set("user_id", user_id)
                    .set("display_name", display_name)
                    .build(),
            )
            .unwrap();
    }

    let output = get_friend_activity_pattern(
        &db,
        FriendActivityPatternInput {
            owner_user_id: "usr_self".into(),
            user_id: Some("usr_alice".into()),
            time_window: TimeWindow::all(),
            bucket: ActivityBucket::HourOfDay,
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 1);
    assert_eq!(output.rows[0].user_id, "usr_alice");
    assert_eq!(output.rows[0].buckets.get("18"), Some(&2));
    assert_eq!(output.rows[0].buckets.get("21"), Some(&1));
    assert_eq!(output.rows[0].typical_online_window, "18:00-19:00");
}

#[test]
fn search_worlds_visited_returns_recent_world_candidates() {
    let (_dir, db) = test_db("worlds-visited");
    create_game_log_tables(&db);
    db.execute_non_query(
            "INSERT INTO gamelog_location (created_at, location, world_id, world_name, time, group_name)
             VALUES
             ('2026-06-01T22:00:00Z', 'wrld_parkour:1', 'wrld_parkour', 'Parkour Night', 1800000, ''),
             ('2026-06-01T20:00:00Z', 'wrld_chill:2', 'wrld_chill', 'Chill Room', 600000, '')",
            &Default::default(),
        )
        .unwrap();

    let output = search_worlds_visited(
        &db,
        SearchWorldsVisitedInput {
            time_window: TimeWindow {
                from: Some("2026-06-01T21:00:00Z".into()),
                to: Some("2026-06-02T00:00:00Z".into()),
            },
            limit: 10,
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 1);
    assert_eq!(output.rows[0].world_id, "wrld_parkour");
    assert_eq!(output.rows[0].world_name, "Parkour Night");
    assert_eq!(output.rows[0].stay_minutes, 30);
}

#[test]
fn social_graph_uses_mutual_graph_edges_without_implying_coplay() {
    let (_dir, db) = test_db("social-graph");
    ensure_realtime_tables(&db, "usrself").unwrap();
    db.execute_non_query(
        "CREATE TABLE usrself_mutual_graph_friends (friend_id TEXT PRIMARY KEY)",
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
            "CREATE TABLE usrself_mutual_graph_links (friend_id TEXT NOT NULL, mutual_id TEXT NOT NULL, PRIMARY KEY(friend_id, mutual_id))",
            &Default::default(),
        )
        .unwrap();
    db.execute_non_query(
            "CREATE TABLE usrself_mutual_graph_meta (friend_id TEXT PRIMARY KEY, last_fetched_at TEXT, opted_out INTEGER DEFAULT 0)",
            &Default::default(),
        )
        .unwrap();
    db.execute_non_query(
        "INSERT INTO usrself_mutual_graph_friends (friend_id)
             VALUES ('usr_a'), ('usr_b')",
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
        "INSERT INTO usrself_mutual_graph_links (friend_id, mutual_id)
             VALUES ('usr_a', 'usr_b')",
        &Default::default(),
    )
    .unwrap();

    let output = get_social_graph(
        &db,
        SocialGraphInput {
            owner_user_id: "usr_self".into(),
            user_id: None,
            depth: 1,
        },
    )
    .unwrap();

    assert_eq!(output.nodes.len(), 2);
    assert_eq!(output.edges.len(), 1);
    assert!(output
        .caveats
        .iter()
        .any(|caveat| caveat.contains("friend relationship")));
}

#[test]
fn favorite_world_local_dry_run_does_not_write() {
    let (_dir, db) = test_db("favorite-world-dry-run");

    let output = favorite_world_local(
        &db,
        FavoriteWorldLocalInput {
            world_id: "wrld_parkour".into(),
            group: "AI Picks".into(),
            dry_run: true,
        },
    )
    .unwrap();

    assert!(output.dry_run);
    assert_eq!(output.world_id, "wrld_parkour");
    assert!(crate::favorites::favorite_list(&db, "world".into())
        .unwrap()
        .is_empty());

    favorite_world_local(
        &db,
        FavoriteWorldLocalInput {
            world_id: "wrld_parkour".into(),
            group: "AI Picks".into(),
            dry_run: false,
        },
    )
    .unwrap();
    assert_eq!(
        crate::favorites::favorite_list(&db, "world".into())
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn companions_of_uses_visible_gps_overlap_and_excludes_private_rows() {
    let (_dir, db) = test_db("companions-of");
    ensure_realtime_tables(&db, "usrself").unwrap();
    for (created_at, user_id, display_name, location, world_name, time) in [
        (
            "2026-06-01T20:00:00Z",
            "usr_target",
            "Target",
            "wrld_public:1",
            "Public World",
            900_000,
        ),
        (
            "2026-06-01T20:05:00Z",
            "usr_alice",
            "Alice",
            "wrld_public:1",
            "Public World",
            600_000,
        ),
        (
            "2026-06-01T21:00:00Z",
            "usr_target",
            "Target",
            "private",
            "",
            900_000,
        ),
        (
            "2026-06-01T21:05:00Z",
            "usr_bob",
            "Bob",
            "private",
            "",
            600_000,
        ),
        (
            "2026-06-01T20:45:00Z",
            "usr_charlie",
            "Charlie",
            "wrld_public:1",
            "Public World",
            600_000,
        ),
    ] {
        db.execute_non_query(
                "INSERT INTO usrself_feed_gps
                    (created_at, user_id, display_name, location, world_name, previous_location, time, group_name)
                 VALUES (@created_at, @user_id, @display_name, @location, @world_name, '', @time, '')",
                &crate::common::ParamsBuilder::new()
                    .set("created_at", created_at)
                    .set("user_id", user_id)
                    .set("display_name", display_name)
                    .set("location", location)
                    .set("world_name", world_name)
                    .set("time", time)
                    .build(),
            )
            .unwrap();
    }

    let output = get_companions_of(
        &db,
        CompanionsOfInput {
            owner_user_id: "usr_self".into(),
            user_id: "usr_target".into(),
            time_window: TimeWindow::all(),
            limit: Some(10),
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 1);
    assert_eq!(output.rows[0].user_id, "usr_alice");
    assert_eq!(output.rows[0].overlap_minutes, 10);
    assert_eq!(output.rows[0].shared_instances, 1);
    assert_eq!(output.rows[0].worlds[0].world_id, "wrld_public");
    assert!(output
        .caveats
        .iter()
        .any(|caveat| caveat.contains("Private instances")));
}

#[test]
fn invite_history_groups_received_and_sent_notifications() {
    let (_dir, db) = test_db("invite-history");
    ensure_realtime_tables(&db, "usrself").unwrap();
    db.execute_non_query(
            "INSERT INTO usrself_notifications
                (id, created_at, type, sender_user_id, sender_username, receiver_user_id, message, world_id, world_name, image_url, invite_message, request_message, response_message, expired)
             VALUES
                ('n1', '2026-06-01T20:00:00Z', 'invite', 'usr_alice', 'Alice', 'usr_self', '', '', '', '', '', '', '', 0),
                ('n2', '2026-06-02T20:00:00Z', 'requestInvite', 'usr_self', 'Self', 'usr_bob', '', '', '', '', '', '', '', 0)",
            &Default::default(),
        )
        .unwrap();
    db.execute_non_query(
            "INSERT INTO usrself_notifications_v2
                (id, created_at, updated_at, expires_at, type, link, link_text, message, title, image_url, seen, sender_user_id, sender_username, data, responses, details)
             VALUES
                ('n3', '2026-06-03T20:00:00Z', '', '', 'invite', '', '', '', '', '', 0, 'usr_alice', 'Alice', '', '', '')",
            &Default::default(),
        )
        .unwrap();

    let output = get_invite_history(
        &db,
        InviteHistoryInput {
            owner_user_id: "usr_self".into(),
            time_window: TimeWindow::all(),
            direction: InviteDirection::Both,
            limit: Some(10),
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 2);
    let alice = output
        .rows
        .iter()
        .find(|row| row.user_id == "usr_alice")
        .unwrap();
    assert_eq!(alice.direction, InviteDirection::Received);
    assert_eq!(alice.total_count, 2);
    assert_eq!(alice.last_invite_at, "2026-06-03T20:00:00Z");
    let bob = output
        .rows
        .iter()
        .find(|row| row.user_id == "usr_bob")
        .unwrap();
    assert_eq!(bob.direction, InviteDirection::Sent);
    assert_eq!(bob.total_count, 1);
}

#[test]
fn friend_changes_returns_recent_status_events_by_friend() {
    let (_dir, db) = test_db("friend-changes");
    ensure_realtime_tables(&db, "usrself").unwrap();
    db.execute_non_query(
            "INSERT INTO usrself_feed_status
                (created_at, user_id, display_name, status, status_description, previous_status, previous_status_description)
             VALUES
                ('2026-06-01T20:00:00Z', 'usr_alice', 'Alice', 'join me', 'Open', 'active', 'Busy'),
                ('2026-06-02T20:00:00Z', 'usr_alice', 'Alice', 'active', 'Back later', 'join me', 'Open'),
                ('2026-06-03T20:00:00Z', 'usr_bob', 'Bob', 'ask me', '', 'active', '')",
            &Default::default(),
        )
        .unwrap();

    let output = get_friend_changes(
        &db,
        FriendChangesInput {
            owner_user_id: "usr_self".into(),
            time_window: TimeWindow::all(),
            kind: FriendChangeKind::Status,
            limit: Some(10),
        },
    )
    .unwrap();

    assert_eq!(output.rows.len(), 2);
    assert_eq!(output.rows[0].user_id, "usr_alice");
    assert_eq!(output.rows[0].change_count, 2);
    assert_eq!(
        output.rows[0].recent_events[0].changed_at,
        "2026-06-02T20:00:00Z"
    );
    assert_eq!(
        output.rows[0].recent_events[0].kind,
        FriendChangeKind::Status
    );
}

#[test]
fn tool_outputs_include_global_data_caveat_resource_text() {
    let value = data_caveats_resource();
    assert!(value.contains("observer-centered"));
    assert!(value.contains("not a global VRChat record"));
    assert_eq!(
        json!(global_caveats()).as_array().unwrap().len(),
        global_caveats().len()
    );
}
