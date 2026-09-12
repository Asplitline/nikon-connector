pub mod cache;
#[cfg(target_os = "macos")]
mod helper_bridge;
#[cfg(target_os = "macos")]
mod helper_daemon;
mod mock_provider;
pub mod types;

// 退出时收掉常驻 helper，避免留下孤儿进程占着相机会话
pub fn shutdown_helper() {
    #[cfg(target_os = "macos")]
    helper_bridge::shutdown();
}

pub use types::{CachedPhotoPreview, CameraDevice, CameraPhoto, ExportPhotosSummary};

pub fn list_cameras() -> Vec<CameraDevice> {
    #[cfg(target_os = "macos")]
    {
        return cameras_from_helper_result(helper_bridge::list_cameras());
    }

    #[cfg(not(target_os = "macos"))]
    {
        mock_provider::list_cameras()
    }
}

pub fn list_photos(camera_id: &str, cache_dir: &std::path::Path) -> Vec<CameraPhoto> {
    #[cfg(target_os = "macos")]
    {
        if let Some(photos) =
            photos_from_helper_result(camera_id, helper_bridge::list_photos(camera_id, cache_dir))
        {
            return photos;
        }

        return Vec::new();
    }

    #[cfg(not(target_os = "macos"))]
    {
        mock_provider::list_photos(camera_id)
    }
}

pub fn cache_photo_preview(
    camera_id: &str,
    photo_id: &str,
    cache_dir: &std::path::Path,
) -> Result<CachedPhotoPreview, String> {
    let photo_ids = [photo_id.to_string()];
    cache_photo_previews(camera_id, &photo_ids, &photo_ids, cache_dir)?
        .into_iter()
        .next()
        .ok_or_else(|| "No preview result was returned.".to_string())
}

pub fn cache_photo_previews(
    camera_id: &str,
    photo_ids: &[String],
    preview_photo_ids: &[String],
    cache_dir: &std::path::Path,
) -> Result<Vec<CachedPhotoPreview>, String> {
    if photo_ids.is_empty() {
        return Ok(Vec::new());
    }

    #[cfg(target_os = "macos")]
    {
        return helper_bridge::cache_photo_previews(camera_id, photo_ids, preview_photo_ids, cache_dir);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (camera_id, preview_photo_ids, cache_dir);
        Ok(photo_ids
            .iter()
            .map(|photo_id| CachedPhotoPreview {
                photo_id: photo_id.clone(),
                preview_url: String::new(),
                thumbnail_url: String::new(),
            })
            .collect())
    }
}

pub fn export_photos(
    camera_id: &str,
    photo_ids: Vec<String>,
    destination_dir: &std::path::Path,
) -> Result<ExportPhotosSummary, String> {
    if photo_ids.is_empty() {
        return Ok(ExportPhotosSummary {
            copied: 0,
            skipped: 0,
            failed: 0,
        });
    }

    #[cfg(target_os = "macos")]
    {
        return helper_bridge::export_photos(camera_id, &photo_ids, destination_dir);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (camera_id, destination_dir);
        Err("Camera export is only available on macOS.".into())
    }
}

pub fn set_photo_rating(
    camera_id: &str,
    photo_id: &str,
    rating: u8,
) -> Result<CameraPhoto, String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    #[cfg(target_os = "macos")]
    {
        if camera_id != "z6iii" {
            return helper_bridge::set_photo_rating(camera_id, photo_id, rating);
        }
    }

    let mut photo = find_photo(photo_id).ok_or_else(|| "Photo not found.".to_string())?;
    if photo.camera_id != camera_id {
        return Err("Photo not found.".into());
    }
    photo.rating = rating;
    Ok(photo)
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

#[cfg(target_os = "macos")]
fn cameras_from_helper_result(
    helper_result: Result<Vec<CameraDevice>, String>,
) -> Vec<CameraDevice> {
    match helper_result {
        Ok(cameras) => {
            if cameras.is_empty() {
                eprintln!("[nikon-connector] camera scan completed with no Image Capture cameras");
            } else {
                eprintln!(
                    "[nikon-connector] camera scan found {} Image Capture camera(s)",
                    cameras.len()
                );
            }
            cameras
        }
        Err(error) => {
            eprintln!("[nikon-connector] camera scan failed: {error}");
            Vec::new()
        }
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
        assert!(
            photos_from_helper_result("real-camera", Err("helper unavailable".into())).is_none()
        );
    }

    #[test]
    fn camera_scan_does_not_present_mock_as_a_connected_camera() {
        assert!(cameras_from_helper_result(Ok(Vec::new())).is_empty());
        assert!(cameras_from_helper_result(Err("helper unavailable".into())).is_empty());
    }

    #[test]
    fn export_empty_selection_returns_empty_summary() {
        let summary = export_photos("z6iii", Vec::new(), std::path::Path::new("/tmp")).unwrap();

        assert_eq!(summary.copied, 0);
        assert_eq!(summary.skipped, 0);
        assert_eq!(summary.failed, 0);
    }
}
