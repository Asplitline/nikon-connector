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
