# Nikon Connector Architecture

## Goal

Build a macOS desktop app for personal Nikon Z6III users to browse all photos
on the connected camera/card and apply official 0-5 star ratings.

## Stack

- Tauri 2 desktop shell
- React 19 + TypeScript + Vite frontend
- Tailwind CSS for styling
- Rust commands for native integration
- Future macOS bridge to ImageCaptureCore for camera/card enumeration
- Future Nikon Remote Module SDK 2.0.0 adapter for rating write-back

## Milestone 1

The initialized app ships with a realistic mock provider and stable command
contracts:

- `list_cameras`
- `list_photos`
- `set_photo_rating`

The frontend already calls these commands through `src/lib/cameraApi.ts`. In a
browser it falls back to mock data; in Tauri it invokes Rust commands.

## Native Integration Plan

1. Add an ImageCaptureCore bridge for USB camera discovery and object listing.
2. Download previews or thumbnails into the app cache and return local asset
   URLs to the frontend.
3. Add a Nikon SDK adapter under `src-tauri/src/nikon_sdk/`.
4. Implement Z6III rating write-back behind `set_photo_rating`.
5. Preserve the TypeScript `CameraPhoto` contract so UI code does not change.

## UX Direction

The UI follows the `.impeccable.md` context: quiet professional, photo-first,
with simple Apple Photos-style browsing. The first screen is the usable photo
review workspace, not a marketing page.
