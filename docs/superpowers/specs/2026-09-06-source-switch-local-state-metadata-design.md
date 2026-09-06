# Source Switching, Local State, and Photo Metadata Design

## Goal

Define how Nikon Connector switches between a connected Nikon Z6III and a local folder inside one review workspace, how camera photos become local/native-quality items after download or export, and how shooting metadata is represented consistently across camera and local sources.

This spec complements `2026-09-06-native-preview-engine-design.md`.

---

## 1. Workspace Source Switching

The application should expose one explicit source selector inside the existing workspace.

Conceptually:

```text
Source
├── Nikon Z6III    ● Connected
└── Local Folder   /Users/.../Photos
```

The user can switch between the connected Z6III catalog and a local-folder catalog without opening a second window or entering a separate product mode.

### Z6III -> Local Folder

Expected flow:

```text
Z6III connected
-> user switches source to Local Folder
-> if no folder has been selected for this session, show folder picker
-> user selects local folder
-> enumerate local images
-> workspace changes to local catalog
-> selected local image renders through Native Preview Engine
```

### Local Folder -> Z6III

Expected flow:

```text
Local Folder active
-> user switches source to Nikon Z6III
-> restore the current connected-camera catalog
-> restore previous camera selection when possible
-> camera review preview resumes
```

Switching away from the camera must not implicitly disconnect the physical camera. The camera session may remain alive in the background so returning to Z6III is fast.

### Session state

Maintain separate lightweight workspace state per source:

```ts
type SourceWorkspaceState = {
  selectedPhotoId?: string;
  scrollAnchorPhotoId?: string;
  filterState: PhotoFilterState;
  sortState: PhotoSortState;
};
```

Camera and local folder can therefore restore their own selection and filmstrip position after switching.

### Local folder path

The folder picker should accept normal folders and symlinked folders supported by macOS.

For a symlinked directory:

- resolve a canonical path for file identity and duplicate/cache protection;
- preserve the user-selected display path for UI when useful;
- do not allow symlink resolution to create duplicate catalog entries for the same canonical file;
- handle broken symlinks as an unavailable-folder error.

---

## 2. One Catalog Item Can Have Both Camera and Local Identity

A camera photo must not become a second unrelated photo after download/export.

The catalog should preserve one review identity and attach local availability to it.

Recommended model:

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
  byteSize?: number;
  modifiedAt?: string;
};

type PhotoLocalState =
  | { status: "none" }
  | { status: "downloading"; progress?: number }
  | { status: "available"; copies: LocalCopy[]; preferredPath: string }
  | { status: "missing"; previousPath: string };
```

A camera catalog item may therefore look like:

```ts
{
  id: "camera-photo-stable-id",
  source: {
    kind: "camera",
    cameraId: "...",
    storageId: "...",
    objectHandle: 12345,
  },
  localState: {
    status: "available",
    copies: [
      {
        kind: "export",
        filePath: "/Users/.../DSC_1234.NEF",
        canonicalPath: "/Users/.../DSC_1234.NEF",
      }
    ],
    preferredPath: "/Users/.../DSC_1234.NEF",
  }
}
```

The camera identity remains the same, so Pick/Reject, rating, current selection, and metadata stay attached to the original review item.

---

## 3. Local Badge / State in the UI

Whenever `localState.status === "available"`, the image must be visibly marked as available locally.

Minimum UI requirement:

- filmstrip thumbnail: small local/disk badge;
- inspector/details: `Local` status + path source (`Cache` or `Exported`);
- optional tooltip: local path;
- main preview chooses Native Quality automatically.

Suggested state labels:

```text
相机          camera-only
下载中        downloading original
本地          local original available
本地文件丢失   previously local, path unavailable
```

Do not create a separate duplicate thumbnail in the camera catalog merely because the file was downloaded.

If the same physical file also appears while browsing its local folder, the local-folder catalog can have its own local-source item, but the camera workspace must still retain its own stable item and local-availability marker.

---

## 4. Native Quality Routing for Camera Items

The display routing rule becomes:

```text
selected photo
   |
   +-- localState.available
   |      -> preferred local original
   |      -> QLPreviewView
   |      -> quality = native
   |
   +-- no local original
          -> camera review preview
          -> quality = review
```

This means a camera item can upgrade in place:

```text
Z6III Review Quality
-> Download Original / Export
-> Local badge appears
-> same selected item
-> Native Quality
```

No user re-selection is required after the download completes.

---

## 5. Photo Metadata Is Core Catalog Data

Shooting metadata is a core feature for v0.2/v0.3, not only a future analytics feature.

At minimum normalize the following fields:

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

The UI inspector should initially prioritize:

```text
Camera / Lens
Focal Length
Aperture
Shutter
ISO
Captured At
Dimensions
```

Example display:

```text
Nikon Z6III
NIKKOR Z 24-120mm f/4 S
70 mm
f/4
1/250 s
ISO 800
2026-09-06 18:42:31
6048 × 4032
```

---

## 6. Metadata Sources and Priority

### Local original exists

Use local-file metadata as the authoritative source whenever possible.

```text
original local file
-> ImageIO / CGImageSource metadata
-> normalize PhotoMetadata
-> catalog
```

This applies to:

- local-folder photos;
- downloaded camera originals;
- exported camera originals.

### Camera-only item

Use camera/ImageCaptureCore metadata lazily.

```text
camera catalog
-> lightweight identity first
-> selected/visible item metadata request
-> normalize PhotoMetadata
-> catalog merge
```

Do not block first catalog rendering on EXIF for the full card.

### Merge priority

Recommended priority:

```text
local original metadata
> explicit camera metadata response
> lightweight catalog fields
```

A metadata refresh must never erase rating, Pick/Reject, thumbnail URLs, preview state, local-state, or selection identity.

---

## 7. Metadata Loading State

Add explicit state rather than interpreting missing fields as final absence:

```ts
type MetadataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; metadata: PhotoMetadata }
  | { status: "unavailable"; reason?: string }
  | { status: "error"; message: string };
```

Behavior:

- selected image metadata loads first;
- visible filmstrip items may load metadata at lower priority;
- local-file metadata should generally be cheap enough to load eagerly in small batches, but must not block thumbnail/navigation responsiveness;
- camera full-card metadata prefetch remains prohibited.

---

## 8. v0.2 Acceptance Criteria

### Source switching

- Z6III and Local Folder are selectable from the same workspace.
- Switching to Local Folder opens a folder picker when needed.
- Switching back restores the connected-camera workspace without reconnecting when the session is still healthy.
- Local-folder selection supports normal macOS folders and valid symlinked folders.

### Local availability

- Downloading/exporting a camera photo attaches a local path to the existing camera item.
- The item visibly shows a `Local` state.
- The same camera item automatically routes to Native Quality once a valid local original exists.
- Pick/Reject/rating remain intact before and after the transition.

### Metadata

- Local JPG and Z6III NEF expose at least lens, focal length, aperture, shutter, ISO, captured time, and dimensions when the file contains those fields.
- Camera-only selected items load available shooting metadata lazily.
- Inspector renders missing/unavailable metadata gracefully.
- Metadata loading never delays the first camera catalog batch.
