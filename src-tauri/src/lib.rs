mod camera;
mod nikon_sdk;
mod rating;

use camera::{CameraDevice, CameraPhoto};
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
fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    camera::list_photos(camera_id)
}

#[tauri::command]
fn set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String> {
    rating::set_photo_rating(photo_id, rating)
}

#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        changelog: include_str!("../../CHANGELOG.md"),
        update_endpoint: "https://github.com/Asplitline/nikon-connector/releases/latest/download/latest.json",
    }
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
            get_app_info,
            list_cameras,
            list_photos,
            set_photo_rating
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
