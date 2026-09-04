use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};

use super::types::{CachedPhotoPreview, CameraDevice, CameraPhoto, ExportPhotosSummary};

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

pub fn cache_photo_previews(
    camera_id: &str,
    photo_ids: &[String],
    preview_photo_ids: &[String],
    cache_dir: &Path,
) -> Result<Vec<CachedPhotoPreview>, String> {
    let cache_dir = cache_dir
        .to_str()
        .ok_or_else(|| "Camera cache path is not valid UTF-8.".to_string())?;
    let mut args = vec![
        "cache-photo-previews",
        "--camera-id",
        camera_id,
        "--cache-dir",
        cache_dir,
    ];

    for photo_id in photo_ids {
        args.push("--photo-id");
        args.push(photo_id);
    }
    for photo_id in preview_photo_ids {
        args.push("--preview-photo-id");
        args.push(photo_id);
    }

    run_helper(&args)
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
    let helper = helper_path()?;
    let start = Instant::now();
    eprintln!(
        "[nikon-connector] running helper path={} args={:?}",
        helper.display(),
        args
    );
    let output = Command::new(&helper)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run nikon-camera-helper: {error}"))?;
    let elapsed = start.elapsed();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    eprintln!(
        "[nikon-connector] helper finished status={} elapsed_ms={} stdout_bytes={} stderr_bytes={}",
        output.status,
        elapsed.as_millis(),
        output.stdout.len(),
        output.stderr.len()
    );
    if !stderr.is_empty() {
        eprintln!("[nikon-connector] helper stderr:\n{stderr}");
    }

    if !output.status.success() {
        return Err(if stderr.is_empty() {
            format!("nikon-camera-helper exited with status {}.", output.status)
        } else {
            stderr
        });
    }

    serde_json::from_slice(&output.stdout).map_err(|error| {
        format!(
            "Invalid nikon-camera-helper response: {error}. stdout={}",
            truncate_for_log(&stdout, 500)
        )
    })
}

fn truncate_for_log(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }

    format!("{}...", value.chars().take(max_chars).collect::<String>())
}
