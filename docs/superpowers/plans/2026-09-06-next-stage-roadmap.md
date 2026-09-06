# Nikon Connector Next Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Nikon Connector into a distributable macOS app that can progressively browse large Nikon Z6III cards with low first-photo latency and a reliable cull-then-export workflow.

**Architecture:** Keep the existing Tauri + React + Rust + Swift/ImageCaptureCore split. Package the Swift helper as an app sidecar, then move photo enumeration from whole-result IPC to progress batches across Swift -> Rust -> Tauri events -> React. Make catalog enumeration metadata-light and load thumbnails, display previews, and EXIF on demand.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vite, Tailwind CSS, Rust, Swift, ImageCaptureCore, ImageIO, Vitest, Cargo tests, Swift Package Manager.

**Spec:** `TODO.md`

## Global Constraints

- macOS is the primary supported platform for real-camera access.
- Preserve the existing `CameraPhoto` frontend contract where practical; introduce explicit additive fields for progressive metadata state when needed.
- Keep one long-lived camera/PTP session and serialize camera operations.
- Preserve `NIKON_CAMERA_HELPER` as a development/diagnostic override.
- Local rating and Pick/Reject must remain usable while Nikon SDK rating write-back is unavailable.
- Avoid adding new product surface until release packaging and native streaming are stable.

---

## File Structure

Primary files expected to change across this stage:

- `src-tauri/tauri.conf.json` — bundle the Swift helper sidecar.
- `package.json` / `scripts/release.mjs` — build and verify the release helper before Tauri packaging.
- `src-tauri/src/camera/helper_bridge.rs` — resolve packaged helper path and forward progress.
- `src-tauri/src/camera/helper_daemon.rs` — expose progress messages from NDJSON instead of discarding them.
- `native/macos-camera-helper/Sources/NikonCameraHelper/Daemon.swift` — emit incremental `list-photos` progress messages.
- `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift` — split lightweight catalog enumeration from thumbnail, preview, and metadata loading.
- `src-tauri/src/lib.rs` — bridge native batches into Tauri `photos:batch` events.
- `src/lib/cameraApi.ts` — keep one stable streaming API for the frontend.
- `src/features/app/useCameraSession.ts` — merge progressive catalog, thumbnail, preview, and metadata updates.
- `.github/workflows/ci.yml` — run JS, Rust, and Swift checks.
- `docs/release.md` — document sidecar packaging and release verification.

---

### Task 1: Package the Swift helper as a Tauri sidecar

**Files:**
- Modify: `package.json`
- Modify: `scripts/release.mjs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `docs/release.md`

**Interfaces:**
- Consumes: existing `NIKON_CAMERA_HELPER` override and Swift helper executable.
- Produces: a packaged helper path usable from an installed `.app` / DMG.

- [ ] **Step 1: Add a failing release-helper verification test**

Extend `scripts/release.test.mjs` with a test for a helper artifact resolver/validator that fails when the expected release helper is absent.

- [ ] **Step 2: Run the release script tests and verify failure**

Run:

```bash
bun test scripts/release.test.mjs
```

Expected: the new helper verification test fails because release helper packaging is not implemented.

- [ ] **Step 3: Add a release helper build command**

Add a script that compiles the Swift helper for `arm64-apple-macosx14.0` using release optimization into a deterministic Tauri sidecar location, for example:

```text
src-tauri/binaries/nikon-camera-helper-aarch64-apple-darwin
```

Keep the current development helper command intact for local debugging.

- [ ] **Step 4: Declare the sidecar in Tauri config**

Add the helper as an external binary in `src-tauri/tauri.conf.json` using the Tauri 2 sidecar naming convention.

- [ ] **Step 5: Resolve the packaged helper at runtime**

Update `helper_bridge.rs` resolution order to:

```text
NIKON_CAMERA_HELPER override
-> packaged Tauri sidecar/resource path
-> development .build/debug helper
```

Return an actionable error that includes all searched locations when resolution fails.

- [ ] **Step 6: Make packaging build and verify the helper first**

Update `release:package` so the sequence is:

```text
frontend checks
Rust/Swift tests
release helper build
helper artifact verification
Tauri DMG build
final app-bundle helper presence verification
```

- [ ] **Step 7: Run automated checks**

Run:

```bash
bun run check
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper
```

Expected: all pass.

- [ ] **Step 8: Build an app bundle and inspect the helper**

Run:

```bash
bun run release:build -- --bundles app
```

Expected: the resulting `.app` contains the helper and Rust resolves it without source-tree paths.

- [ ] **Step 9: Commit**

```bash
git add package.json scripts/release.mjs scripts/release.test.mjs src-tauri/tauri.conf.json src-tauri/src/camera/helper_bridge.rs docs/release.md
git commit -m "build: package camera helper as tauri sidecar"
```

---

### Task 2: Expose native NDJSON progress messages in Rust

**Files:**
- Modify: `src-tauri/src/camera/helper_daemon.rs`
- Modify: `src-tauri/src/camera/helper_bridge.rs`

**Interfaces:**
- Consumes: NDJSON messages `{ id, type, payload }` from Swift.
- Produces: terminal result plus zero or more progress payloads for the matching request ID.

- [ ] **Step 1: Add failing Rust tests for progress delivery**

Add tests proving that:

```text
noise -> other id -> progress(id=2) -> progress(id=2) -> result(id=2)
```

returns both progress payloads in order before the terminal result.

- [ ] **Step 2: Run targeted Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml helper_daemon
```

Expected: FAIL because `progress` is currently skipped.

- [ ] **Step 3: Introduce a progress-aware request API**

Add a request variant similar to:

```rust
pub fn request_with_progress<T, P>(
    &self,
    helper: &Path,
    build: impl Fn(u64) -> String,
    on_progress: impl FnMut(P),
) -> Result<T, String>
```

Keep the existing `request<T>` wrapper for commands that only need a terminal result.

- [ ] **Step 4: Parse progress and terminal messages separately**

Refactor response classification so matching `type=progress` yields its payload to the callback and matching `type=result` completes the call.

- [ ] **Step 5: Run Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml helper_daemon
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/camera/helper_daemon.rs src-tauri/src/camera/helper_bridge.rs
git commit -m "refactor: expose camera helper progress messages"
```

---

### Task 3: Stream photo catalog batches directly from Swift

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/Daemon.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/Protocol.swift`
- Add/Modify tests under `native/macos-camera-helper/Tests/NikonCameraHelperTests/`

**Interfaces:**
- Consumes: `list-photos(cameraId, cacheDir)` request.
- Produces: repeated progress payloads containing photo batches, then a terminal payload containing completion/count information.

- [ ] **Step 1: Add Swift tests for catalog batching**

Extract a pure batching helper and test:

- empty catalog emits no photo batches and reports total `0`;
- 450 items with batch size `200` produces `200, 200, 50`;
- order is preserved.

- [ ] **Step 2: Run Swift tests and verify failure**

Run:

```bash
swift test --package-path native/macos-camera-helper
```

Expected: FAIL until batching helper exists.

- [ ] **Step 3: Split lightweight catalog mapping from expensive enrichment**

Create a path that maps `ICCameraFile` to a minimal `CameraPhoto` without requesting metadata and without caching thumbnails/previews.

Required initial fields:

```text
id
cameraId
fileName
capturedAt
rating=0
fileType
width
height
sizeMb
objectHandle
storageId
canDownloadOriginal
hasEmbeddedPreview
```

Leave EXIF and cached URLs empty at this stage.

- [ ] **Step 4: Emit progress batches from the daemon**

For `list-photos`, emit progress messages as soon as catalog batches are available, then emit a terminal result with the final count.

- [ ] **Step 5: Run Swift tests**

Run:

```bash
swift test --package-path native/macos-camera-helper
```

Expected: PASS.

- [ ] **Step 6: Verify one-shot helper compatibility**

Run the documented argv-mode commands to ensure daemon changes do not break direct helper diagnostics.

- [ ] **Step 7: Commit**

```bash
git add native/macos-camera-helper
git commit -m "perf: stream lightweight photo catalog from helper"
```

---

### Task 4: Forward Swift progress batches to React immediately

**Files:**
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `src-tauri/src/camera/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/cameraApi.ts`
- Modify tests around `cameraApi` / photo streaming.

**Interfaces:**
- Consumes: progress-aware helper `list-photos`.
- Produces: `photos:batch` Tauri events while the native command is still running, plus a started/completed status.

- [ ] **Step 1: Add a failing Rust test for progress forwarding shape**

Test the conversion from helper progress payload to `PhotoBatchEvent` and completion state.

- [ ] **Step 2: Replace whole-vector `list_photos` bridge**

Remove the path where Rust waits for `Vec<CameraPhoto>` and then chunks it. Forward each helper batch directly through `app.emit("photos:batch", ...)`.

- [ ] **Step 3: Preserve empty-card completion semantics**

Ensure React receives a terminal `done=true` signal even when total photos is `0`.

- [ ] **Step 4: Update frontend tests**

Verify `streamPhotos()` still subscribes before invoking and merges multiple batches in order.

- [ ] **Step 5: Run checks**

Run:

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/camera src-tauri/src/lib.rs src/lib/cameraApi.ts src/lib/cameraApi.test.ts src/features/photos/photoStream.ts src/features/photos/photoStream.test.ts
git commit -m "perf: forward native photo stream to ui"
```

---

### Task 5: Make thumbnails and previews viewport-driven only

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `src/features/photos/previewQueue.ts`
- Modify: `src/features/app/useCameraSession.ts`
- Modify related tests.

**Interfaces:**
- Consumes: lightweight catalog and frontend visible-window requests.
- Produces: cached thumbnail/preview updates only for requested IDs.

- [ ] **Step 1: Add tests proving catalog enumeration does not pre-cache the first 80 files**

Move cache selection into request-specific code so the test can assert that `listPhotos` performs zero image cache work.

- [ ] **Step 2: Remove `maxInitialCachedFiles` behavior from catalog enumeration**

`listPhotos()` should only enumerate.

- [ ] **Step 3: Keep selected preview highest priority**

Ensure `previewQueue` orders work as:

```text
selected display preview
visible thumbnails
nearby thumbnails
small selected-photo lookahead previews
```

- [ ] **Step 4: Verify rapid navigation cancellation**

Keep the generation guard and trailing debounce; add/retain tests showing obsolete preview batches do not update the catalog.

- [ ] **Step 5: Run JS and Swift tests**

Run:

```bash
bun run test
swift test --package-path native/macos-camera-helper
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native/macos-camera-helper src/features/photos src/features/app/useCameraSession.ts
git commit -m "perf: drive image caching from visible review window"
```

---

### Task 6: Load EXIF metadata lazily

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/Command.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/Protocol.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/cameraApi.ts`
- Modify: `src/features/app/useCameraSession.ts`
- Modify: `src/features/photos/catalog.ts`

**Interfaces:**
- Produces a new metadata request for one or more photo IDs and merges normalized shooting metadata into existing catalog rows.

- [ ] **Step 1: Add tests for metadata merge semantics**

Verify metadata updates never erase preview URLs, rating, or Pick/Reject state.

- [ ] **Step 2: Add a native `get-photo-metadata` command**

Support batched photo IDs to reduce IPC overhead while keeping selected photo first.

- [ ] **Step 3: Trigger metadata for selected and visible photos**

Selected photo metadata loads immediately. Visible-window metadata can load at lower priority after thumbnails/previews.

- [ ] **Step 4: Remove full-card `shootingMetadataByFile` from `listPhotos`**

Catalog first-photo latency should no longer depend on metadata requests for every file.

- [ ] **Step 5: Run all three test suites**

Run:

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native/macos-camera-helper src-tauri src/lib/cameraApi.ts src/features/app/useCameraSession.ts src/features/photos/catalog.ts
git commit -m "perf: load shooting metadata on demand"
```

---

### Task 7: Add CI gates for JS, Rust, and Swift

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `docs/release.md`

**Interfaces:**
- Produces: PR-level automated validation for all three code layers.

- [ ] **Step 1: Add a macOS GitHub Actions workflow**

Run on pull requests and pushes to `main`:

```bash
bun install --frozen-lockfile
bun run check
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper
bun run helper:build:release
```

- [ ] **Step 2: Add helper artifact verification**

Verify the expected sidecar file exists after the release helper build.

- [ ] **Step 3: Document CI and local equivalents**

Keep `docs/release.md` aligned with workflow commands.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml docs/release.md
git commit -m "ci: validate frontend rust and swift layers"
```

---

### Task 8: Harden selective export

**Files:**
- Modify: native helper export protocol and store.
- Modify: Rust bridge/Tauri command.
- Modify: `src/lib/cameraApi.ts`.
- Modify: `src/features/app/useCameraSession.ts`.
- Modify: `src/features/photos/ExportPanel.tsx`.

**Interfaces:**
- Produces: export progress, cancellation, and final copied/skipped/failed result.

- [ ] **Step 1: Add tests for export progress state reduction**

Cover idle -> exporting -> progress -> complete/error and cancellation.

- [ ] **Step 2: Emit per-file export progress from Swift**

Progress payload should include at least:

```text
completed
total
copied
skipped
failed
currentFileName
```

- [ ] **Step 3: Forward progress to React**

Use a dedicated Tauri event and ignore stale export generations.

- [ ] **Step 4: Add cancel support**

Cancellation should stop scheduling subsequent file downloads after the current ImageCaptureCore operation reaches a safe boundary.

- [ ] **Step 5: Add “Show in Finder” after success**

Use the existing Tauri opener/process capability rather than shell-string construction.

- [ ] **Step 6: Run checks and commit**

```bash
bun run check
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper
git add .
git commit -m "feat: harden selective camera export"
```

---

### Task 9: Fix rating identity before Nikon SDK integration

**Files:**
- Modify: `src/features/photos/types.ts`
- Modify: `src/lib/cameraApi.ts`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/rating/mod.rs`
- Modify: `src-tauri/src/nikon_sdk/mod.rs`

**Interfaces:**
- Consumes: `{ cameraId, storageId, objectHandle, photoId, rating }`.
- Produces: a stable native identity contract that works for real camera photos.

- [ ] **Step 1: Add failing tests showing real photo IDs cannot be resolved through mock catalog lookup**

Codify the current bug before changing the API.

- [ ] **Step 2: Change rating request shape**

Use:

```ts
interface SetPhotoRatingRequest {
  cameraId: string;
  storageId?: string;
  objectHandle?: string;
  photoId: string;
  rating: Rating;
}
```

- [ ] **Step 3: Remove `camera::find_photo()` from the real rating path**

The Nikon SDK adapter should receive native identity directly.

- [ ] **Step 4: Preserve local-only fallback**

When SDK write-back capability is false, React keeps the local rating and reports the local-only state.

- [ ] **Step 5: Run JS/Rust tests and commit**

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
git add src src-tauri
git commit -m "refactor: use real camera identity for ratings"
```

---

## Final Verification

After Tasks 1–9:

- [ ] Run `bun run check`.
- [ ] Run `bun run test`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `swift test --package-path native/macos-camera-helper`.
- [ ] Build an app bundle and DMG.
- [ ] Confirm the packaged app contains the Swift sidecar.
- [ ] On real Z6III hardware, test cold start, reconnect, 2000+ photo card, rapid navigation, JPG, NEF, RAW+JPG, rating/pick persistence, and selective export.
- [ ] Record measured timings for camera detection, first catalog batch, first thumbnail, first display preview, and cached photo switching.

Target the first four roadmap items as the v0.2.0 gate: packaged sidecar, real native streaming, lightweight catalog/lazy enrichment, and CI/real-camera regression baseline.
