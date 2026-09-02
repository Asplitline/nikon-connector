#[cfg(target_os = "macos")]
mod helper_bridge;
mod mock_provider;
pub mod types;

pub use types::{CameraDevice, CameraPhoto};

pub fn list_cameras() -> Vec<CameraDevice> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(cameras) = helper_bridge::list_cameras() {
            if !cameras.is_empty() {
                return cameras;
            }
        }

    }

    mock_provider::list_cameras()
}

pub fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    mock_provider::list_photos(camera_id)
}

pub fn find_photo(photo_id: &str) -> Option<CameraPhoto> {
    mock_provider::mock_photos()
        .into_iter()
        .find(|photo| photo.id == photo_id)
}
