# Nikon SDK Bridge

Place the Nikon Remote Module SDK package for Z6III under:

```text
src-tauri/vendor/NikonSDK/
```

The repository does not currently contain any SDK files. The expected probe
artifacts are `include/NikonSDK.h` and `lib/libNikonSDK.dylib` below that
directory; the runtime capability check remains `false` until both exist.

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

The SDK version and rating API names are unconfirmed because the SDK files are
absent. Until an official API is identified and linked, `rating_write_back_available()`
returns `false`, `set_photo_rating` returns unsupported, and the frontend keeps
its rating rollback behavior active. Once the SDK is connected, `set_rating`
must translate the app photo id or object handle into the Nikon command/API
call that writes a camera-visible 0-5 star rating.

After installing the SDK, inspect its headers and samples with:

```bash
rg -n "rating|star|metadata|xmp|protect|attribute" src-tauri/vendor/NikonSDK
```
