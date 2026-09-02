# Nikon Connector Architecture

## Goal

Build a macOS desktop app for personal Nikon Z6III users to browse all photos
on the connected camera/card and apply official 0-5 star ratings.

## Stack

- Tauri 2 desktop shell
- React 19 + TypeScript + Vite frontend
- Tailwind CSS for styling
- Rust commands for native integration
- macOS helper bridge for camera/card enumeration, with mock fallback when the
  helper is unavailable or reports no cameras
- Nikon Remote Module SDK 2.0.0 adapter shell for future rating write-back

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

## Native Integration Plan

1. Use `nikon-camera-helper` for macOS camera discovery. The Rust provider
   resolves `NIKON_CAMERA_HELPER` first, then the development helper build at
   `native/macos-camera-helper/.build/debug/nikon-camera-helper`.
2. Use ImageCaptureCore to enumerate supported image objects and return camera
   metadata. Preview and thumbnail extraction into the app cache will return
   local asset URLs in the next milestone.
3. Add a Nikon SDK adapter under `src-tauri/src/nikon_sdk/`.
4. Keep `set_photo_rating` on a clear unsupported path until the Nikon SDK
   exposes and verifies a camera-visible Z6III 0-5 star rating API.
5. Preserve the TypeScript `CameraPhoto` contract so UI code does not change.

## Rating Write-Back State

Official camera-visible rating write-back is not enabled yet. The SDK directory
is present as `src-tauri/vendor/NikonSDK/`, but no official SDK headers or
libraries are installed, so `rating_write_back_available()` returns `false`.
When a user applies a rating, the frontend performs an optimistic update and the
Tauri command returns the unsupported SDK error, causing the UI to roll back to
the previous rating instead of claiming the value was saved to the camera.

## UX Direction

The UI follows the `.impeccable.md` context: quiet professional, photo-first,
with simple Apple Photos-style browsing. The first screen is the usable photo
review workspace, not a marketing page.
