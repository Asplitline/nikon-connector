use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub connection: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraPhoto {
    pub id: String,
    pub camera_id: String,
    pub file_name: String,
    pub captured_at: String,
    pub rating: u8,
    pub file_type: String,
    pub width: u32,
    pub height: u32,
    pub size_mb: f32,
    pub preview_url: String,
    pub thumbnail_url: String,
    pub object_handle: Option<String>,
    pub storage_id: Option<String>,
    pub can_download_original: Option<bool>,
    pub has_embedded_preview: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPhotosSummary {
    pub copied: u32,
    pub skipped: u32,
    pub failed: u32,
}
