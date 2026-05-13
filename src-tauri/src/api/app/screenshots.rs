#![allow(non_snake_case)]

use tauri::State;

use crate::domain::screenshot;
use crate::error::AppError;
use crate::state::AppState;

use super::host_capabilities::{require_host_capability, HostCapability};

#[tauri::command]
pub fn app__get_extra_screenshot_data(
    path: String,
    carousel_cache: bool,
) -> Result<String, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    screenshot::extra_screenshot_data(&path, carousel_cache)
}

#[tauri::command]
pub fn app__get_screenshot_metadata(path: String) -> Result<String, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    screenshot::screenshot_metadata_json(&path)
}

#[tauri::command]
pub fn app__find_screenshots_by_search(
    state: State<'_, AppState>,
    search_query: String,
    search_type: Option<i32>,
) -> Result<String, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    screenshot::find_screenshots_json(&search_query, search_type, &state.screenshot_cache)
}

#[tauri::command]
pub fn app__get_last_screenshot() -> Result<String, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    Ok(screenshot::last_screenshot())
}

#[tauri::command]
pub fn app__delete_screenshot_metadata(path: String) -> Result<bool, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    Ok(screenshot::delete_text_metadata(&path, true))
}

#[tauri::command]
pub fn app__delete_all_screenshot_metadata(state: State<'_, AppState>) -> Result<(), AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    screenshot::delete_all_screenshot_metadata(&state.screenshot_cache);
    Ok(())
}

#[tauri::command]
pub fn app__add_screenshot_metadata(
    path: String,
    metadata_string: String,
    world_id: String,
    change_filename: Option<bool>,
) -> Result<String, AppError> {
    require_host_capability(HostCapability::ScreenshotCache)?;
    Ok(screenshot::add_screenshot_metadata(
        &path,
        &metadata_string,
        &world_id,
        change_filename.unwrap_or(false),
    ))
}
