# Nikon SDK Bridge

Place the Nikon Remote Module SDK 2.0.0 package for Z6III under:

```text
src-tauri/vendor/NikonSDK/
```

The production bridge should expose the same command surface already used by
the frontend:

- `list_cameras`
- `list_photos(cameraId)`
- `set_photo_rating(photoId, rating)`

Current commands return mock data so the UI can be developed without a camera.
When the SDK is available, keep the frontend contract stable and replace the
mock provider behind these commands.

## Rating Adapter Contract

The compile-safe Rust shell lives at `src-tauri/src/nikon_sdk/mod.rs` and
exposes:

```rust
pub fn rating_write_back_available() -> bool;
pub fn set_rating(photo_id: &str, rating: u8) -> Result<(), String>;
```

Until the official Nikon SDK is linked, `rating_write_back_available()` returns
`false` and development rating changes stay in the mock provider response. Once
the SDK is connected, `set_rating` should translate the app photo id or object
handle into the Nikon command/API call that writes a 0-5 star rating to the
camera-visible metadata.
