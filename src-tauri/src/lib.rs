mod camera;
pub mod logging;
mod nikon_sdk;
mod rating;

use camera::{CachedPhotoPreview, CameraDevice, CameraPhoto, ExportPhotosSummary};
use logging::{LogInfo, LogLevel};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    changelog: &'static str,
    update_endpoint: &'static str,
}

#[tauri::command]
fn list_cameras() -> Vec<CameraDevice> {
    camera::list_cameras()
}

#[tauri::command]
fn list_photos(app: tauri::AppHandle, camera_id: &str) -> Result<Vec<CameraPhoto>, String> {
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.list_photos",
        &format!("listing photos for camera {camera_id}"),
    );
    let cache_dir = camera::cache::photo_cache_dir(&app)?;
    let photos = camera::list_photos(camera_id, &cache_dir);
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.list_photos",
        &format!("listed {} photos for camera {camera_id}", photos.len()),
    );
    Ok(photos)
}

#[tauri::command]
fn cache_photo_preview(
    app: tauri::AppHandle,
    camera_id: &str,
    photo_id: &str,
) -> Result<CachedPhotoPreview, String> {
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.cache_photo_preview",
        &format!("caching preview for photo {photo_id} from camera {camera_id}"),
    );
    let cache_dir = camera::cache::photo_cache_dir(&app)?;
    let preview = camera::cache_photo_preview(camera_id, photo_id, &cache_dir)?;
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.cache_photo_preview",
        &format!(
            "cached preview for photo {photo_id}: preview={} thumbnail={}",
            !preview.preview_url.is_empty(),
            !preview.thumbnail_url.is_empty()
        ),
    );
    Ok(preview)
}

#[tauri::command]
fn cache_photo_previews(
    app: tauri::AppHandle,
    camera_id: &str,
    photo_ids: Vec<String>,
    preview_photo_ids: Vec<String>,
) -> Result<Vec<CachedPhotoPreview>, String> {
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.cache_photo_preview",
        &format!(
            "caching {} preview(s) from camera {camera_id}",
            photo_ids.len()
        ),
    );
    let cache_dir = camera::cache::photo_cache_dir(&app)?;
    let previews = camera::cache_photo_previews(camera_id, &photo_ids, &preview_photo_ids, &cache_dir)?;
    let cached_count = previews
        .iter()
        .filter(|preview| !preview.preview_url.is_empty() || !preview.thumbnail_url.is_empty())
        .count();
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.cache_photo_preview",
        &format!(
            "cached {cached_count}/{} preview(s) from camera {camera_id}",
            photo_ids.len()
        ),
    );
    Ok(previews)
}

#[tauri::command]
fn set_photo_rating(
    app: tauri::AppHandle,
    photo_id: String,
    rating: u8,
) -> Result<CameraPhoto, String> {
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.set_photo_rating",
        &format!("setting rating {rating} for photo {photo_id}"),
    );

    match rating::set_photo_rating(photo_id.clone(), rating) {
        Ok(photo) => Ok(photo),
        Err(error) => {
            let _ = logging::write_client_log(
                &app,
                LogLevel::Warn,
                "backend.set_photo_rating",
                &format!("failed setting rating for photo {photo_id}: {error}"),
            );
            Err(error)
        }
    }
}

#[tauri::command]
fn export_photos(
    app: tauri::AppHandle,
    camera_id: &str,
    photo_ids: Vec<String>,
    destination_dir: &str,
) -> Result<ExportPhotosSummary, String> {
    let _ = logging::write_client_log(
        &app,
        LogLevel::Info,
        "backend.export_photos",
        &format!(
            "exporting {} photos from camera {camera_id} to {destination_dir}",
            photo_ids.len()
        ),
    );
    let result = camera::export_photos(camera_id, photo_ids, std::path::Path::new(destination_dir));

    match &result {
        Ok(summary) => {
            let _ = logging::write_client_log(
                &app,
                LogLevel::Info,
                "backend.export_photos",
                &format!(
                    "export complete copied={} skipped={} failed={}",
                    summary.copied, summary.skipped, summary.failed
                ),
            );
        }
        Err(error) => {
            let _ = logging::write_client_log(
                &app,
                LogLevel::Error,
                "backend.export_photos",
                &format!("export failed: {error}"),
            );
        }
    }

    result
}

#[tauri::command]
fn open_image_capture() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("open")
            .args(["-a", "Image Capture"])
            .status()
            .map_err(|error| format!("Failed to launch Image Capture: {error}"))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!("Image Capture exited with status {status}."))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Image Capture is only available on macOS.".into())
    }
}

#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        changelog: include_str!("../../CHANGELOG.md"),
        update_endpoint:
            "https://github.com/Asplitline/nikon-connector/releases/latest/download/latest.json",
    }
}

#[tauri::command]
fn get_log_info(app: tauri::AppHandle) -> Result<LogInfo, String> {
    logging::collect_log_info(&logging::log_dir(&app)?)
}

#[tauri::command]
fn export_logs(app: tauri::AppHandle) -> Result<String, String> {
    let path = logging::export_log_bundle(&logging::log_dir(&app)?)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_client_log(
    app: tauri::AppHandle,
    level: &str,
    target: &str,
    message: &str,
) -> Result<(), String> {
    let level = match level {
        "error" => LogLevel::Error,
        "warn" => LogLevel::Warn,
        _ => LogLevel::Info,
    };

    logging::write_client_log(&app, level, target, message)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cache_photo_preview,
            cache_photo_previews,
            export_logs,
            get_app_info,
            get_log_info,
            export_photos,
            list_cameras,
            list_photos,
            open_image_capture,
            set_photo_rating,
            write_client_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
