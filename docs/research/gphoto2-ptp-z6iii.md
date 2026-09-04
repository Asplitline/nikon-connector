# gphoto2 PTP Backend Probe: Nikon Z6III

## Purpose

Evaluate whether the app should add a libgphoto2/PTP backend for Nikon Z6III
USB access, and record the real-device behavior observed on macOS.

## Summary

The Nikon Z6III is visible at the USB layer and gphoto2 can identify it as a
PTP camera. The route is viable, but it is not equivalent to reading a mounted
local disk. PTP access has camera session overhead, macOS may claim the device
through Image Capture services, and every backend must serialize access through
one camera session.

The practical design is a second native backend inside the same app:

- Keep the Tauri/React application as the only user-facing app.
- Keep the existing TypeScript camera API contract stable.
- Add a macOS native gphoto2 helper or libgphoto2 bridge behind the Rust camera
  provider boundary.
- Use one long-lived PTP session per connected camera.
- Queue all list, thumbnail, preview, export, and future capture/rating
  operations through that session.
- Use thumbnails for the grid/list and fetch a larger image only for the
  currently selected main preview.

## Hardware Verification

Environment:

- Camera: Nikon Z6III reported as `NIKON DSC Z6_3`
- macOS host with Homebrew gphoto2 2.5.32
- libgphoto2 2.5.34

USB layer:

```text
USB Product Name = "NIKON DSC Z6_3"
USB Vendor Name = "NIKON"
idVendor = 1200
USB Serial Number = "0000008042479"
```

gphoto2 detection:

```text
Model          Port
Nikon Z6 III   usb:000,001
```

gphoto2 summary:

```text
Manufacturer: Nikon Corporation
Model: Z6_3
Version: V2.00
Storage: NIKON Z6_3 [Slot 1]
Battery Level: 80%
USB Speed: USB 2.0
```

Measured commands:

```text
gphoto2 --summary                                      1.11s
gphoto2 --list-folders                                11.43s
gphoto2 --folder /store_00010001/DCIM/100NZ6_3 --list-files
                                                       11.76s for 2477 files
gphoto2 --folder /store_00010001/DCIM/100NZ6_3 --get-thumbnail 1
                                                       11.20s for 8.7KB
gphoto2 --folder /store_00010001/DCIM/100NZ6_3 --get-thumbnail 1-10
                                                       11.29s for 10 thumbnails
gphoto2 --folder /store_00010001/DCIM/100NZ6_3 --get-file 1
                                                       11.72s for 8.3MB JPG
```

Interpretation:

- Single-image calls are dominated by session startup/object lookup cost, not
  by file size.
- Batched thumbnails amortize the fixed cost well.
- A gphoto2 command-per-preview architecture would still feel slow.
- A long-lived helper process or direct libgphoto2 binding is the required
  architecture for good interaction latency.

## macOS Device Claiming

When Image Capture or the macOS PTP service owns the device, gphoto2 fails with:

```text
Could not claim the USB device
Make sure no other program (MacOS PTPCamera service) ... is using the device
```

Observed behavior:

- `gphoto2 --auto-detect` can still identify the camera while macOS owns it.
- Real operations such as `--summary` and `--list-folders` fail until the
  Image Capture session releases the device.
- `launchctl bootout gui/$(id -u)/com.apple.ptpcamerad` is blocked by SIP.
- Quitting Image Capture allowed gphoto2 to claim the camera in this test.

Application implications:

- Do not run the ImageCapture backend and gphoto2 backend concurrently.
- Surface a clear diagnostic when libgphoto2 cannot claim the device.
- If Image Capture is open, tell the user to quit it before switching to the
  gphoto2 backend.
- Keep the existing ImageCapture troubleshooting copy for the current backend,
  but add a separate message for PTP backend contention.

## Backend Comparison

### Current ImageCaptureCore Backend

Strengths:

- Native macOS framework.
- Already integrated.
- Works with Tauri asset cache.
- Does not require bundling gphoto2.

Weaknesses:

- Preview behavior is controlled by ImageCaptureCore.
- It can be slow when many camera objects are present.
- It may request larger representations than the UI needs unless carefully
  constrained.
- Fine-grained control over Nikon-specific PTP operations is limited.

### gphoto2/libgphoto2 Backend

Strengths:

- Open-source PTP/MTP implementation with Nikon Z6III support.
- Exposes Nikon properties, storage, thumbnails, files, capture, and liveview
  capabilities.
- Better fit for a persistent camera session and custom request queue.
- Can support future Nikon-specific operations without waiting for
  ImageCaptureCore behavior.

Weaknesses:

- Needs bundling, codesigning, and architecture handling for macOS app builds.
- Must avoid conflicts with Image Capture and `ptpcamerad`.
- Command-line process spawning is too expensive for per-image operations.
- A robust implementation should use a long-lived helper or direct library
  binding, not one `gphoto2` invocation per request.

## Recommended Architecture

Add a provider selector behind `src-tauri/src/camera/mod.rs`.

```text
React UI
  -> src/lib/cameraApi.ts
  -> Tauri commands in src-tauri/src/lib.rs
  -> src-tauri/src/camera/mod.rs provider boundary
      -> ImageCapture helper backend
      -> gphoto2 PTP helper backend
      -> mock backend for non-macOS/browser development
```

The gphoto2 backend should be one persistent helper process:

```text
Rust camera provider
  -> start helper once per app session
  -> send JSONL requests over stdin
  -> read JSONL responses from stdout
  -> serialize all requests through one worker queue
  -> restart helper on camera disconnect or unrecoverable PTP errors
```

Initial helper commands:

```text
list-cameras
list-photos --camera-id <id>
cache-photo-previews --camera-id <id> --photo-id <id>... --preview-photo-id <id>...
export-photos --camera-id <id> --destination-dir <path> --photo-id <id>...
diagnose-camera --camera-id <id>
shutdown
```

The frontend contract should not change:

- `listCameras()`
- `listPhotos(cameraId)`
- `cachePhotoPreview(cameraId, photoId)`
- `cachePhotoPreviews(cameraId, photoIds, { previewPhotoIds })`
- `exportPhotos(request)`
- `setPhotoRating(photoId, rating)`

## Relative Best Path

The relative optimum is not to keep tuning ImageCaptureCore indefinitely, and
not to replace the whole app with another tool. The best path is a layered
backend strategy inside the same Tauri app:

1. Keep ImageCaptureCore as the default backend for the current working build.
2. Add libgphoto2 as an opt-in backend with a native helper that links
   `libgphoto2` directly.
3. Avoid using the `gphoto2` CLI as the production data path except for
   diagnostics and early smoke tests.
4. Keep the helper process alive while the app is browsing a camera, and close
   the session only when the user disconnects, switches backend, exports, or
   quits.
5. Treat Nikon Remote Module SDK 2.0.0 as a later vendor-SDK track for camera
   control and rating/capture capabilities, not as the fastest near-term fix for
   gallery browsing.

Rationale:

- Nikon's official SDK information says Remote Module SDK 2.0.0 is the unified
  current path for Z-series cameras including Z6III, but the SDK is not present
  in this repository and its rating/write-back behavior still needs direct
  header and hardware verification.
- gphoto2 already identifies this physical Z6III and reports file thumbnail,
  preview, capture, trigger capture, configuration, and delete capabilities.
- Direct libgphoto2 linking is available locally through `pkg-config`:

```text
-I/opt/homebrew/Cellar/libgphoto2/2.5.34/include
-L/opt/homebrew/Cellar/libgphoto2/2.5.34/lib -lgphoto2 -lgphoto2_port -lm
```

- The CLI measurements show a large fixed startup/session/object-listing cost.
  That makes command spawning the wrong production architecture, but strongly
  supports a persistent helper using the libgphoto2 C API.
- Current ImageCaptureCore code opens and closes sessions per helper command.
  This is simple and native, but it leaves limited control over request ordering,
  preview size, and camera-specific PTP behavior.

Decision matrix:

| Option | Expected UX | Engineering Cost | Packaging Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Keep only ImageCaptureCore | Usable but likely still visibly sticky on large cards | Low | Low | Good fallback, not enough as the final performance path |
| Spawn `gphoto2` CLI per request | Poor for interaction because each command pays fixed PTP cost | Low | Medium | Diagnostics only |
| Persistent CLI shell wrapper | Better batching, but brittle parsing and weak error boundaries | Medium | Medium | Prototype only |
| Persistent helper linked to libgphoto2 | Best balance of control, performance, and app integration | Medium-high | Medium | Recommended |
| Nikon Remote Module SDK 2.0.0 first | Potentially best vendor integration, but blocked by SDK availability and verification | High | High | Parallel research track, not first implementation |
| Card-reader/import-first workflow | Fastest browsing after import, but changes product workflow | Low-medium | Low | Optional fallback mode, not primary camera-browse UX |

The recommended implementation order is:

1. Finish the current ImageCaptureCore UX safeguards: camera power/awake copy,
   PTP contention diagnostics, thumbnail-only grid, and selected-preview queue.
2. Add a gphoto2 backend selector and diagnostic probe.
3. Build a small C or Swift/C helper that links libgphoto2 directly and exposes
   JSONL commands to Rust.
4. Keep one `Camera *` and `GPContext *` alive for the connected camera.
5. List folders/files once, store an in-memory object index, and update it on
   reconnect or explicit rescan.
6. Batch thumbnail downloads using `GP_FILE_TYPE_PREVIEW` for grid rows.
7. Fetch `GP_FILE_TYPE_NORMAL` only for explicit export or selected-photo
   high-resolution preview when no smaller usable preview exists.
8. Compare measured app latency with the same 2477-file card before switching
   the default backend.

## Native API Notes

The libgphoto2 API exposes the primitives needed by the helper:

- `gp_camera_init` opens or reopens the camera session.
- `gp_camera_exit` closes the session and releases access for other apps.
- `gp_camera_folder_list_files` lists camera objects in a folder.
- `gp_camera_file_get_info` reads object metadata.
- `gp_camera_file_get` retrieves preview or normal file data.
- `GP_FILE_TYPE_PREVIEW` maps to a smaller preview/thumbnail path.
- `GP_FILE_TYPE_NORMAL` maps to the full original file.
- `gp_camera_capture_preview` is for live camera preview, not browsing an
  already-shot card image.

This means the app should separate two concepts:

- Card browsing preview: use `gp_camera_file_get(..., GP_FILE_TYPE_PREVIEW)`.
- Live view preview: use `gp_camera_capture_preview`, only if the product later
  adds tethered shooting.

Z6III also exposes a writable `Thumb Size` config with `normal` and `large`.
For this app, keep it at `normal` for browsing unless hardware tests prove that
`large` materially improves selected previews without hurting grid latency.

## UX Requirements

Connection diagnostics should distinguish these states:

- Camera is not connected.
- Camera is connected but powered off or asleep.
- Camera is connected and visible to macOS but storage cannot be read.
- Image Capture is open and owns the PTP camera.
- gphoto2/libgphoto2 cannot claim the USB interface.
- Camera object enumeration succeeded but previews are still caching.

Preview behavior:

- The main preview may request a larger image.
- The bottom list/grid must use thumbnails only.
- The app must never request full-size images for every visible row.
- Prefetch only the selected photo and a small near-neighbor window.
- Cancel or deprioritize stale preview work when selection changes.

## Rollout Plan

1. Keep ImageCaptureCore as the default backend.
2. Add a hidden `NIKON_CAMERA_BACKEND=gphoto2` environment switch.
3. Implement the gphoto2 helper as a persistent process.
4. Verify discovery, folder listing, thumbnail batching, main preview fetching,
   and export on the physical Z6III.
5. Add UI diagnostics for PTP contention.
6. Compare app interaction latency between ImageCaptureCore and gphoto2 on the
   same 2477-file card.
7. Decide whether gphoto2 should become the default backend for Nikon cameras.

## References

- gPhoto supported cameras: https://www.gphoto.org/proj/libgphoto2/support.php
- gPhoto macOS USB claiming issue: https://github.com/gphoto/gphoto2/issues/562
- gPhoto `Could not claim the USB device` example: https://github.com/gphoto/gphoto2/issues/665
- Nikon Camera Controller using gPhoto2: https://github.com/afkal/nikon-camera-controller
