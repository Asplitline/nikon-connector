use std::{
    env,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Instant,
};

use super::helper_daemon::{HelperDaemon, HelperRequest};
use super::types::{CachedPhotoPreview, CameraDevice, CameraPhoto, ExportPhotosSummary};

// 全进程一个常驻 helper：固定开销（设备扫描 + 打开会话 + 等目录，实测 3~8s）
// 只在首次请求时付一次，之后每条请求只付真实数据传输的时间。
fn daemon() -> &'static HelperDaemon {
    static DAEMON: OnceLock<HelperDaemon> = OnceLock::new();
    DAEMON.get_or_init(HelperDaemon::new)
}

pub fn shutdown() {
    daemon().shutdown();
}

pub fn list_cameras() -> Result<Vec<CameraDevice>, String> {
    send("list-cameras", |id| {
        serialize(HelperRequest::new(id, "list-cameras"))
    })
}

#[allow(dead_code)]
pub fn list_photos(camera_id: &str, cache_dir: &Path) -> Result<Vec<CameraPhoto>, String> {
    let cache_dir = cache_dir_str(cache_dir)?;

    send("list-photos", |id| {
        let mut request = HelperRequest::new(id, "list-photos");
        request.camera_id = Some(camera_id);
        request.cache_dir = Some(cache_dir);
        serialize(request)
    })
}

pub fn cache_photo_previews(
    camera_id: &str,
    photo_ids: &[String],
    preview_photo_ids: &[String],
    cache_dir: &Path,
) -> Result<Vec<CachedPhotoPreview>, String> {
    let cache_dir = cache_dir_str(cache_dir)?;

    send("cache-photo-previews", |id| {
        let mut request = HelperRequest::new(id, "cache-photo-previews");
        request.camera_id = Some(camera_id);
        request.cache_dir = Some(cache_dir);
        request.photo_ids = Some(photo_ids);
        request.preview_photo_ids = Some(preview_photo_ids);
        serialize(request)
    })
}

pub fn export_photos(
    camera_id: &str,
    photo_ids: &[String],
    destination_dir: &Path,
) -> Result<ExportPhotosSummary, String> {
    let destination_dir = destination_dir
        .to_str()
        .ok_or_else(|| "Export destination path is not valid UTF-8.".to_string())?;

    send("export-photos", |id| {
        let mut request = HelperRequest::new(id, "export-photos");
        request.camera_id = Some(camera_id);
        request.destination_dir = Some(destination_dir);
        request.photo_ids = Some(photo_ids);
        serialize(request)
    })
}

fn cache_dir_str(cache_dir: &Path) -> Result<&str, String> {
    cache_dir
        .to_str()
        .ok_or_else(|| "Camera cache path is not valid UTF-8.".to_string())
}

fn serialize(request: HelperRequest<'_>) -> String {
    // 请求结构固定可序列化；真出错也只能退化成一条必然被 helper 拒绝的空请求
    serde_json::to_string(&request).unwrap_or_else(|_| "{}".to_string())
}

fn send<T>(label: &str, build: impl Fn(u64) -> String) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    let helper = helper_path()?;
    let start = Instant::now();

    let result = daemon().request::<T>(&helper, build);

    eprintln!(
        "[nikon-connector] helper cmd={label} elapsed_ms={} ok={}",
        start.elapsed().as_millis(),
        result.is_ok()
    );

    result
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
