# Nikon Connector Next Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Nikon Connector from a camera-only first-pass culling tool into a unified macOS photo browser where camera review stays fast and every local/downloaded/exported original can be inspected at native macOS preview quality.

**Architecture:** The next stage begins with a native preview engine embedded in the Tauri main window. React/Tauri remains the application shell; `QLPreviewView` becomes the authoritative local-original main preview, `QLThumbnailGenerator` handles local thumbnails, and the existing Swift ImageCaptureCore helper remains dedicated to camera/PTP access. After the native display foundation is stable, continue with camera streaming, release packaging, and export reliability.

**Tech Stack:** Tauri 2, React 19, TypeScript, Rust, Swift, ImageCaptureCore, QuickLookUI, QuickLookThumbnailing, ImageIO, `objc2`, Vitest, Cargo tests, Swift Package Manager.

**Primary Spec:** `docs/superpowers/specs/2026-09-06-native-preview-engine-design.md`

**Detailed Phase 1 Plan:** `docs/superpowers/plans/2026-09-06-native-preview-engine.md`

## Global Constraints

- Camera direct browsing remains optimized for fast first-pass culling.
- Finder Quick Look is the primary Native Quality implementation baseline; Preview.app is the comparison baseline.
- Once an original file is local, the main preview must not intentionally reduce quality through intermediate JPEG/PNG conversion.
- The native preview remains embedded inside Nikon Connector.
- Keep one review workspace and one photo identity model across camera, local, downloaded, and exported sources.
- Keep one long-lived camera/PTP session and serialize camera operations.
- Local rating and Pick/Reject remain usable while Nikon SDK rating write-back is unavailable.

---

## Phase 1 — v0.2.0 Native Photo Browser

**Detailed implementation:** `docs/superpowers/plans/2026-09-06-native-preview-engine.md`

- [ ] Embed `QLPreviewView` in the existing Tauri window and validate JPG + Z6III NEF.
- [ ] Stabilize React placeholder -> AppKit native-view frame synchronization.
- [ ] Add local folder loading into the existing review workspace.
- [ ] Generate local filmstrip thumbnails with `QLThumbnailGenerator`.
- [ ] Introduce unified `PhotoSource` / `DisplayAsset` routing.
- [ ] Download a camera original into managed cache for Native Quality inspection.
- [ ] Route successfully exported originals into the same Native Quality path.
- [ ] Establish Finder Quick Look + Preview.app regression tests.

**Gate:** No later phase should introduce another full-quality renderer. Local/downloaded/exported originals must converge on the same native preview engine.

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
- [ ] Add batched lazy EXIF requests.
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

- [ ] Lens/focal length/aperture/shutter/ISO aggregation.
- [ ] Keeper-rate analysis by shooting parameters.
- [ ] High-ISO / low-shutter risk ranges.
- [ ] Lazy EXIF enrichment remains lower priority than selected preview responsiveness.

---

## Execution Order

```text
1. Native Preview Spike (JPG + NEF)
2. Local Photo Browser
3. Quick Look local thumbnails
4. Unified Camera/Local/Exported model
5. Camera original -> Native Quality
6. Exported original -> Native Quality
7. Native Quality regression gate
8. True camera catalog streaming
9. Lightweight camera catalog / lazy EXIF
10. Sidecar + signing/notarization
11. Export reliability + CI
12. Nikon SDK rating
13. RAW+JPG pairing / Shooting Review
```

The architecture decision for this stage is therefore clear: **camera preview can stay optimized for first-pass speed; every original that exists locally converges on one native macOS preview path with no intentional quality compromise.**
