use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

use super::types::{CameraDevice, CameraPhoto, ExportPhotosSummary};

pub fn list_cameras() -> Result<Vec<CameraDevice>, String> {
    run_helper(&["list-cameras"])
}

#[allow(dead_code)]
pub fn list_photos(camera_id: &str, cache_dir: &Path) -> Result<Vec<CameraPhoto>, String> {
    let cache_dir = cache_dir
        .to_str()
        .ok_or_else(|| "Camera cache path is not valid UTF-8.".to_string())?;

    run_helper(&[
        "list-photos",
        "--camera-id",
        camera_id,
        "--cache-dir",
        cache_dir,
    ])
}

pub fn export_photos(
    camera_id: &str,
    photo_ids: &[String],
    destination_dir: &Path,
) -> Result<ExportPhotosSummary, String> {
    let destination_dir = destination_dir
        .to_str()
        .ok_or_else(|| "Export destination path is not valid UTF-8.".to_string())?;
    let mut args = vec![
        "export-photos",
        "--camera-id",
        camera_id,
        "--destination-dir",
        destination_dir,
    ];

    for photo_id in photo_ids {
        args.push("--photo-id");
        args.push(photo_id);
    }

    run_helper(&args)
}

fn helper_path() -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("NIKON_CAMERA_HELPER") {
        return Ok(PathBuf::from(path));
    }

    let development_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("Cargo manifest directory has a parent")
        .join("native/macos-camera-helper/.build/debug/nikon-camera-helper");

    if development_path.is_file() {
        return Ok(development_path);
    }

    Err("nikon-camera-helper not found.".to_string())
}

fn run_helper<T>(args: &[&str]) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    let output = Command::new(helper_path()?)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run nikon-camera-helper: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("nikon-camera-helper exited with status {}.", output.status)
        } else {
            stderr
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Invalid nikon-camera-helper response: {error}"))
}
