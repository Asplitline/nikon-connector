# Nikon Connector Next Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Nikon Connector from a camera-only first-pass culling tool into a unified macOS photo browser where camera review stays fast and every local/downloaded/exported original can be inspected at native macOS preview quality.

**Architecture:** The next stage begins with a native preview engine embedded in the Tauri main window. React/Tauri remains the application shell; `QLPreviewView` becomes the authoritative local-original main preview, `QLThumbnailGenerator` handles local thumbnails, and the existing Swift ImageCaptureCore helper remains dedicated to camera/PTP access. One workspace can switch between Nikon Z6III and a local folder, camera items keep their identity when local copies are created, and normalized shooting metadata is shared across camera/local paths.

**Tech Stack:** Tauri 2, React 19, TypeScript, Rust, Swift, ImageCaptureCore, QuickLookUI, QuickLookThumbnailing, ImageIO, `objc2`, Vitest, Cargo tests, Swift Package Manager.

**Primary Specs:**

- `docs/superpowers/specs/2026-09-06-native-preview-engine-design.md`
- `docs/superpowers/specs/2026-09-06-source-switch-local-state-metadata-design.md`

**Detailed v0.2 Plans:**

- `docs/superpowers/plans/2026-09-06-native-preview-engine.md`
- `docs/superpowers/plans/2026-09-06-source-switch-local-state-metadata.md`

## Global Constraints

- Camera direct browsing remains optimized for fast first-pass culling.
- Finder Quick Look is the primary Native Quality implementation baseline; Preview.app is the comparison baseline.
- Once an original file is local, the main preview must not intentionally reduce quality through intermediate JPEG/PNG conversion.
- The native preview remains embedded inside Nikon Connector.
- Keep one review workspace across Z6III and Local Folder sources.
- Switching source must not disconnect a healthy Z6III session.
- A downloaded/exported camera photo remains the same camera item and gains visible local availability.
- Core metadata includes at least lens, focal length, aperture, shutter, ISO, capture time, and dimensions.
- Keep one long-lived camera/PTP session and serialize camera operations.
- Local rating and Pick/Reject remain usable while Nikon SDK rating write-back is unavailable.

---

## Phase 1 — v0.2.0 Native Photo Browser

### A. Native Preview Foundation

- [ ] Embed `QLPreviewView` in the existing Tauri window and validate JPG + Z6III NEF.
- [ ] Stabilize React placeholder -> AppKit native-view frame synchronization.
- [ ] Use `QLThumbnailGenerator` for local filmstrip thumbnails.
- [ ] Establish Finder Quick Look + Preview.app visual regression tests.

### B. Z6III / Local Folder Source Switching

- [ ] Add one source selector for connected Nikon Z6III and Local Folder.
- [ ] Switching to Local Folder opens a folder picker when needed.
- [ ] Valid symlink folders are supported and canonicalized for identity/cache deduplication.
- [ ] Switching back restores camera catalog selection/scroll/filter state.
- [ ] Switching away from camera does not disconnect the healthy camera session.

### C. Local Photo Browser

- [ ] Load JPG/JPEG, HEIC/HEIF, PNG, TIFF/TIF, NEF/NRW from a local folder.
- [ ] Reuse the existing review workspace, filmstrip virtualization, filter/sort, Pick/Reject, and rating flows.
- [ ] Selected local originals always route to Native Quality.

### D. Camera Item Local State

- [ ] Add `localState`: none / downloading / available / missing.
- [ ] Downloaded originals attach to the existing camera item.
- [ ] Exported originals attach to the existing camera item.
- [ ] Filmstrip shows a compact Local badge for `localState.available`.
- [ ] Inspector shows Cache / Exported path state.
- [ ] A selected camera item automatically upgrades to Native Quality when a valid local original becomes available.
- [ ] Rating / Pick / Reject / selection identity survive the upgrade.

### E. Core Photo Metadata

- [ ] Normalize metadata fields across camera and local sources.
- [ ] Show camera model and lens model.
- [ ] Show focal length and optional 35mm equivalent.
- [ ] Show aperture.
- [ ] Show shutter/exposure time.
- [ ] Show ISO.
- [ ] Show capture time and dimensions.
- [ ] Add exposure compensation, white balance, metering, color space, and orientation when available.
- [ ] Read local metadata from the original file using ImageIO/CGImageSource.
- [ ] Load camera-only selected-photo metadata lazily.
- [ ] Never block initial camera catalog rendering on full-card EXIF.
- [ ] Metadata merges preserve review/local/preview state.

### F. Camera -> Native Quality

- [ ] Add explicit download-original-for-preview flow.
- [ ] Download to managed cache without changing camera identity.
- [ ] After completion, mark the item Local and render the original through `QLPreviewView`.
- [ ] Avoid automatically downloading many RAW originals during rapid culling.

### G. Export -> Native Quality

- [ ] Return final absolute destination path per exported photo.
- [ ] Attach exported path to the original camera item.
- [ ] Prefer exported original as Native Quality path when valid.
- [ ] Preserve Finder handoff.

**v0.2 Gate:** No later phase should introduce another full-quality renderer. Z6III and Local Folder share one workspace; downloaded/exported camera photos upgrade in place; core EXIF is visible; local originals converge on the same native preview engine.

---

## Phase 2 — v0.3.0 Fast Camera Culling

### Task 1: Stream the camera catalog end-to-end

- [ ] Swift daemon emits `list-photos` progress batches while enumerating.
- [ ] Rust helper daemon exposes matching progress instead of skipping it.
- [ ] Tauri forwards native batches immediately through `photos:batch`.
- [ ] React merges batches while enumeration is still running.
- [ ] Completion is represented separately from data batches.
- [ ] Old generations are cancelled or ignored safely.

**Verification:** A 1000–2000+ item card shows the first catalog batch before the full card scan completes.

### Task 2: Make camera catalog enumeration lightweight

Use four loading levels:

```text
L0 catalog     filename / handle / storage / size / date / type
L1 thumbnail   visible window + buffer
L2 preview     selected item + small lookahead
L3 EXIF        selected first, lazy enrichment
```

- [ ] Remove full-card shooting metadata requests from `listPhotos`.
- [ ] Remove fixed first-80 thumbnail/preview pre-cache behavior.
- [ ] Keep selected preview highest priority.
- [ ] Make camera thumbnail loading viewport-driven.
- [ ] Reuse the v0.2 normalized metadata model for lazy camera EXIF.
- [ ] Keep existing generation guards and preview cancellation behavior.

**Performance targets:**

- first visible camera catalog items: target 1–2 seconds after an established session;
- cached selected preview switch: target < 100 ms;
- rapid arrow navigation must not leave obsolete full-preview work queued indefinitely.

---

## Phase 3 — v0.4.0 Distribution & Export Reliability

### Task 3: Package the Swift camera helper as a Tauri sidecar

- [ ] Build the helper in release mode into a deterministic sidecar location.
- [ ] Declare the external binary in Tauri config.
- [ ] Resolve helper path in order: environment override -> packaged sidecar -> development helper.
- [ ] Build/verify helper before Tauri packaging.
- [ ] Verify helper presence inside final `.app`.
- [ ] Run a clean-Mac DMG smoke test with a Z6III.

### Task 4: Sign and notarize the application

- [ ] Developer ID signing.
- [ ] Hardened Runtime / required entitlements.
- [ ] Sign helper and main app consistently.
- [ ] Apple notarization.
- [ ] Staple notarization ticket.
- [ ] Validate with Gatekeeper.

### Task 5: Harden selective export

- [ ] Per-file and overall progress.
- [ ] Cancellation.
- [ ] Duplicate detection.
- [ ] copied / skipped / failed summary.
- [ ] Disk-space failure handling.
- [ ] Destination-permission handling.
- [ ] Camera-disconnect recovery.
- [ ] Show successful exports in Finder.
- [ ] Keep successful exported file paths attached to catalog items for Native Quality preview.

### Task 6: Add CI and release gates

Every PR:

```bash
bun run lint
bun run test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper
```

Release adds:

```text
release helper build
sidecar presence check
Tauri app/DMG build
updater metadata validation
signature/notarization checks
```

---

## Phase 4 — v0.5.0 Nikon Metadata & RAW Workflow

### Task 7: Fix the rating write-back identity contract

Move toward:

```ts
setPhotoRating({
  cameraId,
  storageId,
  objectHandle,
  photoId,
  rating,
})
```

- [ ] Stop resolving real-camera writes through the mock photo catalog.
- [ ] Verify the Nikon Remote Module SDK 2.0.0 Z6III rating capability/API.
- [ ] Replace hard-coded unavailable capability with a real probe when verified.
- [ ] Keep local-only rating behavior when the camera/SDK cannot write metadata.
- [ ] Distinguish Local vs Camera metadata save state in the UI.

### Task 8: Add RAW + JPG pairing

- [ ] Group `.NEF + .JPG` with the same stem into one review item.
- [ ] Use the fastest camera representation during first-pass culling.
- [ ] Route local originals through the Native Preview Engine.
- [ ] Apply Pick/rating to the pair.
- [ ] Export RAW, JPG, or both.

### Task 9: Deepen shooting review

This phase consumes the already-implemented core `PhotoMetadata` instead of implementing EXIF from scratch.

- [ ] Lens/focal length/aperture/shutter/ISO aggregation.
- [ ] Keeper-rate analysis by shooting parameters.
- [ ] High-ISO / low-shutter risk ranges.

---

## Execution Order

```text
1. Native Preview Spike (JPG + NEF)
2. Native Preview Bridge
3. Z6III / Local Folder source switch
4. Local folder catalog + Quick Look thumbnails
5. Camera item localState + Local badge
6. Core PhotoMetadata + inspector
7. Camera original download -> same item -> Native Quality
8. Exported original -> same item -> Native Quality
9. Native Quality / source / metadata regression gate
10. True camera catalog streaming
11. Lightweight camera catalog / lazy camera EXIF
12. Sidecar + signing/notarization
13. Export reliability + CI
14. Nikon SDK rating
15. RAW+JPG pairing / Shooting Review analytics
```

The architecture decision for this stage is clear: **camera preview can stay optimized for first-pass speed; Z6III and local files share one workspace; every original that exists locally is marked as such on the corresponding item and converges on one native macOS preview path; shooting metadata is core browser data rather than a future-only analytics feature.**
