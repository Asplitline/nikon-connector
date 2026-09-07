# Native Preview Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-photo workflow and an embedded native macOS preview engine so local, downloaded, and exported originals render at Finder Quick Look / Preview.app-class quality with no intermediate display conversion.

**Architecture:** Keep React/Tauri as the application shell. Add a macOS-only native preview module inside the Tauri main process using `objc2` bindings to AppKit and QuickLookUI, attach an embedded `QLPreviewView` to the main window, and synchronize it with a React placeholder rectangle. Use `QLThumbnailGenerator` for local thumbnails, while the existing Swift camera helper remains responsible only for camera/PTP/file access.

**Tech Stack:** Tauri 2, React 19, TypeScript, Rust, `objc2`, `objc2-app-kit`, `objc2-foundation`, `objc2-quick-look-ui`, `objc2-quick-look-thumbnailing`, QuickLookUI, QuickLookThumbnailing, ImageCaptureCore, Vitest, Cargo tests.

**Spec:** `docs/superpowers/specs/2026-09-06-native-preview-engine-design.md`

**Companion plan:** `docs/superpowers/plans/2026-09-06-source-switch-local-state-metadata.md` covers Z6III/Local Folder switching, local-copy badges/state, and normalized shooting metadata. Execute its source-switch/local-state/metadata tasks as part of v0.2 rather than deferring them to later phases.

## Global Constraints

- Finder Quick Look is the primary implementation quality baseline; Preview.app is the comparison baseline.
- When an original local file path exists, the main preview must use the original file directly.
- Do not generate an intermediate JPEG/PNG for the local main-preview path.
- Keep the preview inside the Nikon Connector window; do not use `QLPreviewPanel` as the normal workspace preview.
- The camera helper remains a separate PTP/file-access process and must not own `QLPreviewView`.
- React continues to own selection, rating, Pick/Reject, filtering, filmstrip, inspector, and keyboard workflow.
- The native preview view must be created, mutated, and destroyed on the macOS main thread.
- Existing camera review preview remains available for camera-only items that do not yet have a local original.
- Native quality is only reported when the app is actually rendering a local original through the native path.
- Z6III and Local Folder use the same workspace and source selector.
- Downloaded/exported camera originals attach to the existing camera item and expose a visible Local state.
- Core shooting metadata (lens, focal length, aperture, shutter, ISO, capture time, dimensions) is part of v0.2.

---

## Task 0: Prove embedded `QLPreviewView` inside the existing Tauri window

This is the architectural gate. Do not build the full local browser until this spike proves the view can coexist correctly with the current WKWebView.

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/native_preview/mod.rs`
- Create: `src-tauri/src/native_preview/macos.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/nativePreviewApi.ts`
- Modify: `src/features/app/WorkspacePanel.tsx`

**Interfaces:**
- Produces: `show_native_preview`, `update_native_preview_frame`, `hide_native_preview` Tauri commands.
- Consumes: a real local file path and a preview frame in logical CSS points.

- [ ] **Step 1: Add macOS-only Objective-C framework dependencies**

Add target-specific dependencies so non-macOS builds do not compile AppKit/Quick Look code:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.6"
objc2-app-kit = { version = "0.3", features = ["NSView", "NSWindow"], default-features = false }
objc2-foundation = { version = "0.3", features = ["NSURL", "NSString", "NSGeometry"], default-features = false }
objc2-quick-look-ui = { version = "0.3", features = ["QLPreviewView", "QLPreviewItem", "objc2-app-kit"], default-features = false }
```

Pin compatible minor versions in the actual implementation after `cargo check` resolves the feature set; do not mix incompatible `objc2` minor families.

- [ ] **Step 2: Add pure frame-normalization tests before native UI code**

Define a serializable input:

```rust
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct PreviewFrame {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub viewport_height: f64,
}
```

Test top-left browser coordinates convert to AppKit bottom-left coordinates:

```text
appkit_x = x
appkit_y = viewport_height - y - height
```

Reject negative width/height and clamp tiny floating-point noise to zero.

- [ ] **Step 3: Run the focused Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml native_preview
```

Expected: FAIL until the module exists, then PASS after the pure conversion helper is implemented.

- [ ] **Step 4: Implement `NativePreviewState` on macOS**

Store one retained `QLPreviewView` and current file URL for the main window.

Required lifecycle:

```text
show(file, frame)
  -> get main Tauri WebviewWindow
  -> access native NSWindow / content view
  -> lazily create QLPreviewView
  -> attach as sibling overlay above WKWebView
  -> set frame
  -> set NSURL directly as preview item
  -> unhide

updateFrame(frame)
  -> update NSView frame only

hide()
  -> clear preview item
  -> hide view

close()
  -> call QLPreviewView.close()
  -> removeFromSuperview
```

Use `WebviewWindow::with_webview` / native handles from Tauri on macOS. All AppKit mutations must run on the main thread.

- [ ] **Step 5: Register temporary spike commands**

Expose:

```rust
show_native_preview(window, file_path, frame)
update_native_preview_frame(window, frame)
hide_native_preview(window)
```

Return explicit errors for missing files, invalid frames, missing window/content view, or Quick Look initialization failure.

- [ ] **Step 6: Add a temporary React preview placeholder**

Use a real DOM element with a stable ref. On mount/resize:

```ts
const rect = element.getBoundingClientRect();
```

Send:

```ts
{
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
  viewportHeight: window.innerHeight,
}
```

Use `ResizeObserver` plus `requestAnimationFrame` throttling. Do not send frame updates on every render.

- [ ] **Step 7: Manual spike validation with JPG and NEF**

Use one high-resolution JPG and one Nikon Z6III NEF.

Verify:

- preview remains inside Nikon Connector;
- sidebar/filmstrip stay visible;
- resize does not drift;
- fullscreen/window resize remains aligned;
- preview is sharp at fit-to-window;
- focus inspection is comparable with Finder Quick Look;
- color/orientation are comparable with Finder Quick Look and Preview.app;
- switching JPG <-> NEF does not create an external Quick Look panel;
- app keyboard shortcuts are not permanently lost after interacting with the native view.

**Gate:** If the native overlay cannot remain correctly aligned and integrated, stop here and revise the host architecture before implementing Tasks 1–7.

- [ ] **Step 8: Commit the proven spike as production foundation**

```bash
git add src-tauri/Cargo.toml src-tauri/src/native_preview src-tauri/src/lib.rs src/lib/nativePreviewApi.ts src/features/app/WorkspacePanel.tsx
git commit -m "feat: embed native quick look preview"
```

---

## Task 1: Stabilize the native preview bridge

**Files:**
- Modify: `src-tauri/src/native_preview/mod.rs`
- Modify: `src-tauri/src/native_preview/macos.rs`
- Modify: `src/lib/nativePreviewApi.ts`
- Create: `src/features/photos/nativePreviewFrame.ts`
- Create: `src/features/photos/nativePreviewFrame.test.ts`
- Create: `src/features/app/useNativePreview.ts`

**Interfaces:**
- Consumes: selected display asset + preview DOM element.
- Produces: one stable embedded native preview surface synchronized with layout.

- [ ] **Step 1: Add frame calculation tests in TypeScript**

Test normal layout, collapsed sidebar, changed filmstrip height, zero-size hidden placeholder, and repeated identical rectangles.

- [ ] **Step 2: Define the frontend API**

```ts
export type NativePreviewFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportHeight: number;
};

export function showNativePreview(filePath: string, frame: NativePreviewFrame): Promise<void>;
export function updateNativePreviewFrame(frame: NativePreviewFrame): Promise<void>;
export function hideNativePreview(): Promise<void>;
```

- [ ] **Step 3: Add `useNativePreview`**

Responsibilities only:

- observe placeholder geometry;
- show selected local file;
- hide native view for camera-review-only selections;
- dedupe identical file/frame updates;
- hide/cleanup on unmount.

Do not put catalog, rating, or camera logic in this hook.

- [ ] **Step 4: Verify z-order and input behavior**

Ensure the native view covers only the preview viewport and never overlays toolbar/sidebar/filmstrip hit targets.

- [ ] **Step 5: Run tests**

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml native_preview
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/native_preview src/lib/nativePreviewApi.ts src/features/photos/nativePreviewFrame* src/features/app/useNativePreview.ts
git commit -m "feat: stabilize native preview bridge"
```

---

## Task 2: Add local folder catalog loading

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/local_photos.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/localPhotosApi.ts`
- Create: `src/features/photos/localCatalog.ts`
- Create: `src/features/photos/localCatalog.test.ts`
- Create: `src/features/app/useLocalPhotoSession.ts`
- Modify: `src/features/app/SidePanel.tsx` or the existing workspace source control.

**Interfaces:**
- Produces: a normalized catalog of local files with `PhotoSource.kind = "local"`.

- [ ] **Step 1: Add local file filtering tests**

Cover case-insensitive:

```text
.jpg .jpeg .heic .heif .png .tif .tiff .nef .nrw
```

Reject directories, hidden non-image files, and unsupported files.

- [ ] **Step 2: Implement folder enumeration**

Start with direct children of one selected folder. Return stable fields:

```ts
{
  id,
  fileName,
  filePath,
  extension,
  byteSize,
  modifiedAt,
  source: { kind: "local", filePath }
}
```

Use canonical absolute file paths. Sort consistently by captured/modified time fallback and filename.

- [ ] **Step 3: Add an Open Folder action**

Use a native Tauri/macOS folder picker. Cancel is a no-op, not an error state.

- [ ] **Step 4: Map local entries into the existing review catalog**

Preserve current filter/selection/filmstrip infrastructure rather than building a second local-browser UI.

- [ ] **Step 5: Select the first file and route it to Native Quality**

Once catalog loads:

```text
selected local item
-> localFilePath available
-> useNativePreview
-> QLPreviewView(original file)
```

- [ ] **Step 6: Run JS/Rust tests**

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/local_photos.rs src-tauri/src/lib.rs src/lib/localPhotosApi.ts src/features/photos/localCatalog* src/features/app/useLocalPhotoSession.ts src/features/app/SidePanel.tsx
git commit -m "feat: browse local photo folders"
```

---

## Task 3: Use Quick Look thumbnails for local filmstrip items

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/native_preview/thumbnails.rs`
- Modify: `src-tauri/src/native_preview/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/localPhotosApi.ts`
- Modify: existing filmstrip thumbnail loader/scheduler.

**Interfaces:**
- Consumes: local file path + requested logical size + scale.
- Produces: cached thumbnail file/data URL suitable for the existing React filmstrip.

- [ ] **Step 1: Add cache-key tests**

Cache identity must include:

```text
canonical file path
file size
modified timestamp
requested size class
backing scale
```

A changed original must invalidate its old thumbnail.

- [ ] **Step 2: Add `QLThumbnailGenerator` macOS implementation**

Request the best representation asynchronously using actual requested size and Retina scale.

Do not decode the full local original in JavaScript.

- [ ] **Step 3: Connect generation to visible-window scheduling**

Only generate thumbnails for visible filmstrip items plus the existing buffer/lookahead.

- [ ] **Step 4: Preserve virtualization**

2000+ local photos must not create 2000 DOM image nodes.

- [ ] **Step 5: Validate quality**

Compare filmstrip thumbs against Finder for JPG, HEIC, and NEF, particularly orientation and Retina sharpness.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/native_preview src-tauri/src/lib.rs src/lib/localPhotosApi.ts src/features/photos
git commit -m "feat: generate local thumbnails with quick look"
```

---

## Task 4: Introduce the unified `PhotoSource` / `DisplayAsset` model

**Files:**
- Modify: existing photo types under `src/features/photos/` and/or `src/lib/cameraApi.ts`
- Modify: `src/features/photos/catalog.ts`
- Modify: `src/features/app/useCameraSession.ts`
- Modify: `src/features/app/useLocalPhotoSession.ts`
- Modify: `src/features/app/WorkspacePanel.tsx`
- Modify related tests.

**Interfaces:**

```ts
type PhotoSource =
  | { kind: "camera"; cameraId: string; storageId?: string; objectHandle?: number }
  | { kind: "local"; filePath: string };

type DisplayAsset = {
  source: PhotoSource;
  localFilePath?: string;
  reviewPreviewUrl?: string;
  thumbnailUrl?: string;
  quality: "review" | "native";
};
```

- [ ] **Step 1: Add routing tests**

Cases:

```text
camera + no local file -> review
camera + downloaded local file -> native
local file -> native
exported local copy -> native
missing local file -> not native
```

- [ ] **Step 2: Add the types without duplicating catalog state**

Keep one selected-photo identity and add source/display capabilities to it.

- [ ] **Step 3: Route main preview from `DisplayAsset`**

Rule:

```ts
if (displayAsset.localFilePath) {
  // native preview
} else {
  // existing camera review preview
}
```

- [ ] **Step 4: Preserve rating/Pick/Reject**

Switching rendering quality must never reset user culling state.

- [ ] **Step 5: Run tests and commit**

```bash
bun run test
git add src
git commit -m "refactor: unify camera and local photo display sources"
```

---

## Task 5: Download a camera original for Native Quality inspection

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/Command.swift`
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Modify: Rust camera bridge/commands.
- Modify: `src/lib/cameraApi.ts`
- Modify: `src/features/app/useCameraSession.ts`
- Modify: workspace preview controls.

**Interfaces:**
- Consumes: camera photo identity.
- Produces: managed local original path attached to the same selected photo.

- [ ] **Step 1: Add path/identity tests for managed originals**

Cache key must include enough camera identity to avoid collisions across reconnects/cards.

- [ ] **Step 2: Add `download-original-for-preview`**

Download the actual camera file to a managed cache path. Return the final local path only after the file is complete and readable.

- [ ] **Step 3: Promote display quality only after success**

```text
Review Quality
-> downloading
-> local original complete
-> attach localState.available / localFilePath
-> Local badge
-> Native Quality
```

Failed/cancelled downloads keep the camera review preview intact.

- [ ] **Step 4: Add explicit UI action/state**

Expose a clear action such as “高清查看 / Download Original” without automatically downloading every selected RAW during fast culling.

- [ ] **Step 5: Validate NEF**

Download a Z6III NEF, then verify the exact downloaded original opens in embedded Quick Look with appearance comparable to Finder Quick Look / Preview.app.

- [ ] **Step 6: Commit**

```bash
git add native/macos-camera-helper src-tauri src
git commit -m "feat: download camera originals for native preview"
```

---

## Task 6: Route batch export results into the same Native Quality pipeline

**Files:**
- Modify: existing export command/module.
- Modify: `src/lib/cameraApi.ts`
- Modify: `src/features/app/useCameraSession.ts`
- Modify: export result types/UI.

**Interfaces:**
- Consumes: successful export destination paths.
- Produces: local copy state/path for the same camera item.

- [ ] **Step 1: Extend export result tests**

Each successful copied file returns its final absolute destination path and source photo identity.

- [ ] **Step 2: Attach exported paths to catalog entries**

After export, the same camera photo gains/updates `localState.available` and keeps its existing ID/rating/Pick state.

- [ ] **Step 3: Preview exported files directly**

Never copy exported originals back into an app preview cache just to render them.

- [ ] **Step 4: Preserve Finder handoff**

Export completion should allow “Show in Finder”; native preview should remain inside the app.

- [ ] **Step 5: Commit**

```bash
git add src-tauri src
git commit -m "feat: preview exported originals natively"
```

---

## Task 7: Build the Native Quality regression suite

**Files:**
- Create: `docs/testing/native-preview-quality.md`
- Add unit/integration tests in the affected Rust/TypeScript modules.

**Interfaces:**
- Produces: repeatable release gate for visual quality and integration behavior.

- [ ] **Step 1: Document the reference image set**

Require:

- large sRGB JPG;
- Display P3 JPG/HEIC;
- EXIF-rotated portrait;
- transparent PNG;
- TIFF;
- Z6III NEF;
- camera-exported JPG;
- camera-exported NEF.

- [ ] **Step 2: Define comparison steps**

For every file compare:

```text
Nikon Connector embedded native preview
Finder Quick Look
Preview.app
```

Check fit sharpness, 100% focus detail, orientation, color, Retina scaling, resize, next/previous switching.

- [ ] **Step 3: Add behavior regression cases**

Cover:

- open local folder with 100 / 1000 / 2000+ files;
- rapid arrow navigation;
- resize/collapse sidebars;
- enter/exit fullscreen;
- local file deleted while selected;
- camera review -> downloaded original transition;
- camera export -> exported original transition;
- downloaded/exported camera item displays Local state;
- Z6III -> Local Folder -> Z6III state restoration.

- [ ] **Step 4: Define the v0.2 release gate**

v0.2 cannot be called Native Photo Browser until:

- embedded `QLPreviewView` passes JPG + NEF spike;
- local folder workflow is usable;
- source switching is usable without reconnecting a healthy Z6III;
- local originals never use intermediate JPEG/PNG for the main view;
- exported/downloaded originals use the same native path and mark the same camera item Local;
- core shooting metadata is visible in the inspector;
- quality regression passes against Finder Quick Look + Preview.app.

- [ ] **Step 5: Commit**

```bash
git add docs/testing/native-preview-quality.md
git commit -m "docs: add native preview quality regression gate"
```

---

## Follow-up After v0.2 Native Photo Browser

Only after the native preview foundation, source switching, local-copy state, and core metadata are stable, continue the broader roadmap in this order:

1. package the Swift camera helper as a Tauri sidecar and complete DMG/signing/notarization;
2. implement true Swift -> Rust -> React progressive catalog streaming;
3. make camera catalog enumeration metadata-light while keeping selected-photo EXIF lazy;
4. harden batch export progress/cancellation/errors;
5. verify Nikon SDK rating write-back;
6. add RAW+JPG pairing and deeper shooting review analytics.

The native preview engine should remain the single full-quality rendering path for all future local/downloaded/exported file workflows.
