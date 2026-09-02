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
    #[cfg(target_os = "macos")]
    {
        let cache_dir = std::env::temp_dir().join("nikon-connector-photo-cache");
        if let Some(photos) = photos_from_helper_result(
            camera_id,
            helper_bridge::list_photos(camera_id, &cache_dir),
        ) {
            return photos;
        }

        return Vec::new();
    }

    #[cfg(not(target_os = "macos"))]
    {
        mock_provider::list_photos(camera_id)
    }
}

fn photos_from_helper_result(
    camera_id: &str,
    helper_result: Result<Vec<CameraPhoto>, String>,
) -> Option<Vec<CameraPhoto>> {
    match helper_result {
        Ok(photos) if !photos.is_empty() => Some(photos),
        _ if camera_id == "z6iii" => Some(mock_provider::list_photos(camera_id)),
        _ => None,
    }
}

pub fn find_photo(photo_id: &str) -> Option<CameraPhoto> {
    mock_provider::mock_photos()
        .into_iter()
        .find(|photo| photo.id == photo_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_mock_photos_only_for_the_mock_camera() {
        assert!(photos_from_helper_result("z6iii", Ok(Vec::new())).is_some());
        assert!(photos_from_helper_result("z6iii", Err("helper unavailable".into())).is_some());
        assert!(photos_from_helper_result("real-camera", Ok(Vec::new())).is_none());
        assert!(photos_from_helper_result("real-camera", Err("helper unavailable".into())).is_none());
    }
}
