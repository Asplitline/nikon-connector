# Native Preview Engine Design

## Goal

Turn Nikon Connector into a unified macOS photo browser where local files and downloaded/exported camera files render at native macOS preview quality, using Finder Quick Look and Preview.app as the visual quality baseline.

The project remains a camera-first culling tool in the short term, but the next stage adds a local-photo path and a native preview layer so that once a file exists locally, image quality no longer depends on WebView image decoding, intermediate JPEG conversion, or custom resampling.

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
- workspace layout.

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

Move toward one source abstraction instead of separate camera/local UI components.

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
    }
  | {
      kind: "exported";
      filePath: string;
      sourceCameraId?: string;
      sourceObjectHandle?: number;
    };
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
localFilePath exists
  -> native QLPreviewView
else
  -> camera review preview pipeline
```

This allows the same review workspace to move seamlessly from camera-only review to native local viewing after download/export.

## Local Folder Workflow

New workflow:

```text
Open Folder
-> enumerate supported image files
-> create catalog entries
-> generate Quick Look thumbnails on demand
-> select item
-> render original file in QLPreviewView
```

Initial supported types should follow formats already relevant to the project:

- JPEG/JPG;
- HEIC/HEIF where supported by macOS;
- PNG;
- TIFF;
- NEF/NRW where supported by the installed macOS Quick Look/RAW stack.

Do not build a custom file watcher in the first milestone unless required for correctness. Folder rescanning can remain explicit initially.

## Camera Download / Export Workflow

### Download for native inspection

When a user asks for a high-quality/full-resolution look at a camera item:

```text
camera object
-> download original to managed local cache
-> retain source identity
-> switch selected item to localFilePath-backed Native Quality
-> render with QLPreviewView
```

The managed cache should be bounded and invalidatable. It is not the user's permanent export destination.

### Batch export

```text
selected camera items
-> copy original files to destination
-> create/update local/exported catalog identity
-> make exported file path available for Native Quality preview
```

After export, previewing the exported item must use the exported original file directly.

## Interaction Requirements

Native preview integration must preserve the current culling experience:

- left/right navigation remains instant and predictable;
- number/rating shortcuts remain owned by the app;
- Pick/Reject remains owned by the app;
- sidebars and filmstrip can resize without visual drift between React and native preview;
- fullscreen/window resize keeps the native preview aligned;
- switching from camera review preview to local native preview does not reset selection state;
- loading/error state is visible in the React shell while the native view is prepared.

## Performance Requirements

Native quality must not justify poor navigation latency.

Targets:

- cached/local thumbnail display: effectively immediate during filmstrip scrolling;
- switching between already-local ordinary images: target < 100 ms to initiate preview update;
- preview view must not block the React main interaction loop;
- thumbnail generation stays asynchronous;
- only the selected local file is loaded into the main native preview;
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

- invalidate the local path;
- keep source metadata where possible;
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

## Milestone Definition

### v0.2.0 — Native Photo Browser

Must include:

- embedded `QLPreviewView` spike integrated into the Tauri window;
- local folder loading;
- native-quality local main preview;
- Quick Look thumbnails for local files;
- download-original-to-cache for native inspection;
- exported originals preview through the same native pipeline;
- regression comparison against Finder Quick Look + Preview.app;
- no intermediate JPEG/PNG conversion in the local main-preview path.

Camera streaming/sidecar/release work remains important, but the native preview engine is now the first architectural milestone because it defines the long-term rendering foundation shared by local and exported photos.
