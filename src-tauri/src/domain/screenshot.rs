use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use crate::domain::png;
use crate::domain::vrchat_paths;
use crate::error::AppError;

const SCREENSHOT_READY_RETRY_COUNT: usize = 10;
const SCREENSHOT_READY_RETRY_DELAY: Duration = Duration::from_secs(1);
const SCREENSHOT_CONTENT_FOLDERS: [&str; 3] = ["Prints", "Stickers", "Emoji"];

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application: Option<String>,
    #[serde(default)]
    pub version: i32,
    pub author: AuthorDetail,
    pub world: WorldDetail,
    pub players: Vec<PlayerDetail>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pos: Option<[f32; 3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorDetail {
    #[serde(default)]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldDetail {
    #[serde(default)]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub instance_id: String,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetail {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pos: Option<[f32; 3]>,
}

impl ScreenshotMetadata {
    fn just_error(source_file: &str, error: &str) -> Self {
        Self {
            source_file: Some(source_file.into()),
            error: Some(error.into()),
            ..Default::default()
        }
    }

    fn contains_player_id(&self, id: &str) -> bool {
        self.players.iter().any(|p| p.id == id)
    }

    fn contains_player_name(&self, name: &str) -> bool {
        let lower = name.to_lowercase();
        self.players
            .iter()
            .any(|p| p.display_name.to_lowercase().contains(&lower))
    }
}

pub fn read_text_metadata(path: &str) -> Vec<String> {
    let mut pf = match png::PngFile::open_read(path) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let mut result = Vec::new();

    if let Some(xmp) = png::read_text_chunk("XML:com.adobe.xmp", &mut pf, false) {
        result.push(xmp);
    }
    if let Some(desc) = png::read_text_chunk("Description", &mut pf, false) {
        result.push(desc);
    }

    if result.is_empty() && pf.get_chunk(&png::ChunkType::SRGB).is_some() {
        if let Some(lfs) = png::read_text_chunk("Description", &mut pf, true) {
            result.push(lfs);
        }
    }

    result
}

pub fn delete_text_metadata(path: &str, delete_vrchat_metadata: bool) -> bool {
    if path.is_empty() || !Path::new(path).exists() || !is_png_file(path) {
        return false;
    }

    let mut pf = match png::PngFile::open_rw(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let deleted_vrchat = if delete_vrchat_metadata {
        png::delete_text_chunk("XML:com.adobe.xmp", &mut pf)
    } else {
        false
    };
    let deleted_vrcx = png::delete_text_chunk("Description", &mut pf);
    deleted_vrchat || deleted_vrcx
}

pub fn write_vrcx_metadata(text: &str, path: &str) -> bool {
    let mut pf = match png::PngFile::open_rw(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let chunk = png::generate_text_chunk("Description", text);
    pf.write_chunk(&chunk)
}

pub fn has_vrcx_metadata(path: &str) -> bool {
    let mut pf = match png::PngFile::open_read(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    pf.get_chunks_of_type(&png::ChunkType::ITXT)
        .into_iter()
        .filter_map(|chunk| chunk.read_itxt())
        .filter(|(keyword, _)| keyword == "Description")
        .map(|(_, text)| text)
        .any(|s| {
            s.starts_with('{')
                && s.ends_with('}')
                && serde_json::from_str::<ScreenshotMetadata>(&s)
                    .ok()
                    .and_then(|metadata| metadata.application)
                    .is_some_and(|application| application == "VRCX" || application == "VRCX-0")
        })
}

pub fn is_png_file(path: &str) -> bool {
    let mut f = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let len = f.seek(std::io::SeekFrom::End(0)).unwrap_or(0);
    if len < 33 {
        return false;
    }
    f.seek(std::io::SeekFrom::Start(0)).ok();
    let mut sig = [0u8; 8];
    if f.read_exact(&mut sig).is_err() {
        return false;
    }
    sig == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
}

fn is_vrchat_screenshot_path(path: &Path) -> bool {
    let is_png = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    let has_vrchat_prefix = path
        .file_stem()
        .and_then(|file_stem| file_stem.to_str())
        .is_some_and(|file_stem| file_stem.starts_with("VRChat_"));

    is_png && has_vrchat_prefix
}

fn sleep_before_next_screenshot_attempt(attempt: usize) {
    if attempt + 1 < SCREENSHOT_READY_RETRY_COUNT {
        std::thread::sleep(SCREENSHOT_READY_RETRY_DELAY);
    }
}

fn can_decode_image(path: &Path) -> bool {
    std::fs::read(path)
        .ok()
        .and_then(|data| image::load_from_memory(&data).ok())
        .is_some()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn screenshot_path_with_world_id(path: &Path, world_id: &str) -> Option<PathBuf> {
    let file_stem = path.file_stem()?.to_str()?;
    let extension = path.extension()?.to_str()?;
    Some(path.with_file_name(format!("{file_stem}_{world_id}.{extension}")))
}

use std::io::{Read, Seek};

pub fn parse_vrc_image(xml_string: &str) -> ScreenshotMetadata {
    let idx = match xml_string.find("<x:xmpmeta") {
        Some(i) => i,
        None => return ScreenshotMetadata::default(),
    };
    let xml = &xml_string[idx..];

    let mut creator_tool: Option<String> = None;
    let mut author_name: Option<String> = None;
    let mut author_id: Option<String> = None;
    let mut date_time: Option<String> = None;
    let mut note: Option<String> = None;
    let mut world_id: Option<String> = None;
    let mut world_display_name: Option<String> = None;

    use quick_xml::escape::unescape;
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    let mut current_tag = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                current_tag = name;
            }
            Ok(Event::Text(ref e)) => {
                let text = e
                    .decode()
                    .ok()
                    .and_then(|text| unescape(&text).ok().map(|text| text.into_owned()))
                    .unwrap_or_default();
                if text.trim().is_empty() {
                    continue;
                }
                match current_tag.as_str() {
                    "CreatorTool" => creator_tool = Some(text),
                    "Author" => author_name = Some(text),
                    "DateTime" => date_time = Some(text),
                    "li" if note.is_none() => {
                        note = Some(text);
                    }
                    "WorldID" | "World" if world_id.is_none() => {
                        world_id = Some(text);
                    }
                    "WorldDisplayName" => world_display_name = Some(text),
                    "AuthorID" => author_id = Some(text),
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if author_id.is_none() {
        author_id = author_name.take();
    }

    ScreenshotMetadata {
        application: creator_tool,
        version: 1,
        author: AuthorDetail {
            id: author_id.unwrap_or_default(),
            display_name: author_name,
        },
        world: WorldDetail {
            id: world_id.clone().unwrap_or_default(),
            name: world_display_name,
            instance_id: world_id.unwrap_or_default(),
        },
        timestamp: date_time,
        note,
        ..Default::default()
    }
}

pub fn parse_lfs_picture(metadata_string: &str) -> ScreenshotMetadata {
    let mut metadata = ScreenshotMetadata::default();
    let mut parts: Vec<&str> = metadata_string.split('|').collect();

    if parts.len() > 1 && parts[1] == "cvr" {
        parts.remove(0);
    }

    if parts.len() < 2 {
        return metadata;
    }

    let application = parts[0];
    let version: i32 = parts[1].parse().unwrap_or(0);
    metadata.application = Some(application.into());
    metadata.version = version;

    let is_cvr = application == "cvr";

    if application == "screenshotmanager" {
        if parts.len() >= 4 {
            let author_parts: Vec<&str> = parts[2]
                .strip_prefix("author:")
                .unwrap_or(parts[2])
                .split(',')
                .collect();
            if author_parts.len() >= 2 {
                metadata.author.id = author_parts[0].into();
                metadata.author.display_name = Some(author_parts[1].into());
            }
            let world_parts: Vec<&str> = parts[3].split(',').collect();
            if world_parts.len() >= 3 {
                metadata.world.id = world_parts[0].into();
                metadata.world.name = Some(world_parts[2].into());
                metadata.world.instance_id = format!("{}:{}", world_parts[0], world_parts[1]);
            }
        }
        return metadata;
    }

    for part in parts.iter().skip(2) {
        let split: Vec<&str> = part.splitn(2, ':').collect();
        if split.len() < 2 || split[1].is_empty() {
            continue;
        }
        let key = split[0];
        let value = split[1];
        let sub_parts: Vec<&str> = value.split(',').collect();

        match key {
            "author" if sub_parts.len() >= 2 => {
                metadata.author.id = if is_cvr {
                    String::new()
                } else {
                    sub_parts[0].into()
                };
                metadata.author.display_name = Some(if is_cvr {
                    format!("{} ({})", sub_parts[1], sub_parts[0])
                } else {
                    sub_parts[1].into()
                });
            }
            "world" => {
                if is_cvr || version == 1 {
                    metadata.world.id = String::new();
                    metadata.world.instance_id = String::new();
                    metadata.world.name = Some(if is_cvr && sub_parts.len() >= 3 {
                        format!("{} ({})", sub_parts[2], sub_parts[0])
                    } else {
                        value.into()
                    });
                } else if sub_parts.len() >= 3 {
                    metadata.world.id = sub_parts[0].into();
                    metadata.world.instance_id = format!("{}:{}", sub_parts[0], sub_parts[1]);
                    metadata.world.name = Some(sub_parts[2].into());
                }
            }
            "pos" if sub_parts.len() >= 3 => {
                let x: f32 = sub_parts[0].parse().unwrap_or(0.0);
                let y: f32 = sub_parts[1].parse().unwrap_or(0.0);
                let z: f32 = sub_parts[2].parse().unwrap_or(0.0);
                metadata.pos = Some([x, y, z]);
            }
            "players" => {
                let players_str = value.split(';');
                for player in players_str {
                    let pp: Vec<&str> = player.split(',').collect();
                    if pp.len() >= 5 {
                        let x: f32 = pp[1].parse().unwrap_or(0.0);
                        let y: f32 = pp[2].parse().unwrap_or(0.0);
                        let z: f32 = pp[3].parse().unwrap_or(0.0);
                        metadata.players.push(PlayerDetail {
                            id: if is_cvr { String::new() } else { pp[0].into() },
                            display_name: if is_cvr {
                                format!("{} ({})", pp[4], pp[0])
                            } else {
                                pp[4].into()
                            },
                            pos: Some([x, y, z]),
                        });
                    }
                }
            }
            _ => {}
        }
    }

    metadata
}

pub fn get_screenshot_metadata(path: &str) -> Option<ScreenshotMetadata> {
    let p = Path::new(path);
    let is_png_extension = p
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    if !p.exists() || !is_png_extension {
        return None;
    }

    let metadata_strs = read_text_metadata(path);
    if metadata_strs.is_empty() {
        return Some(ScreenshotMetadata::just_error(
            path,
            "Image has no valid metadata.",
        ));
    }

    let mut result = ScreenshotMetadata::default();
    let mut got_vrchat = false;

    for s in &metadata_strs {
        if s.contains("<x:xmpmeta") {
            result = parse_vrc_image(s);
            result.source_file = Some(path.into());
            got_vrchat = true;
        } else if s.starts_with('{') && s.ends_with('}') {
            if let Ok(mut vrcx) = serde_json::from_str::<ScreenshotMetadata>(s) {
                vrcx.source_file = Some(path.into());
                if got_vrchat {
                    result.players = vrcx.players;
                    result.world.instance_id = vrcx.world.instance_id;
                } else {
                    result = vrcx;
                }
            }
        } else if s.starts_with("lfs") || s.starts_with("screenshotmanager") {
            result = parse_lfs_picture(s);
            result.source_file = Some(path.into());
        }
    }

    if result.application.is_none() {
        return Some(ScreenshotMetadata::just_error(
            path,
            "Image has no valid metadata.",
        ));
    }

    Some(result)
}

pub fn extra_screenshot_data(path: &str, carousel_cache: bool) -> Result<String, AppError> {
    let p = Path::new(path);
    let mut result = serde_json::Map::new();

    result.insert("filePath".into(), serde_json::json!(path));

    if let Ok(meta) = std::fs::metadata(p) {
        if let Ok(created) = meta.created() {
            let dt: chrono::DateTime<chrono::Utc> = created.into();
            result.insert("creationDate".into(), serde_json::json!(dt.to_rfc3339()));
        }
        result.insert("fileSizeBytes".into(), serde_json::json!(meta.len()));
    }
    if is_png_file(path) {
        let mut png = png::PngFile::open_read(path);
        if let Ok(ref mut png) = png {
            let res = png::read_resolution(png);
            if !res.is_empty() {
                result.insert("resolution".into(), serde_json::json!(res));
            }
        }
    }
    let file_name = p
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    result.insert("fileName".into(), serde_json::json!(file_name));

    if carousel_cache {
        if let Some(parent) = p.parent() {
            if let Ok(entries) = std::fs::read_dir(parent) {
                let mut pngs: Vec<String> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path()
                            .extension()
                            .is_some_and(|ext| ext.eq_ignore_ascii_case("png"))
                    })
                    .map(|e| e.path().to_string_lossy().into_owned())
                    .collect();
                pngs.sort();
                if let Some(idx) = pngs.iter().position(|f| f == path) {
                    if idx > 0 {
                        result.insert("previousFilePath".into(), serde_json::json!(pngs[idx - 1]));
                    }
                    if idx + 1 < pngs.len() {
                        result.insert("nextFilePath".into(), serde_json::json!(pngs[idx + 1]));
                    }
                }
            }
        }
    }

    serde_json::to_string(&result).map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

fn screenshot_error_json(path: &str, error: &str) -> Result<String, AppError> {
    serde_json::to_string(&serde_json::json!({
        "sourceFile": path,
        "error": error,
    }))
    .map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

pub fn screenshot_metadata_json(path: &str) -> Result<String, AppError> {
    match get_screenshot_metadata(path) {
        Some(meta) => {
            if let Some(error) = meta.error.as_deref() {
                return screenshot_error_json(meta.source_file.as_deref().unwrap_or(path), error);
            }

            serde_json::to_string(&meta).map_err(|e| AppError::Custom(format!("serialize: {e}")))
        }
        None => screenshot_error_json(path, "Screenshot contains no metadata."),
    }
}

pub fn find_screenshots_json(
    search_query: &str,
    search_type: Option<i32>,
    cache: &MetadataCacheDb,
) -> Result<String, AppError> {
    let st = SearchType::from_i32(search_type.unwrap_or(0));
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return Ok("[]".into());
    }
    let results = find_screenshots(search_query, &photos_dir, st, cache);
    serde_json::to_string(&results).map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

fn is_screenshot_content_asset_path(path: &Path) -> bool {
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        SCREENSHOT_CONTENT_FOLDERS
            .iter()
            .any(|folder| name.eq_ignore_ascii_case(folder))
    })
}

fn screenshot_file_time(path: &Path) -> Option<std::time::SystemTime> {
    let meta = std::fs::metadata(path).ok()?;
    meta.created().or_else(|_| meta.modified()).ok()
}

fn last_screenshot_in(photos_dir: &Path) -> String {
    if !photos_dir.is_dir() {
        return String::new();
    }

    walkdir::WalkDir::new(photos_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
                && !is_screenshot_content_asset_path(path)
        })
        .filter_map(|path| screenshot_file_time(&path).map(|time| (path, time)))
        .max_by_key(|(_, time)| *time)
        .map(|(path, _)| path.to_string_lossy().into_owned())
        .unwrap_or_default()
}

pub fn last_screenshot() -> String {
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return String::new();
    }
    last_screenshot_in(Path::new(&photos_dir))
}

pub fn delete_all_screenshot_metadata(cache: &MetadataCacheDb) {
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return;
    }
    for entry in walkdir::WalkDir::new(&photos_dir).into_iter().flatten() {
        if entry.file_type().is_file()
            && entry
                .path()
                .extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("png"))
        {
            delete_text_metadata(&entry.path().to_string_lossy(), true);
        }
    }
    cache.clear_all();
}

pub fn add_screenshot_metadata(
    path: &str,
    metadata_string: &str,
    world_id: &str,
    change_filename: bool,
) -> String {
    let original_path = PathBuf::from(path);
    if !is_vrchat_screenshot_path(&original_path) {
        return String::new();
    }

    let mut current_path = original_path;
    let mut renamed = false;

    for attempt in 0..SCREENSHOT_READY_RETRY_COUNT {
        let current_path_string = path_string(&current_path);
        if !is_png_file(&current_path_string) || !can_decode_image(&current_path) {
            sleep_before_next_screenshot_attempt(attempt);
            continue;
        }

        if has_vrcx_metadata(&current_path_string) {
            return current_path_string;
        }

        if change_filename && !renamed {
            let Some(next_path) = screenshot_path_with_world_id(&current_path, world_id) else {
                return String::new();
            };

            if next_path != current_path {
                match std::fs::rename(&current_path, &next_path) {
                    Ok(()) => {
                        current_path = next_path;
                    }
                    Err(_) => {
                        sleep_before_next_screenshot_attempt(attempt);
                        continue;
                    }
                }
            }
            renamed = true;
        }

        let current_path_string = path_string(&current_path);
        if write_vrcx_metadata(metadata_string, &current_path_string) {
            return current_path_string;
        }

        sleep_before_next_screenshot_attempt(attempt);
    }

    String::new()
}

#[derive(Clone, Copy)]
pub enum SearchType {
    Username = 0,
    UserID = 1,
    WorldName = 2,
    WorldID = 3,
}

impl SearchType {
    pub fn from_i32(v: i32) -> Self {
        match v {
            1 => Self::UserID,
            2 => Self::WorldName,
            3 => Self::WorldID,
            _ => Self::Username,
        }
    }
}

pub fn find_screenshots(
    query: &str,
    directory: &str,
    search_type: SearchType,
    cache_db: &MetadataCacheDb,
) -> Vec<String> {
    let dir = Path::new(directory);
    if !dir.exists() {
        return Vec::new();
    }

    let mut result = Vec::new();
    let mut to_cache: Vec<(String, Option<String>)> = Vec::new();

    let files: Vec<String> = walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path()
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("png"))
        })
        .map(|e| e.path().to_string_lossy().into_owned())
        .collect();

    for file in &files {
        let metadata = if let Some(cached) = cache_db.get_metadata(file) {
            serde_json::from_str::<ScreenshotMetadata>(&cached).ok()
        } else if cache_db.is_cached(file) {
            None
        } else {
            let m = get_screenshot_metadata(file);
            let json = m
                .as_ref()
                .filter(|m| m.error.is_none())
                .and_then(|m| serde_json::to_string(m).ok());
            to_cache.push((file.clone(), json));
            m.filter(|m| m.error.is_none())
        };

        if let Some(ref meta) = metadata {
            let matched = match search_type {
                SearchType::Username => meta.contains_player_name(query),
                SearchType::UserID => meta.contains_player_id(query),
                SearchType::WorldName => meta
                    .world
                    .name
                    .as_ref()
                    .is_some_and(|n| n.to_lowercase().contains(&query.to_lowercase())),
                SearchType::WorldID => meta.world.id == query,
            };
            if matched {
                if let Some(ref sf) = meta.source_file {
                    result.push(sf.clone());
                } else {
                    result.push(file.clone());
                }
            }
        }
    }

    if !to_cache.is_empty() {
        cache_db.bulk_add(&to_cache);
    }

    result
}

pub struct MetadataCacheDb {
    conn: Mutex<rusqlite::Connection>,
}

impl MetadataCacheDb {
    pub fn new(db_path: &Path) -> Result<Self, String> {
        let conn =
            rusqlite::Connection::open(db_path).map_err(|e| format!("open cache db: {e}"))?;
        conn.execute_batch(
            "PRAGMA locking_mode=NORMAL;
             PRAGMA busy_timeout=5000;
             PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS cache (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 file_path TEXT NOT NULL UNIQUE,
                 metadata TEXT,
                 cached_at INTEGER NOT NULL
             );",
        )
        .map_err(|e| format!("init cache db: {e}"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn is_cached(&self, file_path: &str) -> bool {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT 1 FROM cache WHERE file_path = ?1 LIMIT 1",
            [file_path],
            |_| Ok(()),
        )
        .is_ok()
    }

    pub fn get_metadata(&self, file_path: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT metadata FROM cache WHERE file_path = ?1 LIMIT 1",
            [file_path],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
    }

    pub fn bulk_add(&self, entries: &[(String, Option<String>)]) {
        let conn = self.conn.lock().unwrap();
        let tx = match conn.unchecked_transaction() {
            Ok(t) => t,
            Err(_) => return,
        };
        {
            let mut stmt = match tx.prepare(
                "INSERT OR IGNORE INTO cache (file_path, metadata, cached_at) VALUES (?1, ?2, ?3)",
            ) {
                Ok(s) => s,
                Err(_) => return,
            };
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            for (path, meta) in entries {
                let _ = stmt.execute(rusqlite::params![path, meta.as_deref(), now]);
            }
        }
        let _ = tx.commit();
    }

    pub fn clear_all(&self) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("DELETE FROM cache", []);
    }
}

#[cfg(test)]
mod tests {
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
            let path =
                std::env::temp_dir().join(format!("vrcx-0-{name}-{}-{nonce}", std::process::id()));
            std::fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn write_test_png(path: &Path) -> Result<(), AppError> {
        let img = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            2,
            2,
            image::Rgba([12, 34, 56, 255]),
        ));
        let mut buf = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut buf);
        img.write_with_encoder(encoder)
            .map_err(|e| AppError::Custom(format!("png encode: {e}")))?;
        std::fs::write(path, buf)?;
        Ok(())
    }

    fn write_text_chunk(path: &Path, keyword: &str, text: &str) -> Result<(), AppError> {
        let path_str = path.to_string_lossy();
        let mut png = png::PngFile::open_rw(&path_str)
            .map_err(|e| AppError::Custom(format!("png open: {e}")))?;
        let chunk = png::generate_text_chunk(keyword, text);
        assert!(png.write_chunk(&chunk));
        Ok(())
    }

    #[test]
    fn get_screenshot_metadata_reads_legacy_lfs_world_and_players_from_png() -> Result<(), AppError>
    {
        let dir = TestDir::new("screenshot-legacy-lfs");
        let path = dir.path.join("legacy.png");
        write_test_png(&path)?;
        write_text_chunk(
            &path,
            "Description",
            "lfs|2|author:usr_author,Ava|world:wrld_legacy,12345,Legacy World|pos:1.5,2.5,3.5|players:usr_one,1,2,3,Player One;usr_two,4.5,5.5,6.5,Player Two",
        )?;

        let path_str = path.to_string_lossy();
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(metadata.application.as_deref(), Some("lfs"));
        assert_eq!(metadata.world.id, "wrld_legacy");
        assert_eq!(metadata.world.name.as_deref(), Some("Legacy World"));
        assert_eq!(metadata.world.instance_id, "wrld_legacy:12345");
        assert_eq!(metadata.players.len(), 2);
        assert_eq!(metadata.players[0].id, "usr_one");
        assert_eq!(metadata.players[0].display_name, "Player One");
        assert_eq!(metadata.players[0].pos, Some([1.0, 2.0, 3.0]));
        assert_eq!(metadata.players[1].id, "usr_two");
        assert_eq!(metadata.players[1].display_name, "Player Two");
        assert_eq!(metadata.players[1].pos, Some([4.5, 5.5, 6.5]));
        Ok(())
    }

    #[test]
    fn add_screenshot_metadata_writes_vrcx_world_and_players_for_new_screenshot(
    ) -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-vrcx-metadata");
        let path = dir
            .path
            .join("VRChat_2026-05-08_00-00-00.000_3840x2160.png");
        write_test_png(&path)?;
        let path_str = path.to_string_lossy().into_owned();
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_new",
                "name": "New Screenshot World",
                "instanceId": "wrld_new:98765~region(us)"
            },
            "players": [
                {
                    "id": "usr_friend",
                    "displayName": "Friend One"
                }
            ]
        })
        .to_string();

        let written_path = add_screenshot_metadata(&path_str, &metadata_json, "wrld_new", false);
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(written_path, path_str);
        assert!(has_vrcx_metadata(&path_str));
        assert_eq!(metadata.application.as_deref(), Some("VRCX-0"));
        assert_eq!(metadata.world.id, "wrld_new");
        assert_eq!(metadata.world.name.as_deref(), Some("New Screenshot World"));
        assert_eq!(metadata.world.instance_id, "wrld_new:98765~region(us)");
        assert_eq!(metadata.players.len(), 1);
        assert_eq!(metadata.players[0].id, "usr_friend");
        assert_eq!(metadata.players[0].display_name, "Friend One");
        Ok(())
    }

    #[test]
    fn get_screenshot_metadata_merges_vrchat_world_name_with_vrcx_players() -> Result<(), AppError>
    {
        let dir = TestDir::new("screenshot-vrchat-vrcx-merge");
        let path = dir
            .path
            .join("VRChat_2026-05-08_00-00-01.000_3840x2160.png");
        write_test_png(&path)?;
        write_text_chunk(
            &path,
            "XML:com.adobe.xmp",
            r#"<x:xmpmeta xmlns:x="adobe:ns:meta/"><CreatorTool>VRChat</CreatorTool><Author>VRChat User</Author><AuthorID>usr_author</AuthorID><DateTime>2026-05-08T00:00:01.000Z</DateTime><WorldID>wrld_current</WorldID><WorldDisplayName>Current World Friends</WorldDisplayName></x:xmpmeta>"#,
        )?;
        let path_str = path.to_string_lossy().into_owned();
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_current",
                "name": "JSON World",
                "instanceId": "wrld_current:12345~hidden(usr_hidden)~region(us)"
            },
            "players": [
                {
                    "id": "usr_one",
                    "displayName": "Player One"
                },
                {
                    "id": "usr_two",
                    "displayName": "Player Two"
                }
            ]
        })
        .to_string();

        assert_eq!(
            add_screenshot_metadata(&path_str, &metadata_json, "wrld_current", false),
            path_str
        );
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(metadata.application.as_deref(), Some("VRChat"));
        assert_eq!(metadata.author.id, "usr_author");
        assert_eq!(metadata.author.display_name.as_deref(), Some("VRChat User"));
        assert_eq!(
            metadata.timestamp.as_deref(),
            Some("2026-05-08T00:00:01.000Z")
        );
        assert_eq!(metadata.world.id, "wrld_current");
        assert_eq!(
            metadata.world.name.as_deref(),
            Some("Current World Friends")
        );
        assert_eq!(
            metadata.world.instance_id,
            "wrld_current:12345~hidden(usr_hidden)~region(us)"
        );
        assert_eq!(
            metadata
                .players
                .iter()
                .map(|player| player.display_name.as_str())
                .collect::<Vec<_>>(),
            vec!["Player One", "Player Two"]
        );
        Ok(())
    }
}
