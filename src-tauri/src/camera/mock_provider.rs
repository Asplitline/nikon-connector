use super::types::{CameraDevice, CameraPhoto};

#[cfg_attr(target_os = "macos", allow(dead_code))]
pub fn list_cameras() -> Vec<CameraDevice> {
    vec![CameraDevice {
        id: "z6iii".into(),
        name: "Nikon Z6III".into(),
        model: "Z6III".into(),
        connection: "mock".into(),
    }]
}

pub fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    mock_photos()
        .into_iter()
        .filter(|photo| photo.camera_id == camera_id)
        .collect()
}

pub fn mock_photos() -> Vec<CameraPhoto> {
    vec![
        CameraPhoto {
            id: "dsc-6312".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6312.JPG".into(),
            captured_at: "2026-08-31T07:24:00.000Z".into(),
            rating: 4,
            file_type: "jpg".into(),
            width: 6048,
            height: 4024,
            size_mb: 19.8,
            preview_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
        CameraPhoto {
            id: "dsc-6328".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6328.NEF".into(),
            captured_at: "2026-08-31T07:39:00.000Z".into(),
            rating: 0,
            file_type: "nef".into(),
            width: 6048,
            height: 4024,
            size_mb: 37.2,
            preview_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
        CameraPhoto {
            id: "dsc-6341".into(),
            camera_id: "z6iii".into(),
            file_name: "DSC_6341.JPG".into(),
            captured_at: "2026-08-31T08:02:00.000Z".into(),
            rating: 2,
            file_type: "jpg".into(),
            width: 6048,
            height: 4024,
            size_mb: 16.5,
            preview_url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=82".into(),
            thumbnail_url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=420&q=80".into(),
            object_handle: None,
            storage_id: None,
            can_download_original: Some(true),
            has_embedded_preview: Some(true),
        },
    ]
}
