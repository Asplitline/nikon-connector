# ImageCaptureCore Z6III Bridge Notes

## Purpose

Use macOS ImageCaptureCore as the first real-device bridge for Nikon Z6III USB
photo browsing. This layer should discover the camera and enumerate media
objects before the Nikon SDK rating adapter is connected.

## Intended Flow

1. Ask ImageCaptureCore for connected camera devices.
2. Filter devices whose model/name indicates Nikon Z6III or another supported
   Nikon camera.
3. Request the camera contents tree.
4. Map image objects into the shared `CameraPhoto` contract.
5. Request thumbnails or previews and copy them into the Tauri app cache.
6. Return local preview URLs to the frontend.

## Provider Boundary

The Rust command layer must keep using:

- `list_cameras`
- `list_photos`
- `set_photo_rating`

The provider implementation can change behind `src-tauri/src/camera/mod.rs`
without changing `src/lib/cameraApi.ts`.

## Permission And Runtime States

The UI needs explicit states for:

- No camera connected.
- Camera connected but still loading contents.
- Camera connected but object enumeration failed.
- Preview unavailable for a specific photo.
- Rating write-back unsupported until Nikon SDK integration is present.

## Compilation Strategy

The first provider shell must compile without linking ImageCaptureCore. The real
bridge should be added behind a macOS-only module and tested on the physical
Z6III before becoming the default provider.

## Discovery Implementation

The macOS helper now uses `ICDeviceBrowser` to discover `ICCameraDevice`
instances for `list-cameras`, returning them with an `image_capture`
connection. Nikon and Z6 devices are ordered ahead of other cameras.

Hardware verification with a physical Z6III is deferred because no Z6III was
connected during implementation. The helper's no-camera behavior is verified
locally; connected-camera discovery and app sidebar verification remain pending.
