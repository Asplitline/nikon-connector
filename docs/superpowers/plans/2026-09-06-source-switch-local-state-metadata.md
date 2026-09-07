# Source Switch, Local State, and Photo Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users switch the existing review workspace between a connected Nikon Z6III and a selected local folder, attach downloaded/exported local originals back to the same camera photo, and expose normalized shooting metadata such as aperture, focal length, shutter speed, ISO, lens, capture time, and dimensions.

**Architecture:** Add a source-session layer above the existing camera/local catalogs. Preserve independent selection/filter/scroll state per source, while normalizing both sources into the same review catalog shape. Camera items gain `localState`, and metadata gains its own loading state so native/local EXIF can enrich the same photo without replacing review state.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, Swift/ImageCaptureCore, ImageIO/CGImageSource.

**Spec:** `docs/superpowers/specs/2026-09-06-source-switch-local-state-metadata-design.md`

## Global Constraints

- Z6III and Local Folder use the same review workspace.
- Switching away from Z6III does not disconnect a healthy camera session.
- A downloaded/exported camera photo remains the same camera review item.
- `localState.available` must automatically enable Native Quality for that item.
- Metadata merges must never erase rating, Pick/Reject, selection, preview URLs, or local state.
- Full-card camera EXIF must not block first catalog rendering.

---

## Task 1: Add source-session state and Z6III / Local Folder switch

**Files:**
- Create: `src/features/app/sourceSession.ts`
- Create: `src/features/app/sourceSession.test.ts`
- Create: `src/features/app/useSourceSession.ts`
- Modify: `src/features/app/App.tsx` or the current top-level workspace orchestrator.
- Modify: the existing source/device control UI.

**Interfaces:**

```ts
type WorkspaceSource =
  | { kind: "camera"; cameraId: string; label: string }
  | { kind: "local"; directoryPath: string; label: string };

type SourceWorkspaceState = {
  selectedPhotoId?: string;
  scrollAnchorPhotoId?: string;
  filterState: PhotoFilterState;
  sortState: PhotoSortState;
};
```

- [ ] **Step 1: Write source-state reducer tests**

Verify:

```text
camera selected A
-> switch local
-> local selected B
-> switch camera
-> selected A restored
```

Also verify camera/local filter and sort state remain independent.

- [ ] **Step 2: Implement source-session state**

Store active source plus a `Map<sourceKey, SourceWorkspaceState>` or equivalent immutable record.

Use stable source keys:

```text
camera:<cameraId>
local:<canonicalDirectoryPath>
```

- [ ] **Step 3: Add source selector UI**

Minimum states:

```text
Nikon Z6III   Connected
Local Folder  <selected path or Choose…>
```

If Local Folder has no current path, switching to it triggers the existing/new folder picker.

- [ ] **Step 4: Keep camera session alive**

Switching the active workspace source only changes which catalog renders. It must not call disconnect/stop-browser on the camera helper.

- [ ] **Step 5: Restore source-specific UI state**

Restore selection and filmstrip scroll anchor when switching back.

- [ ] **Step 6: Run tests**

```bash
bun run test
```

- [ ] **Step 7: Commit**

```bash
git add src/features/app
git commit -m "feat: switch between camera and local photo sources"
```

---

## Task 2: Normalize local directory identity, including symlink folders

**Files:**
- Modify/Create: `src-tauri/src/local_photos.rs`
- Modify: `src/lib/localPhotosApi.ts`
- Add Rust tests for path identity.

**Interfaces:**

```rust
struct LocalDirectory {
    selected_path: String,
    canonical_path: String,
}
```

- [ ] **Step 1: Write failing path tests**

Cover:

- normal directory;
- symlink -> valid directory;
- two symlinks -> same canonical directory;
- broken symlink;
- unsupported/non-directory path.

- [ ] **Step 2: Canonicalize directory identity**

Use canonical path for source identity, cache keys, and duplicate prevention. Preserve user-selected path separately for display.

- [ ] **Step 3: Canonicalize file identity**

Each local entry returns both `filePath` and `canonicalPath`.

- [ ] **Step 4: Run Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml local_photos
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/local_photos.rs src/lib/localPhotosApi.ts
git commit -m "feat: normalize local folder and symlink identity"
```

---

## Task 3: Add `localState` to camera catalog items

**Files:**
- Modify: photo types in `src/features/photos/` and/or `src/lib/cameraApi.ts`.
- Modify: `src/features/photos/catalog.ts`.
- Modify: `src/features/app/useCameraSession.ts`.
- Add tests for catalog merging.

**Interfaces:**

```ts
type LocalCopy = {
  kind: "cache" | "export";
  filePath: string;
  canonicalPath: string;
  byteSize?: number;
  modifiedAt?: string;
};

type PhotoLocalState =
  | { status: "none" }
  | { status: "downloading"; progress?: number }
  | { status: "available"; copies: LocalCopy[]; preferredPath: string }
  | { status: "missing"; previousPath: string };
```

- [ ] **Step 1: Write catalog-state tests**

Verify:

```text
camera item + download starts -> same id + downloading
camera item + download completes -> same id + available
camera item + export completes -> same id + second local copy
local state update -> rating unchanged
local state update -> Pick/Reject unchanged
```

- [ ] **Step 2: Add default local state**

All camera-only items begin with:

```ts
{ status: "none" }
```

- [ ] **Step 3: Add immutable local-state merge helpers**

Do not rebuild the entire photo object manually in each caller.

- [ ] **Step 4: Add preferred-path rule**

Recommended priority:

```text
valid exported original
> valid managed-cache original
```

This keeps Native Quality pointed at the user's permanent file after export.

- [ ] **Step 5: Run tests and commit**

```bash
bun run test
git add src/features/photos src/features/app/useCameraSession.ts src/lib/cameraApi.ts
git commit -m "feat: track local copies on camera photos"
```

---

## Task 4: Show local availability in filmstrip and inspector

**Files:**
- Modify: current filmstrip thumbnail item component.
- Modify: current photo inspector/details component.
- Modify/add UI tests where available.

**Interfaces:**
- Consumes: `PhotoLocalState`.
- Produces: visible status only; no data mutations.

- [ ] **Step 1: Add display-state tests**

Map states to labels/icons:

```text
none        -> no badge
downloading -> downloading indicator
available   -> Local badge
missing     -> missing-local warning
```

- [ ] **Step 2: Add compact filmstrip badge**

Keep it visually secondary to Pick/Reject/rating. Tooltip can distinguish `Cache` vs `Exported`.

- [ ] **Step 3: Add inspector local section**

Show:

```text
Local: Yes
Source: Cache / Exported
Path: /Users/...
```

If multiple copies exist, show the preferred path first and optionally expose other copies.

- [ ] **Step 4: Verify state transition in-place**

A selected camera item should update its badge and native preview without selection flicker after download/export completes.

- [ ] **Step 5: Commit**

```bash
git add src/features
git commit -m "feat: show local availability on camera photos"
```

---

## Task 5: Define normalized `PhotoMetadata` and metadata merge semantics

**Files:**
- Create/Modify: `src/features/photos/metadata.ts`
- Create: `src/features/photos/metadata.test.ts`
- Modify: central photo/catalog type definitions.

**Interfaces:**

```ts
type PhotoMetadata = {
  capturedAt?: string;
  width?: number;
  height?: number;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLengthMm?: number;
  focalLength35mm?: number;
  apertureFNumber?: number;
  exposureTimeSeconds?: number;
  shutterSpeedLabel?: string;
  iso?: number;
  exposureCompensationEv?: number;
  orientation?: number;
  colorSpace?: string;
  whiteBalance?: string;
  meteringMode?: string;
};

type MetadataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; metadata: PhotoMetadata }
  | { status: "unavailable"; reason?: string }
  | { status: "error"; message: string };
```

- [ ] **Step 1: Write metadata merge tests**

Prove metadata updates preserve:

- photo id;
- source identity;
- rating;
- Pick/Reject;
- thumbnail/preview URLs;
- `localState`.

- [ ] **Step 2: Add formatting helpers**

Examples:

```text
apertureFNumber=4 -> "f/4"
exposureTimeSeconds=0.004 -> "1/250 s"
focalLengthMm=70 -> "70 mm"
iso=800 -> "ISO 800"
```

Handle long exposures such as `2 s` without converting them into misleading reciprocals.

- [ ] **Step 3: Add metadata source priority**

```text
local original metadata
> explicit camera metadata response
> lightweight catalog fields
```

- [ ] **Step 4: Commit**

```bash
git add src/features/photos
git commit -m "feat: add normalized shooting metadata model"
```

---

## Task 6: Read metadata from local originals

**Files:**
- Create/Modify: `src-tauri/src/photo_metadata.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/localPhotosApi.ts` or create `src/lib/photoMetadataApi.ts`.
- Add Rust tests around normalized metadata extraction helpers.

**Interfaces:**
- Consumes: canonical local image path.
- Produces: normalized metadata DTO matching `PhotoMetadata`.

- [ ] **Step 1: Define metadata keys explicitly**

Read/normalize at minimum:

```text
EXIF DateTimeOriginal
EXIF FNumber
EXIF ExposureTime
EXIF ISOSpeedRatings / photographic sensitivity
EXIF FocalLength
EXIF FocalLenIn35mmFilm
EXIF ExposureBiasValue
TIFF Make
TIFF Model
TIFF orientation
lens model where exposed
pixel width / height
color profile/color space where exposed
white balance / metering mode where exposed
```

- [ ] **Step 2: Implement extraction using ImageIO / CGImageSource on macOS**

The metadata path may use ImageIO even though the Native Quality rendering path uses Quick Look.

- [ ] **Step 3: Add sample-based manual validation**

Compare a JPG and Z6III NEF against Finder/Get Info, Preview inspector, NX Studio, or ExifTool as reference data where available.

- [ ] **Step 4: Load selected local photo metadata**

Selection triggers metadata load if state is `idle`. Cache loaded results by canonical path + file size + modified time.

- [ ] **Step 5: Run tests and commit**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
bun run test
git add src-tauri/src/photo_metadata.rs src-tauri/src/lib.rs src/lib src/features
git commit -m "feat: read shooting metadata from local originals"
```

---

## Task 7: Load camera-only metadata lazily

**Files:**
- Modify: Swift helper command/protocol/store files.
- Modify: Rust camera helper bridge and Tauri commands.
- Modify: `src/lib/cameraApi.ts`.
- Modify: `src/features/app/useCameraSession.ts`.

**Interfaces:**
- Consumes: camera photo identity (`cameraId`, `storageId`, `objectHandle` / stable photo id).
- Produces: normalized `PhotoMetadata` update.

- [ ] **Step 1: Add a batched metadata command**

Support selected-first requests such as:

```text
get-photo-metadata(cameraId, photoIds[])
```

Prefer native object identity internally rather than filename-only lookup.

- [ ] **Step 2: Remove metadata from first-card blocking path**

`listPhotos` must return/stream lightweight catalog data without waiting for EXIF for every file.

- [ ] **Step 3: Schedule selected metadata at high priority**

On selection:

```text
metadata idle
-> loading
-> native helper request
-> loaded/unavailable/error
```

Visible-window metadata can run at a lower priority after thumbnail/selected-preview work.

- [ ] **Step 4: Merge with local metadata when local original appears**

If a camera item later gets a local original, refresh metadata from that local file and prefer the local values when present.

- [ ] **Step 5: Run all test suites and commit**

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
swift test --package-path native/macos-camera-helper

git add native/macos-camera-helper src-tauri src
git commit -m "feat: load camera shooting metadata lazily"
```

---

## Task 8: Complete inspector presentation and acceptance tests

**Files:**
- Modify: current photo details/inspector component.
- Add/modify related tests.
- Create: `docs/testing/photo-source-and-metadata.md`.

- [ ] **Step 1: Prioritize core fields**

Display in a compact photography-friendly order:

```text
Nikon Z6III
NIKKOR Z 24-120mm f/4 S
70 mm · f/4 · 1/250 s · ISO 800
2026-09-06 18:42:31
6048 × 4032
```

Secondary details can include exposure compensation, white balance, metering, color space.

- [ ] **Step 2: Define empty/loading behavior**

Do not show `0`, `undefined`, or misleading defaults for unavailable EXIF. Use placeholders/loading only while a request is actually pending.

- [ ] **Step 3: Add source-switch acceptance cases**

Document and verify:

1. connect Z6III;
2. select a camera photo;
3. switch to Local Folder and choose directory;
4. select local NEF and see Native Quality + EXIF;
5. switch back to Z6III and restore previous photo;
6. download that camera photo;
7. same item gains Local badge;
8. same item switches to Native Quality;
9. rating/Pick state is unchanged;
10. metadata refreshes from local original when appropriate.

- [ ] **Step 4: Add symlink-folder acceptance case**

Select a valid symlinked photo directory, verify enumeration/preview works and duplicate identity is canonicalized.

- [ ] **Step 5: Commit**

```bash
git add src/features docs/testing/photo-source-and-metadata.md
git commit -m "docs: add source and metadata regression coverage"
```
