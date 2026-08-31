use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CameraDevice {
    id: String,
    name: String,
    model: String,
    connection: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CameraPhoto {
    id: String,
    camera_id: String,
    file_name: String,
    captured_at: String,
    rating: u8,
    file_type: String,
    width: u32,
    height: u32,
    size_mb: f32,
    preview_url: String,
    thumbnail_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RatingRequest {
    photo_id: String,
    rating: u8,
}

#[tauri::command]
fn list_cameras() -> Vec<CameraDevice> {
    vec![CameraDevice {
        id: "z6iii".into(),
        name: "Nikon Z6III".into(),
        model: "Z6III".into(),
        connection: "mock".into(),
    }]
}

#[tauri::command]
fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    mock_photos()
        .into_iter()
        .filter(|photo| photo.camera_id == camera_id)
        .collect()
}

#[tauri::command]
fn set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String> {
    let request = RatingRequest { photo_id, rating };

    if request.rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    let mut photo = mock_photos()
        .into_iter()
        .find(|photo| photo.id == request.photo_id)
        .ok_or_else(|| "Photo not found.".to_string())?;
    photo.rating = request.rating;
    Ok(photo)
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

fn mock_photos() -> Vec<CameraPhoto> {
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
        },
    ]
}
