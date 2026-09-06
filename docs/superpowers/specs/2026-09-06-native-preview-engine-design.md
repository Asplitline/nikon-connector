# Native Preview Engine Design

## Goal

Turn Nikon Connector into a unified macOS photo browser where local files and downloaded/exported camera files render at native macOS preview quality, using Finder Quick Look and Preview.app as the visual quality baseline.

The project remains a camera-first culling tool in the short term, but the next stage adds a local-photo path and a native preview layer so that once a file exists locally, image quality no longer depends on WebView image decoding, intermediate JPEG conversion, or custom resampling.

Companion design for Z6III/local source switching, local-copy state, and shooting metadata:

- `docs/superpowers/specs/2026-09-06-source-switch-local-state-metadata-design.md`

## Product Positioning

The product has two distinct viewing modes:

### 1. Camera Review Quality

Used while photos still live only on the Nikon camera/card.

Primary goal: speed.

Allowed implementation:

- camera thumbnail;
- embedded JPEG preview;
- cached display preview;
- lower-resolution review representation when that materially improves browsing latency.

This mode is for initial culling, rating, Pick/Reject, and deciding what deserves download/export.

### 2. Native Quality

Used whenever the original file exists on local storage, including:

- files loaded directly from a local folder;
- files downloaded from the camera into app cache;
- files exported from the camera into a user-selected folder.

Primary goal: native macOS display quality with no deliberate visual compromise.

Hard rule:

> When an original local file URL exists, the main preview must render that file through the native macOS preview path. Do not create an intermediate JPEG/PNG just to display it in the main preview.

## Quality Baseline

Reference applications:

1. Finder Quick Look (Space key) — primary implementation baseline.
2. Preview.app — visual comparison baseline.

Success means:

- local JPG/HEIC/PNG/TIFF previews are visually equivalent to Finder Quick Look / Preview.app at normal inspection zoom levels;
- local NEF files use the system-native preview/rendering path supported by macOS;
- no avoidable quality loss from intermediate compression;
- no browser/WebView resampling as the authoritative full-resolution display path;
- ICC/profile-aware system rendering is preserved through the native stack;
- zooming to inspect focus does not reveal softness introduced by an app-generated low-resolution preview.

Pixel-identical output to Preview.app is not treated as an API guarantee because Preview.app internals are not public. The implementation target is the same native file + system framework rendering family, with Finder Quick Look as the directly reusable baseline.

## Chosen Architecture

### Main preview: `QLPreviewView`

Use `QuickLookUI.QLPreviewView` as the default main preview renderer for local files.

Reasons:

- it is an `NSView` designed to be embedded in an application view hierarchy;
- it previews the original local file directly;
- it keeps the preview inside the Nikon Connector window;
- it aligns the main display path with Finder Quick Look instead of rebuilding a custom renderer;
- it avoids `<img>` / WebKit as the final-quality renderer.

Do not use `QLPreviewPanel` for the normal workspace because it behaves as a Quick Look panel rather than the embedded preview surface required by the product.

### Filmstrip thumbnails: `QLThumbnailGenerator`

Use `QuickLookThumbnailing.QLThumbnailGenerator` for local-file thumbnails.

Requirements:

- request thumbnail size using the actual backing scale factor;
- prefer asynchronous best/representative generation;
- cache results by file identity + modification state + requested size class;
- keep the current virtualized filmstrip architecture.

### ImageIO role

Keep ImageIO as a supporting tool for:

- metadata extraction;
- dimensions/orientation;
- fallback decoding where Quick Look cannot provide the required representation;
- camera-side preview extraction/rendering where no local original file exists yet.

ImageIO is not the default main-view renderer once an original local file is available.

## Window Architecture

Keep Tauri + React as the application shell and interaction layer.

Conceptual layout:

```text
NSWindow
├── Tauri WKWebView
│   ├── Toolbar
│   ├── Sidebar
│   ├── Inspector
│   ├── Filmstrip
│   └── Native preview placeholder
│
└── Native Preview Host
    └── QLPreviewView
```

The native preview host occupies the same visual rectangle as the React preview placeholder.

React remains responsible for:

- selected photo state;
- filter/sort;
- Pick/Reject/rating controls;
- keyboard workflow;
- filmstrip;
- inspector;
- workspace layout;
- switching the active source between connected Z6III and a local folder.

The native host is responsible for:

- showing/hiding the embedded `QLPreviewView`;
- updating the local file URL;
- synchronizing its frame with the React preview viewport;
- preserving native preview behavior during resize and layout changes.

## Native Preview Bridge

Introduce a small macOS-native preview bridge with an explicit API.

Suggested commands/events:

```ts
showNativePreview({
  filePath: string,
  frame: { x: number; y: number; width: number; height: number },
})

updateNativePreviewFrame({
  x: number,
  y: number,
  width: number,
  height: number,
})

hideNativePreview()
```

The bridge must:

- create `QLPreviewView` lazily;
- attach it to the existing Tauri window hierarchy;
- keep it clipped to the designated preview viewport;
- update on window resize, sidebar changes, filmstrip changes, and fullscreen changes;
- release the previous preview item when switching files;
- avoid stealing keyboard shortcuts used by the review workflow except when native preview interaction explicitly requires focus.

## Unified Photo Source Model

Use one review item identity even when a camera photo gains one or more local copies.

```ts
type PhotoSource =
  | {
      kind: "camera";
      cameraId: string;
      storageId?: string;
      objectHandle?: number;
    }
  | {
      kind: "local";
      filePath: string;
    };

type LocalCopy = {
  kind: "cache" | "export";
  filePath: string;
  canonicalPath: string;
};

type PhotoLocalState =
  | { status: "none" }
  | { status: "downloading"; progress?: number }
  | { status: "available"; copies: LocalCopy[]; preferredPath: string }
  | { status: "missing"; previousPath: string };
```

Display capability should be expressed separately:

```ts
type DisplayAsset = {
  source: PhotoSource;
  localFilePath?: string;
  reviewPreviewUrl?: string;
  thumbnailUrl?: string;
  quality: "review" | "native";
};
```

Routing rule:

```text
local original exists / localState.available
  -> native QLPreviewView
else
  -> camera review preview pipeline
```

A downloaded/exported camera photo stays the same review item, gains a visible Local state, and upgrades in place to Native Quality.

## Workspace Source Switching

The same workspace supports:

```text
Nikon Z6III  <->  Local Folder
```

Switching to Local Folder opens a directory chooser when no local directory is active. Switching back restores the camera catalog/selection and should not disconnect a healthy camera session.

Each source keeps its own selected-photo and filmstrip/filter state. Valid macOS symlink folders are supported; canonical paths are used for identity/cache deduplication.

## Local Folder Workflow

```text
Switch source to Local Folder
-> choose directory
-> enumerate supported image files
-> create catalog entries
-> generate Quick Look thumbnails on demand
-> select item
-> render original file in QLPreviewView
```

Initial supported types:

- JPEG/JPG;
- HEIC/HEIF where supported by macOS;
- PNG;
- TIFF;
- NEF/NRW where supported by the installed macOS Quick Look/RAW stack.

Do not build a custom file watcher in the first milestone unless required for correctness. Folder rescanning can remain explicit initially.

## Camera Download / Export Workflow

### Download for native inspection

```text
camera object
-> download original to managed local cache
-> retain camera source identity
-> attach localState.available to the same camera item
-> display Local badge
-> switch same selected item to Native Quality
-> render preferredPath with QLPreviewView
```

The managed cache should be bounded and invalidatable. It is not the user's permanent export destination.

### Batch export

```text
selected camera items
-> copy original files to destination
-> attach exported local paths to those same camera items
-> Local badge remains/appears
-> exported original becomes preferred Native Quality path
```

After export, previewing the item must use the exported original file directly.

## Photo Metadata

Photo metadata is part of the core browser, not only a future analytics screen.

Normalize at least:

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
```

Inspector priority:

```text
Camera / Lens
Focal Length
Aperture
Shutter
ISO
Captured At
Dimensions
```

For local originals, ImageIO/CGImageSource metadata is the preferred source. For camera-only items, metadata loads lazily from the camera helper, selected item first. Full-card EXIF must never block the initial camera catalog.

When a camera photo gains a local original, refresh/merge metadata from that local file and prefer valid local values without erasing rating, Pick/Reject, preview state, or local state.

## Interaction Requirements

Native preview integration must preserve the current culling experience:

- left/right navigation remains instant and predictable;
- number/rating shortcuts remain owned by the app;
- Pick/Reject remains owned by the app;
- sidebars and filmstrip can resize without visual drift between React and native preview;
- fullscreen/window resize keeps the native preview aligned;
- switching from camera review preview to local native preview does not reset selection state;
- switching Z6III <-> Local Folder restores each source's previous workspace state;
- loading/error state is visible in the React shell while the native view or metadata is prepared.

## Performance Requirements

Native quality must not justify poor navigation latency.

Targets:

- cached/local thumbnail display: effectively immediate during filmstrip scrolling;
- switching between already-local ordinary images: target < 100 ms to initiate preview update;
- preview view must not block the React main interaction loop;
- thumbnail generation stays asynchronous;
- only the selected local file is loaded into the main native preview;
- metadata loading is asynchronous and subordinate to selected-preview responsiveness;
- neighboring local images may be metadata/thumbnail prefetched, but do not pre-render many full previews.

For camera items, existing preview scheduling remains valid until the original file is downloaded.

## Failure Handling

If Quick Look cannot render a file:

1. keep the item in the catalog;
2. show a clear preview-unavailable state;
3. expose the original path and Finder handoff where appropriate;
4. use an ImageIO fallback only when it can preserve the expected visual quality and format semantics;
5. do not silently substitute a visibly lower-resolution camera thumbnail for a local original while labeling it Native Quality.

If a local file disappears or moves:

- mark local state as missing;
- keep camera/source metadata where possible;
- fall back to camera review preview only when the original camera source is still connected and resolvable.

## Validation Matrix

Every native preview milestone should compare Nikon Connector against Finder Quick Look and Preview.app using the same source file.

Test set:

- high-resolution sRGB JPG;
- Display P3 JPG/HEIC;
- portrait-oriented image with EXIF orientation;
- very large JPG;
- PNG with transparency;
- TIFF;
- Nikon Z6III NEF;
- exported NEF copied from camera;
- exported JPG copied from camera.

Visual checks:

- fit-to-window sharpness;
- 100% detail/focus inspection;
- orientation;
- color appearance;
- resize behavior;
- repeated next/previous navigation;
- Retina scaling.

Metadata checks for JPG + Z6III NEF when available:

- camera/lens;
- focal length;
- aperture;
- shutter;
- ISO;
- capture time;
- dimensions.

## Milestone Definition

### v0.2.0 — Native Photo Browser

Must include:

- embedded `QLPreviewView` spike integrated into the Tauri window;
- Z6III / Local Folder source switching in one workspace;
- local folder loading, including valid symlink directories;
- native-quality local main preview;
- Quick Look thumbnails for local files;
- normalized photo metadata + inspector fields;
- download-original-to-cache that marks the original camera item Local and upgrades it to Native Quality;
- exported originals attached back to the same camera items and previewed through the same native pipeline;
- regression comparison against Finder Quick Look + Preview.app;
- no intermediate JPEG/PNG conversion in the local main-preview path.

Camera streaming/sidecar/release work remains important, but the native preview engine and unified source/local-state model are now the first architectural milestone because they define the long-term rendering foundation shared by camera, local, downloaded, and exported photos.
