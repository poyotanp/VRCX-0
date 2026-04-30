use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::error::AppError;

const IMAGE_READ_RETRY_COUNT: usize = 10;
const IMAGE_READ_RETRY_DELAY: Duration = Duration::from_secs(1);

pub fn get_clipboard_text() -> Result<String, AppError> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| AppError::Custom(format!("clipboard: {e}")))?;
    Ok(clipboard.get_text().unwrap_or_default())
}

fn is_supported_image_path(path: &Path) -> bool {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "bmp" | "gif" | "webp"
    )
}

fn sleep_before_next_attempt(attempt: usize) {
    if attempt + 1 < IMAGE_READ_RETRY_COUNT {
        std::thread::sleep(IMAGE_READ_RETRY_DELAY);
    }
}

fn load_rgba_with_retry(path: &Path) -> Result<image::RgbaImage, AppError> {
    let mut last_error = String::from("image is not ready");

    for attempt in 0..IMAGE_READ_RETRY_COUNT {
        match std::fs::read(path) {
            Ok(data) => match image::load_from_memory(&data) {
                Ok(img) => return Ok(img.to_rgba8()),
                Err(error) => {
                    last_error = format!("load image: {error}");
                }
            },
            Err(error) => {
                last_error = format!("read image: {error}");
            }
        }

        sleep_before_next_attempt(attempt);
    }

    Err(AppError::Custom(last_error))
}

fn add_image_file_path_to_clipboard(path: &Path) {
    let mut clipboard = match arboard::Clipboard::new() {
        Ok(clipboard) => clipboard,
        Err(error) => {
            tracing::warn!("Failed to reopen clipboard for image file path: {error}");
            return;
        }
    };

    if let Err(error) = clipboard.set().file_list(&[path]) {
        tracing::warn!("Failed to add image file path to clipboard: {error}");
    }
}

pub fn copy_image_to_clipboard(path: &str) -> Result<(), AppError> {
    let path_buf = PathBuf::from(path);
    if !is_supported_image_path(&path_buf) {
        return Err(AppError::Custom("unsupported image format".into()));
    }

    let rgba = load_rgba_with_retry(&path_buf)?;

    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| AppError::Custom(format!("clipboard: {e}")))?;
    clipboard
        .set_image(arboard::ImageData {
            width: rgba.width() as usize,
            height: rgba.height() as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        })
        .map_err(|e| AppError::Custom(format!("set clipboard image: {e}")))?;

    if cfg!(windows) {
        add_image_file_path_to_clipboard(&path_buf);
    }

    Ok(())
}
