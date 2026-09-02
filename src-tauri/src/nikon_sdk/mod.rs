use std::path::Path;

const SDK_VENDOR_DIR: &str = "vendor/NikonSDK";

pub fn rating_write_back_available() -> bool {
    // Keep this false unless the expected vendor directory contains both SDK artifacts.
    rating_write_back_available_at(Path::new(env!("CARGO_MANIFEST_DIR")).join(SDK_VENDOR_DIR))
}

fn rating_write_back_available_at(sdk_dir: impl AsRef<Path>) -> bool {
    let sdk_dir = sdk_dir.as_ref();
    sdk_dir.join("include/NikonSDK.h").is_file() && sdk_dir.join("lib/libNikonSDK.dylib").is_file()
}

pub fn set_rating(_photo_id: &str, _rating: u8) -> Result<(), String> {
    Err("Nikon SDK rating write-back is not connected yet.".into())
}

#[cfg(test)]
mod tests {
    use super::rating_write_back_available_at;
    use std::fs;

    #[test]
    fn sdk_probe_requires_header_and_library() {
        let root =
            std::env::temp_dir().join(format!("nikon-sdk-rating-test-{}", std::process::id()));
        let include = root.join("include");
        let lib = root.join("lib");
        fs::create_dir_all(&include).unwrap();
        fs::create_dir_all(&lib).unwrap();
        fs::write(include.join("NikonSDK.h"), b"").unwrap();
        fs::write(lib.join("libNikonSDK.dylib"), b"").unwrap();

        assert!(rating_write_back_available_at(&root));

        fs::remove_dir_all(root).unwrap();
    }
}
