use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::Manager;

pub fn photo_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Could not resolve the app cache directory: {error}"))?;

    photo_cache_dir_from_base(&app_cache_dir)
}

fn photo_cache_dir_from_base(app_cache_dir: &Path) -> Result<PathBuf, String> {
    let cache_dir = app_cache_dir.join("photo-previews");
    fs::create_dir_all(&cache_dir)
        .map_err(|error| format!("Could not create photo preview cache: {error}"))?;
    Ok(cache_dir)
}

#[cfg(test)]
mod tests {
    use super::photo_cache_dir_from_base;

    #[test]
    fn creates_photo_previews_under_the_app_cache_directory() {
        let base =
            std::env::temp_dir().join(format!("nikon-connector-cache-test-{}", std::process::id()));
        let expected = base.join("photo-previews");

        let result = photo_cache_dir_from_base(&base).expect("cache directory is created");

        assert_eq!(result, expected);
        assert!(result.is_dir());
        std::fs::remove_dir_all(base).expect("test cache is removed");
    }
}
