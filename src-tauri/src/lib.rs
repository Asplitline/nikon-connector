mod camera;
mod nikon_sdk;
mod rating;

use camera::{CameraDevice, CameraPhoto};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_cameras,
            list_photos,
            set_photo_rating
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
