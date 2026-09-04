use std::path::Path;

const SDK_VENDOR_DIR: &str = "vendor/NikonSDK";

pub fn rating_write_back_available() -> bool {
    // Keep this disabled until `src-tauri/vendor/NikonSDK/` contains the real
    // Nikon SDK and the exact Z6III rating API has been verified.
    let _ =
        expected_sdk_artifacts_present(Path::new(env!("CARGO_MANIFEST_DIR")).join(SDK_VENDOR_DIR));
    false
}

fn expected_sdk_artifacts_present(sdk_dir: impl AsRef<Path>) -> bool {
    let sdk_dir = sdk_dir.as_ref();
    sdk_dir.join("include/NikonSDK.h").is_file() && sdk_dir.join("lib/libNikonSDK.dylib").is_file()
}

pub fn set_rating(_photo_id: &str, rating: u8) -> Result<(), String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    Err("Nikon SDK rating write-back is not connected yet.".into())
}

#[cfg(test)]
mod tests {
    use super::{expected_sdk_artifacts_present, rating_write_back_available};
    use std::fs;

    #[test]
    fn sdk_artifact_probe_requires_header_and_library() {
        let root = unique_temp_dir("nikon-sdk-artifact-test");
        let include = root.join("include");
        let lib = root.join("lib");
        fs::create_dir_all(&include).unwrap();
        fs::create_dir_all(&lib).unwrap();

        assert!(!expected_sdk_artifacts_present(&root));

        fs::write(include.join("NikonSDK.h"), b"").unwrap();
        assert!(!expected_sdk_artifacts_present(&root));

        fs::write(lib.join("libNikonSDK.dylib"), b"").unwrap();
        assert!(expected_sdk_artifacts_present(&root));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rating_write_back_stays_disabled_until_api_is_confirmed() {
        assert!(!rating_write_back_available());
    }

    fn unique_temp_dir(prefix: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "{prefix}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&root);
        root
    }
}
