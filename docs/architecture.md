# Nikon Connector Architecture

## Goal

Build a macOS desktop app for personal Nikon Z6III users to browse all photos
on the connected camera/card and apply official 0-5 star ratings.

## Stack

- Tauri 2 desktop shell
- React 19 + TypeScript + Vite frontend
- Tailwind CSS for styling
- Rust commands for native integration
- macOS ImageCaptureCore helper running as a persistent NDJSON daemon for
  camera/card enumeration and local thumbnail and preview caching, with mock
  fallback when the helper is unavailable or reports no cameras. The daemon
  holds one long-lived browser and camera session so the fixed
  ImageCaptureCore cost is paid once per app session, not once per request;
  all camera work is serialized because PTP sessions cannot run concurrently
- Optional future gphoto2/libgphoto2 PTP backend for Nikon cameras, gated behind
  `NIKON_CAMERA_BACKEND=gphoto2` until real-device app performance is verified
- Nikon Remote Module SDK 2.0.0 adapter shell for deferred rating write-back

## Milestone 1

The initialized app ships with a realistic mock provider and stable command
contracts:

- `list_cameras`
- `list_photos`
- `set_photo_rating`

The frontend already calls these commands through `src/lib/cameraApi.ts`. In a
browser it falls back to mock data; in Tauri it invokes Rust commands.

## Real-Camera Photo Mapping

PTP or ImageCaptureCore image objects map into `CameraPhoto` as follows:

- `id`: stable app id derived from camera id and object handle.
- `objectHandle`: provider object handle used for follow-up preview/download
  requests.
- `storageId`: camera storage id when the provider exposes one.
- `fileName`, `fileType`, `sizeMb`: object metadata from the camera.
- `capturedAt`: capture timestamp when available, otherwise import/list time.
- `previewUrl`, `thumbnailUrl`: local cached asset URLs after preview extraction.
- `canDownloadOriginal`: whether the app can request the original file.
- `hasEmbeddedPreview`: whether a camera/object preview is available without RAW
  decoding.

## Native Integration Status

1. Use `nikon-camera-helper` for macOS camera discovery. The Rust provider
   resolves `NIKON_CAMERA_HELPER` first, then the development helper build at
   `native/macos-camera-helper/.build/debug/nikon-camera-helper`.
2. Use ImageCaptureCore to enumerate supported image objects, return camera
   metadata, and cache thumbnails and previews locally for the frontend.
3. Keep the Nikon SDK adapter under `src-tauri/src/nikon_sdk/` disabled until
   a vendor-specific API is needed and verified.
4. Route `set_photo_rating` through the macOS helper and ImageCaptureCore PTP
   pass-through. The helper sends MTP `SetObjectPropValue` for object property
   `Rating` to the selected camera object.
5. Preserve the TypeScript `CameraPhoto` contract so UI code does not change.
6. Track the gphoto2/PTP backend as an opt-in provider inside the same Tauri app,
   not as a separate user-facing application. The backend must own one
   long-lived PTP session and serialize all camera operations because macOS
   Image Capture services can otherwise claim the USB device and per-command
   PTP startup costs are high.

## Rating Write-Back State

Camera-visible rating write-back is implemented through ImageCaptureCore PTP
pass-through rather than the Nikon SDK. The frontend sends `cameraId`,
`photoId`, and `rating`; Rust forwards the command to the long-lived macOS
helper; the helper locates the `ICCameraFile` and sends MTP
`SetObjectPropValue` for the `Rating` object property. If the camera rejects the
PTP command, the frontend rolls back the optimistic rating and shows the camera
error instead of treating the value as locally saved.

No Nikon Z6III USB device is available in this local environment. Discovery,
camera-card enumeration, thumbnail/preview caching, and PTP rating write-back
must therefore be verified on hardware before a release can claim real-device
confirmation.

## UX Direction

The UI follows the `.impeccable.md` context: quiet professional, photo-first,
with simple Apple Photos-style browsing. The first screen is the usable photo
review workspace, not a marketing page.
