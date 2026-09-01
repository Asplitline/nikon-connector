# Complete Camera Preview And Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining core product: connect a real Nikon Z6III on macOS, enumerate camera-card photos, show real thumbnails/previews, and write official 0-5 star ratings when the Nikon SDK exposes that capability.

**Architecture:** Keep the React UI and Tauri command contract stable. Add a macOS Swift helper executable for ImageCaptureCore and Nikon SDK work, then let Rust commands call that helper through a narrow JSON boundary with mock fallback for development.

**Tech Stack:** Tauri 2, Rust, Swift Package Manager, ImageCaptureCore, Nikon Remote Module SDK 2.0.0, React 19, TypeScript, Tailwind CSS, Bun, ESLint.

**Spec:** `docs/architecture.md`

## Global Constraints

- Use Bun for package management and scripts.
- Keep tests minimal; rely on `bun run lint`, `bun run build`, `cargo check`, and focused native smoke commands as the primary quality gates.
- Preserve the existing frontend command contract: `list_cameras`, `list_photos`, `set_photo_rating`.
- Nikon Z6III is the first supported hardware target.
- Do not require the Nikon SDK to compile until its files are present under `src-tauri/vendor/NikonSDK/`.
- Default preview mode must fit images inside the stage and keep all desktop panels visible.
- Do not store downloaded camera originals in the repo.

---

### Task 1: Native Helper Skeleton

**Files:**
- Create: `native/macos-camera-helper/Package.swift`
- Create: `native/macos-camera-helper/Sources/NikonCameraHelper/main.swift`
- Create: `native/macos-camera-helper/Sources/NikonCameraHelper/Command.swift`
- Create: `native/macos-camera-helper/Sources/NikonCameraHelper/Models.swift`
- Modify: `README.md`

**Interfaces:**
- Consumes: no app runtime state.
- Produces:
  - `nikon-camera-helper list-cameras`
  - `nikon-camera-helper list-photos --camera-id <id> --cache-dir <path>`
  - `nikon-camera-helper set-rating --photo-id <id> --rating <0-5>`
  - JSON output compatible with TypeScript `CameraDevice` and `CameraPhoto`.

- [ ] **Step 1: Create Swift package**

Create `native/macos-camera-helper/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NikonCameraHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "nikon-camera-helper", targets: ["NikonCameraHelper"])
    ],
    targets: [
        .executableTarget(
            name: "NikonCameraHelper",
            linkerSettings: [
                .linkedFramework("Foundation"),
                .linkedFramework("ImageCaptureCore")
            ]
        )
    ]
)
```

- [ ] **Step 2: Add JSON models**

Create `Models.swift` with:

```swift
import Foundation

struct CameraDevice: Codable {
    let id: String
    let name: String
    let model: String
    let connection: String
}

struct CameraPhoto: Codable {
    let id: String
    let cameraId: String
    let fileName: String
    let capturedAt: String
    let rating: Int
    let fileType: String
    let width: Int
    let height: Int
    let sizeMb: Double
    let previewUrl: String
    let thumbnailUrl: String
    let objectHandle: String?
    let storageId: String?
    let canDownloadOriginal: Bool?
    let hasEmbeddedPreview: Bool?
}

struct CommandError: Codable {
    let error: String
}
```

- [ ] **Step 3: Add command parser**

Create `Command.swift`:

```swift
enum Command {
    case listCameras
    case listPhotos(cameraId: String, cacheDir: String)
    case setRating(photoId: String, rating: Int)

    static func parse(_ args: [String]) throws -> Command {
        guard let name = args.first else { throw HelperError.message("Missing command.") }
        switch name {
        case "list-cameras":
            return .listCameras
        case "list-photos":
            return .listPhotos(
                cameraId: try value(after: "--camera-id", in: args),
                cacheDir: try value(after: "--cache-dir", in: args)
            )
        case "set-rating":
            let photoId = try value(after: "--photo-id", in: args)
            let ratingText = try value(after: "--rating", in: args)
            guard let rating = Int(ratingText), (0...5).contains(rating) else {
                throw HelperError.message("Rating must be between 0 and 5.")
            }
            return .setRating(photoId: photoId, rating: rating)
        default:
            throw HelperError.message("Unknown command: \(name).")
        }
    }

    private static func value(after flag: String, in args: [String]) throws -> String {
        guard let index = args.firstIndex(of: flag), args.indices.contains(index + 1) else {
            throw HelperError.message("Missing \(flag).")
        }
        return args[index + 1]
    }
}

enum HelperError: Error {
    case message(String)
}
```

- [ ] **Step 4: Add executable entry with compile-safe placeholder behavior**

Create `main.swift` that parses commands and returns empty camera/photo arrays or the explicit Nikon SDK unavailable error for rating.

- [ ] **Step 5: Verify helper builds**

Run:

```bash
swift build --package-path native/macos-camera-helper
swift run --package-path native/macos-camera-helper nikon-camera-helper list-cameras
```

Expected: build exits 0 and `list-cameras` prints `[]`.

- [ ] **Step 6: Commit**

```bash
git add native/macos-camera-helper README.md
git commit -m "feat: add macOS camera helper skeleton"
```

### Task 2: Rust Helper Bridge

**Files:**
- Create: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `src-tauri/src/camera/mod.rs`
- Modify: `src-tauri/src/camera/types.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: `nikon-camera-helper` executable path.
- Produces:
  - `helper_bridge::list_cameras() -> Result<Vec<CameraDevice>, String>`
  - `helper_bridge::list_photos(camera_id: &str, cache_dir: &Path) -> Result<Vec<CameraPhoto>, String>`
  - mock fallback when the helper returns no cameras or is missing.

- [ ] **Step 1: Add Rust deserialization**

Update `CameraDevice` and `CameraPhoto` in `src-tauri/src/camera/types.rs` to derive both `Serialize` and `Deserialize`:

```rust
use serde::{Deserialize, Serialize};
```

- [ ] **Step 2: Add helper bridge**

Create `helper_bridge.rs` using `std::process::Command` and `serde_json::from_slice` to decode helper output.

- [ ] **Step 3: Resolve helper path**

Implement `helper_path()` with this order:

1. `NIKON_CAMERA_HELPER` environment variable.
2. `native/macos-camera-helper/.build/debug/nikon-camera-helper` relative to repo root during development.
3. Return `Err("nikon-camera-helper not found.")`.

- [ ] **Step 4: Wire camera facade**

In `camera::list_cameras`, call `helper_bridge::list_cameras()` on macOS. If it returns a non-empty list, return it; otherwise return mock cameras. Keep `list_photos` mock-only until ImageCaptureCore enumeration is implemented in Task 3.

- [ ] **Step 5: Verify**

Run:

```bash
bun run lint
bun run build
cargo check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/camera src-tauri/Cargo.toml docs/architecture.md
git commit -m "feat: bridge Rust camera provider to native helper"
```

### Task 3: ImageCaptureCore Camera Discovery

**Files:**
- Create: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/main.swift`
- Modify: `docs/research/imagecapturecore-z6iii.md`

**Interfaces:**
- Consumes: ImageCaptureCore `ICDeviceBrowser`.
- Produces: real USB camera devices with `connection: "image_capture"`.

- [ ] **Step 1: Add camera browser delegate**

Create `ImageCaptureCameraStore.swift` with an `NSObject`, `ICDeviceBrowserDelegate` class that starts `ICDeviceBrowser`, waits up to 3 seconds, collects `ICCameraDevice` instances, then stops the browser.

- [ ] **Step 2: Map devices**

Map each `ICCameraDevice` to:

```swift
CameraDevice(
    id: device.persistentIDString ?? device.uuidString ?? device.name,
    name: device.name ?? "Nikon Camera",
    model: device.productKind ?? "Unknown",
    connection: "image_capture"
)
```

- [ ] **Step 3: Prefer Nikon devices**

Return all cameras, but sort entries whose name/model contains `Nikon` or `Z6` before other cameras.

- [ ] **Step 4: Wire `list-cameras`**

Update `main.swift` so `list-cameras` returns `ImageCaptureCameraStore().listCameras(timeout: 3.0)`.

- [ ] **Step 5: Verify without camera**

Run:

```bash
swift run --package-path native/macos-camera-helper nikon-camera-helper list-cameras
cargo check
```

Expected: command exits 0 and prints `[]` or a JSON camera list.

- [ ] **Step 6: Verify with Z6III**

Connect the Nikon Z6III by USB and run:

```bash
swift run --package-path native/macos-camera-helper nikon-camera-helper list-cameras
bun run tauri dev
```

Expected: helper JSON includes the camera and the app sidebar shows the real device as `USB connected`.

- [ ] **Step 7: Commit**

```bash
git add native/macos-camera-helper docs/research/imagecapturecore-z6iii.md
git commit -m "feat: discover Nikon cameras with ImageCaptureCore"
```

### Task 4: Real Photo Enumeration

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/main.swift`
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `src-tauri/src/camera/mod.rs`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: camera id from `list_cameras`.
- Produces: real `CameraPhoto[]` with object handles, filenames, type, size, and preview availability.

- [ ] **Step 1: Add contents request**

In the Swift helper, locate the requested `ICCameraDevice`, request contents, and wait until folders/items are available or 8 seconds elapse.

- [ ] **Step 2: Flatten camera media tree**

Walk `ICCameraFolder.contents` recursively and select `ICCameraItem` objects whose filename extension is `jpg`, `jpeg`, `nef`, `nrw`, `heif`, or `hif`.

- [ ] **Step 3: Map object metadata**

For each item, create `CameraPhoto`:

```swift
let id = "\(cameraId):\(item.name ?? item.uuidString ?? UUID().uuidString)"
let fileType = URL(fileURLWithPath: item.name ?? "").pathExtension.lowercased()
let sizeMb = Double(item.fileSize) / 1024.0 / 1024.0
```

Set unknown dimensions to `0` until thumbnail/preview metadata exposes them. Set `canDownloadOriginal: true` and `hasEmbeddedPreview` based on whether thumbnail/preview request succeeds in Task 5.

- [ ] **Step 4: Wire Rust `list_photos`**

Update `camera::list_photos` to call `helper_bridge::list_photos(camera_id, cache_dir)` on macOS, then fall back to mock photos only when the helper is missing or returns an empty list for the mock camera id.

- [ ] **Step 5: Verify with Z6III**

Connect a Z6III with at least one JPEG or NEF on the card and run:

```bash
swift run --package-path native/macos-camera-helper nikon-camera-helper list-photos --camera-id <observed-camera-id> --cache-dir /tmp/nikon-connector-cache
bun run tauri dev
```

Expected: helper prints JSON photo entries and the app shows real filenames.

- [ ] **Step 6: Verify static gates**

```bash
bun run check
cargo check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add native/macos-camera-helper src-tauri/src/camera docs/architecture.md
git commit -m "feat: enumerate camera-card photos"
```

### Task 5: Thumbnail And Preview Cache

**Files:**
- Create: `src-tauri/src/camera/cache.rs`
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: camera item handles from Task 4.
- Produces:
  - app cache directory under Tauri app cache path.
  - local preview/thumbnail file URLs returned in `CameraPhoto`.

- [ ] **Step 1: Add cache directory helper**

Create `src-tauri/src/camera/cache.rs` with `photo_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String>` that creates an app cache subdirectory named `photo-previews`.

- [ ] **Step 2: Pass app handle into command**

Change the Tauri `list_photos` command in `src-tauri/src/lib.rs` to accept `app: tauri::AppHandle` and pass the cache directory to `camera::list_photos`.

- [ ] **Step 3: Request thumbnails**

In the Swift helper, request a thumbnail for each image item, write it to `<cache-dir>/<safe-photo-id>-thumb.jpg`, and set `thumbnailUrl` to that file path or asset URL input expected by Rust.

- [ ] **Step 4: Request preview image**

For JPEG/HEIF files, request/download a screen-sized preview or original derivative into `<cache-dir>/<safe-photo-id>-preview.jpg`. For NEF files, use the embedded preview when ImageCaptureCore exposes one; otherwise set `hasEmbeddedPreview: false`.

- [ ] **Step 5: Convert paths to frontend-safe URLs**

Use Tauri asset serving or `convertFileSrc` on the frontend so local cache files render inside WebView. Keep remote Unsplash mock URLs only for mock provider photos.

- [ ] **Step 6: Verify**

Run with a Z6III connected:

```bash
bun run tauri dev
```

Expected: thumbnails and selected preview image render from local cache files. Disconnecting the camera does not delete already cached previews during the app session.

- [ ] **Step 7: Verify static gates**

```bash
bun run check
cargo check
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add native/macos-camera-helper src-tauri/src src/App.tsx
git commit -m "feat: cache camera thumbnails and previews"
```

### Task 6: Nikon SDK Rating Capability Probe

**Files:**
- Create: `docs/research/nikon-sdk-rating-z6iii.md`
- Modify: `src-tauri/src/nikon_sdk/README.md`
- Modify: `src-tauri/src/nikon_sdk/mod.rs`

**Interfaces:**
- Consumes: official SDK files under `src-tauri/vendor/NikonSDK/`.
- Produces: documented answer for whether Z6III supports official rating write-back through the SDK.

- [ ] **Step 1: Add SDK presence check**

Update `nikon_sdk::rating_write_back_available()` so it returns `true` only when required SDK header/library paths exist. Until exact paths are confirmed, return `false` and include a comment naming the expected vendor directory.

- [ ] **Step 2: Inspect SDK headers and samples**

After the SDK is placed under `src-tauri/vendor/NikonSDK/`, search headers and samples for rating/star/protect/metadata APIs:

```bash
rg -n "rating|star|metadata|xmp|protect|attribute" src-tauri/vendor/NikonSDK
```

- [ ] **Step 3: Document result**

Write `docs/research/nikon-sdk-rating-z6iii.md` with:

- exact SDK version.
- discovered header/API names.
- whether the API writes camera-visible 0-5 star ratings.
- unsupported fallback behavior if no official write-back API exists.

- [ ] **Step 4: Verify static gates**

```bash
bun run check
cargo check
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/research/nikon-sdk-rating-z6iii.md src-tauri/src/nikon_sdk
git commit -m "docs: record Nikon rating SDK capability"
```

### Task 7: Official Rating Write-Back

**Files:**
- Modify: `src-tauri/src/nikon_sdk/mod.rs`
- Modify: `src-tauri/src/rating/mod.rs`
- Modify: `src/App.tsx`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes:
  - `CameraPhoto.objectHandle`
  - Nikon SDK rating API confirmed in Task 6.
- Produces: `set_photo_rating(photo_id, rating)` writes a camera-visible 0-5 star rating or returns a clear unsupported error.

- [ ] **Step 1: Implement SDK call**

Use the exact SDK API confirmed in Task 6 inside `nikon_sdk::set_rating(photo_id, rating)`. Validate `rating <= 5` before calling the SDK.

- [ ] **Step 2: Preserve rollback behavior**

Keep the existing frontend optimistic update and rollback path in `handleRatingChange`. If SDK write-back fails, restore the previous rating and show the returned error message.

- [ ] **Step 3: Verify with camera and NX Studio**

With Z6III connected:

```bash
bun run tauri dev
```

Set a 1-5 star rating in the app. Then check the same photo in-camera or in Nikon NX Studio.

Expected: the rating is visible outside Nikon Connector.

- [ ] **Step 4: Verify unsupported mode**

Temporarily run without SDK files present and click a rating.

Expected: the app shows that Nikon SDK rating write-back is not connected and does not claim the rating was saved to the camera.

- [ ] **Step 5: Verify static gates**

```bash
bun run check
cargo check
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/nikon_sdk src-tauri/src/rating src/App.tsx docs/architecture.md
git commit -m "feat: write Nikon photo ratings through SDK"
```

### Task 8: Real-Device Polish And Release

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: verified real-device behavior from Tasks 3-7.
- Produces: documented user workflow and a release-ready branch.

- [ ] **Step 1: Document user setup**

Update `README.md` with:

```bash
bun install
bun run tauri dev
```

Add Z6III connection notes: USB cable, camera powered on, card inserted, and macOS permission prompts accepted.

- [ ] **Step 2: Update changelog**

Add under `CHANGELOG.md` `Unreleased`:

```markdown
### Added

- Real Nikon Z6III camera discovery.
- Camera-card photo enumeration.
- Local thumbnail and preview caching.
- Official Nikon SDK rating write-back when supported by the installed SDK.
```

- [ ] **Step 3: Run final verification**

```bash
bun run test
bun run check
bun run release:check
cargo check
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Push branch**

```bash
git push origin codex/real-camera-foundation
```

Expected: GitHub branch contains all completed commits.
