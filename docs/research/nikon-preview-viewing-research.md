# Nikon Preview and Viewing Research

## Scope

This note records the preview/viewing strategy for macOS only. The target
camera evidence is Nikon Z6III, but the implementation should stay behind the
existing camera provider boundary so other Nikon PTP bodies can be tested later.

The goal is not general tethered shooting. The immediate problem is browsing a
camera/card smoothly: fast list, fast grid thumbnails, and a usable selected
preview without downloading every original.

Current-stage success metrics:

- Selected preview clarity is the first priority. The current selected image
  must resolve to a clear-enough preview, then the backend should preload the
  rest of the next screen of full/large previews behind it.
- Horizontal preview-list switching must stay smooth. When the user moves
  through the strip, the app should lazy-load the remaining preview images
  without blocking navigation or replacing the current clear preview with a
  lower-quality asset.

## Current project state

The app currently uses a macOS ImageCaptureCore helper as the default real
camera backend. It is a persistent NDJSON daemon, which is the right process
shape because camera startup and object enumeration are expensive.

The existing gphoto2 Z6III probe in `docs/research/gphoto2-ptp-z6iii.md`
measured the cost of using the `gphoto2` CLI against a real card with 2477
files:

```text
gphoto2 --summary                                      1.11s
gphoto2 --list-folders                                11.43s
gphoto2 --list-files                                  11.76s for 2477 files
gphoto2 --get-thumbnail 1                             11.20s for 8.7KB
gphoto2 --get-thumbnail 1-10                          11.29s for 10 thumbnails
gphoto2 --get-file 1                                  11.72s for 8.3MB JPG
```

Interpretation: per-command CLI startup and camera/session/object setup dominate
single preview latency. Any production path must keep one camera session alive
and batch thumbnail/preview work. A `gphoto2` process per selected photo would
not solve the UX problem.

## Channel 1: open-source Nikon projects

### Coverage and evidence level

This is representative coverage, not a claim that every camera project on
GitHub has been reviewed. The survey prioritized projects that are directly
relevant to this app's problem:

- Nikon or modern interchangeable-lens cameras over USB PTP/MTP.
- macOS relevance where available.
- Preview, thumbnail, capture preview, camera browsing, or photo review.
- Recent activity in 2025-2026.
- Source code available, not only marketing pages.

The resulting conclusion should be read narrowly: there is no mature
open-source macOS Nikon gallery browser that can simply be copied into this
project. The reusable open-source layer is the protocol layer, mainly
libgphoto2's PTP/MTP implementation and its Nikon vendor extensions.

Current repository quality snapshot, checked on 2026-09-05:

| Repository | Stars | Forks | Last push | Role in decision | Quality read |
| --- | ---: | ---: | --- | --- | --- |
| `gphoto/libgphoto2` | 1365 | 380 | 2026-09-02 | Core PTP/MTP implementation | Strongest open-source evidence. Mature C library, active maintenance, Nikon Z6III support appears in recent release notes, exposes Nikon large thumbnail and partial object functions. |
| `gphoto/gphoto2` | 891 | 122 | 2026-06-22 | CLI/reference client over libgphoto2 | Good diagnostic and behavior reference. Not recommended as per-photo production path because process/session startup is expensive. |
| `afkal/nikon-camera-controller` | 0 | 0 | 2026-02-16 | Nikon Z6III macOS app sample | Useful but weak evidence. It is Nikon-specific and macOS-focused, but very new, no adoption signal, and mostly uses Python gphoto2 bindings for capture/control rather than large-card browsing. |
| `AstroWimSara/SolarEclipseWorkbench` | 20 | 7 | 2026-08-07 | Photography automation using Python gphoto2 bindings | Useful for long-lived camera objects, locking, capture preview, and practical PTP error handling. Domain is eclipse shooting, not gallery browsing. |
| `biglinux/bigcam` | 13 | 4 | 2026-08-17 | Generic camera/live preview app | Useful for process/session lessons: it explicitly calls out persistent gphoto2 streaming sessions and OS service contention. Linux-only, so not directly reusable for macOS UI/backend. |
| `alfanick/mini-film` | 17 | 0 | 2026-09-03 | Photo review/import workflow | Useful for review workflow and mounted PTP/MTP import thinking. It is Linux-mounted-camera oriented and does not solve macOS USB PTP ownership. |
| `damonlynch/rapid-photo-downloader` | 187 | 33 | 2026-08-06 | Mature downloader workflow | Useful as a quality/adoption comparator for import workflows. Linux desktop target; not a direct Nikon/macOS preview backend. |
| `jim-easterbrook/python-gphoto2` | 424 | 57 | 2026-09-05 | Python bindings over libgphoto2 | Strong binding-layer reference, active and useful for prototypes. Not a separate backend strategy because it still relies on libgphoto2 underneath. |
| `dukus/digiCamControl` | 733 | 236 | 2025-05-26 | Windows DSLR control app | Good adoption signal and relevant to Nikon control concepts, but it is Windows/C# oriented and not a macOS path for this project. |
| `meklarian/MekNikon` | 10 | 1 | 2024-03-29 | .NET Nikon SDK wrapper | Relevant to Nikon MAID/SDK control, but small, stale-ish, and not macOS-focused. Useful as a warning/reference, not as a target architecture. |
| `leirf/libptp` | 4 | 4 | 2016-05-05 | Older PTP library | Obsolete for this project. Too small and inactive compared with libgphoto2's maintained PTP/MTP implementation. |

Additional ecosystem check, also current on 2026-09-05:

| Repository/project | Stars | Forks | Last push | Role in decision | Quality read |
| --- | ---: | ---: | --- | --- | --- |
| `darktable-org/darktable` | 13022 | 1421 | 2026-09-05 | Mature photo workflow/tethering app | Strong evidence that libgphoto2 remains a current camera-control dependency in serious photo software. It uses `gp_camera_capture`, `gp_camera_capture_preview`, `gp_camera_file_get`, and one shared gphoto context. It is not a Nikon card browser for this app. |
| `GNOME/shotwell` | 166 | 45 | 2026-09-03 | Desktop photo importer/manager | Useful as a desktop import workflow reference and another libgphoto2 ecosystem signal. Not Nikon-specific and not a macOS backend reference. |
| `jesperpedersen/entangle` GitHub mirror | 9 | 2 | 2015-09-27 | Tethered camera-control app | The GitHub mirror is stale; the project itself documents libgphoto2 as the core camera layer and points to GitLab for current code. Use only as ecosystem evidence, not as current GitHub quality evidence. |
| `SauceTaster/libgphoto2-rs` | 0 | 2 | 2026-06-19 | Rust bindings over libgphoto2 | Potentially interesting for Rust prototypes, but too small to anchor production architecture. Direct C FFI or a small helper remains lower risk. |

Conclusion strength:

- Strong: libgphoto2 is current and directly relevant for PTP/MTP object access.
  This is supported by active upstream maintenance, recent Nikon Z-series
  changes, and continued use in larger photo applications.
- Strong: one persistent camera session is required for good UX. This is
  supported by local Z6III CLI timing, libgphoto2's session architecture, and
  higher-level applications that keep camera objects/contexts alive.
- Medium: Nikon/macOS apps using gphoto2 exist, but the Nikon-specific GitHub
  sample is too small/new to treat as a mature reference.
- Medium: Windows Nikon SDK/MAID apps exist and have adoption, but they do not
  answer the macOS packaging/runtime problem.
- Weak: open-source projects do not provide enough public, comparable benchmark
  data for Z6III `GetLargeThumb` or large-card browsing. That still needs our
  own hardware probe.

The plan is therefore not "copy an open-source Nikon app." It is "use
libgphoto2/PTP as the mature protocol layer, keep our app architecture, and
measure the Nikon-specific preview commands on hardware." A more precise
wording is: GitHub does not show a mature macOS Nikon gallery browser to copy;
the maintainable open-source protocol route converges on libgphoto2/PTP, while
the product-specific behavior still needs our own Z6III hardware measurements.

### libgphoto2 / gphoto2

Repository:

- https://github.com/gphoto/libgphoto2
- https://github.com/gphoto/gphoto2

What it does:

- Implements the PTP/MTP transport and camera-specific operations in an
  open-source C library.
- The `ptp2` camera library handles USB and PTP/IP sessions, object listing,
  thumbnails, full objects, capture preview, live view, and Nikon vendor
  extensions.
- The CLI exposes `--get-thumbnail`, `--get-file`, `--capture-preview`, and
  shell mode on top of libgphoto2.

Relevant implementation evidence:

- `libgphoto2/camlibs/ptp2/ptp.h` defines normal PTP operations including
  `GetObject`, `GetThumb`, `GetPartialObject`, plus Nikon vendor helpers such
  as `ptp_nikon_getlargethumb`, `ptp_nikon_getobjectsize`, and
  `ptp_nikon_getpartialobjectex`.
- `libgphoto2/camlibs/ptp2/library.c` opens one PTP session, restores Nikon
  vendor extension IDs when cameras report as MTP, builds a filesystem cache,
  and wires file-system callbacks for list/get/read operations.
- `gphoto2/gphoto2/main.c` maps CLI `--get-thumbnail` to
  `GP_FILE_TYPE_PREVIEW` and supports ranges, so batched thumbnail requests use
  one process/session instead of N process startups.

Performance implication:

- The measured local data already matches this architecture: fetching 10
  thumbnails took nearly the same wall time as fetching 1 thumbnail because the
  fixed session/enumeration cost dominates.
- libgphoto2 is a good candidate for a persistent helper, but the CLI is only a
  diagnostic/smoke-test tool.

Risk:

- On macOS, Image Capture/PTP services can claim the same USB camera. The
  app must not run ImageCaptureCore and gphoto2/libgphoto2 against the same
  camera concurrently.
- Bundling libgphoto2 in a signed macOS app is extra packaging work.

### afkal/nikon-camera-controller

Repository:

- https://github.com/afkal/nikon-camera-controller

What it does:

- Nikon-focused web UI for macOS, built with Python/FastHTML/HTMX.
- Supports Nikon Z6 III and other Nikon models with gPhoto2 PTP/MTP support.
- Uses gPhoto2 as a required dependency and asks the user to connect the camera
  over USB in PTP/MTP mode.
- The project states it handles macOS PTP contention by running `killall
  PTPCamera` when connecting.

Implication:

- This is a useful product-level reference because it validates the same
  high-level direction: Nikon Z6III + macOS + gPhoto2 is viable.
- Its preview/history focus appears centered on captured/downloaded session
  files and exposure analysis, not large-card browsing with thousands of
  existing photos. It does not replace the need for a persistent, batched
  browser helper in this app.

Risk:

- Killing `PTPCamera` is an aggressive UX/system action. For this project,
  prefer an explicit opt-in gphoto2 backend with clear diagnostics before doing
  any automatic process management.

### python-gphoto2

Repository:

- https://github.com/jim-easterbrook/python-gphoto2

What it does:

- Provides Python bindings to libgphoto2.
- Its examples include `capture_preview` and normal camera initialization.
- Several higher-level projects use the binding to keep a `gp.Camera` object
  alive instead of repeatedly spawning the CLI.

Implication:

- Good prototype path for validating `GetThumb` / `GetLargeThumb` behavior
  quickly.
- Not ideal as the final production backend for this Tauri app because it adds
  Python runtime packaging. A Rust/C/C++ helper linked to libgphoto2 is cleaner
  for distribution.

### digiCamControl

Repository:

- https://github.com/dukus/digiCamControl

What it does:

- Mature Windows DSLR camera remote-control application.
- Originated from a Nikon camera-control codebase and has meaningful adoption
  signals.

Implication:

- Useful for comparing remote-control workflows and UI concepts.
- Not a macOS implementation route. It does not reduce this project's need to
  solve macOS USB claiming, app signing, and preview caching.

### Nikon MAID / SDK wrappers

Repositories:

- https://github.com/meklarian/MekNikon
- https://github.com/1TTT9/NikonCSWrapper

What they do:

- Wrap Nikon's MAID/SDK APIs from .NET/C#.
- Focus on camera control, capture, LiveView, and settings.

Implication:

- They support the idea that Nikon's SDK can control cameras, but they are not
  strong evidence for macOS large-card browsing.
- The local Nikon SDK package is v2.0.0 and includes universal macOS binaries,
  so older "MAID is x86-only" articles must not be applied blindly to this
  package. Still, these projects show that MAID-style SDK usage tends to be
  vendor-specific and less portable than libgphoto2/PTP.

### libptp2

Repository:

- https://github.com/leirf/libptp

What it does:

- Older PTP library and `ptpcam` style tooling.

Implication:

- Not a good candidate now. It is inactive and tiny compared with libgphoto2,
  which has current Nikon Z-series work and active security/compatibility fixes.

### Other observed open-source patterns

Projects built on gphoto2 often use `capture_preview` for live shooting preview
or exposure workflows. That path transfers a small JPEG preview and avoids
writing an original file, but it is not the same operation as browsing existing
card images. For this app's gallery problem, existing-card commands
(`GetThumb`, Nikon `GetLargeThumb`, partial object fetch, and batched object
metadata) matter more than repeated live capture preview.

The mature general-purpose apps strengthen the "libgphoto2 is not obsolete"
part of the conclusion, but they do not remove the core implementation work for
this project. Their workflows are mostly tethered capture or import. This app
needs selected-photo viewing from an existing camera/card, so `GetLargeThumb`,
`GetPartialObjectEx`, and caching behavior must be measured directly.

## Channel 2: official Nikon docs

### Nikon SDK site

Official source:

- https://sdk.nikonimaging.com/information/en/
- https://sdk.nikonimaging.com/apply/
- https://sdk.nikonimaging.com/apply/guide

Findings:

- Nikon's current official path is Remote Module SDK Ver. 2.0.0 for Z-series.
- The official information page says the unified SDK supports Z9, Z8, Z6III,
  Z7II, Z6II, Z7, Z6, Z5II, Z5, Zf, Z50II, Z50, Z30, Zfc, and ZR.
- The download/apply page lists Z-series v2.0.0 updated on 2026-03-31.
- The SDK is free after Nikon's application flow, but Nikon states no technical
  support is provided.

### Local SDK package

Local package:

- `/Users/shouyong/Downloads/S-SDKZ-200BF-ALLIN`

Mac-specific findings:

- Package identifies itself as Remote SDK v2.0.0.
- macOS support in the readme includes Ventura 13, Sonoma 14, Sequoia 15, and
  Tahoe 26.
- Nikon's Mac sample uses `TypeCommon Module.bundle`,
  `libNkPTPDriver2.dylib`, `Royalmile.framework`, and config files under
  `~/Library/Preferences/Nikon/NXTether`.
- Binaries inspected from `Module/Mac/BinaryFile/TestApp.zip` are universal
  `x86_64 arm64` and Developer ID signed.
- The sample app loads `TypeCommon Module.bundle` dynamically with
  `CFBundleCreate` / `CFBundleLoadExecutable` and resolves exported C symbols,
  instead of linking a conventional `libNikonSDK.dylib`.
- Exported symbols cover camera connection, capabilities, shooting, LiveView,
  movie recording, image/video save path, and MAID entry points.
- The readme says the Remote SDK cannot control two or more cameras
  simultaneously and warns to quit Camera Control Pro 2, NX Tether, and Nikon
  Transfer 2 before connecting.

Implication:

- The official Remote SDK is a credible later track for camera control,
  capture, and LiveView.
- It is not yet the cleanest proof for browsing thousands of existing card
  objects. The public sample/header path did not expose a simple documented
  "large card preview by object handle" API during the local inspection.
- If this SDK is used later, mirror Nikon's sample loading pattern in a macOS
  sidecar helper. Do not assume a stable link-time `libNikonSDK.dylib`.

### Nikon Z6III USB MTP command documentation

Local official command PDF:

- `/Users/shouyong/Downloads/S-SDKZ-200BF-ALLIN/Command/English/Z6IIIUsbMtpE_02.pdf`

Preview/viewing relevant commands:

- `GetObjectHandles`
- `GetObjectInfo`
- `GetObject`
- `GetThumb`
- Nikon vendor `GetLargeThumb`
- `GetPartialObject`
- Nikon vendor `GetPartialObjectHighSpeed`
- Nikon vendor `GetPartialObjectEx`
- Nikon vendor `GetObjectSize`
- Nikon vendor `GetObjectsMetaData`
- MTP object property commands including `GetObjectPropsSupported`,
  `GetObjectPropDesc`, `GetObjectPropValue`, `SetObjectPropValue`, and
  `GetObjectPropList`

Important details:

- `GetThumb` returns a small 160x120 thumbnail.
- `GetLargeThumb` returns a larger thumbnail/reference JPEG image and is the
  strongest official clue for main-preview quality without downloading the
  original.
- `GetObjectsMetaData` can return object handles plus metadata in bulk. The
  documented object attribute bits include protection and rating flags.
- The same document also defines rating as MTP object property `0xDC8A`, with
  values `0`, `1`, `25`, `50`, `75`, and `100` mapping to none through five
  stars. Rating is not the current focus, but this confirms the command family
  used for future write-back is MTP object properties, not necessarily the
  Remote SDK sample API.

Implication:

- Official Nikon documentation does contain the primitives needed for preview
  and viewing.
- The most direct implementation path is a PTP/MTP backend that can issue these
  object commands while holding one persistent session.

## Recommended landing strategy

### Phase 1: keep current backend stable

- Keep ImageCaptureCore as the default backend.
- Continue using selected-photo priority and neighbor thumbnail prefetching in
  the frontend.
- Add diagnostics around preview latency and cache hit/miss behavior before
  changing more UI code.

### Phase 2: add an opt-in persistent PTP backend

- Implement behind the existing Rust camera provider boundary.
- Gate with `NIKON_CAMERA_BACKEND=gphoto2` at first.
- Use a helper process, not one CLI call per request.
- Prefer direct libgphoto2 integration or a thin native helper linked to
  libgphoto2.
- Serialize or strictly limit all operations that touch the same physical
  camera/session. Use concurrency above and below the camera boundary, but do
  not let multiple uncontrolled PTP commands race against one camera.
- Keep frontend commands unchanged:
  `list_photos`, `cache_photo_preview`, `cache_photo_previews`, and
  `export_photos`.

Preview policy:

- Listing: use storage/object metadata and avoid fetching image bytes.
- Horizontal strip/list: fetch small thumbnails lazily in batches around the
  visible range. Do not require the whole card's thumbnails before the strip is
  interactive.
- Selected main preview: try Nikon `GetLargeThumb` first and keep it as the
  minimum clear-preview target for both JPG and NEF.
- One-screen lookahead: after the current image reaches clear-preview quality,
  preload the remaining full/large previews for the next visible screen in
  navigation order.
- Fallback: use partial-object reads to extract enough JPEG/reference data when
  large thumbnail is unavailable or too small.
- Last resort: download the original selected file only; do not download every
  original for list browsing.

Concurrency, async, and cache policy:

- UI must be fully asynchronous. Selection changes should update local state
  immediately and issue preview requests through a scheduler, never wait for
  camera I/O on the interaction path.
- Use a priority queue for camera work. Priority order:
  current selected large preview, next-screen large preview lookahead, visible
  strip thumbnails, near-neighbor thumbnails, off-screen/background work.
- Coalesce duplicate requests by photo id plus requested quality. If the same
  thumbnail or large preview is already pending, attach the new caller to the
  existing task instead of enqueueing another camera command.
- Make background work cancellable or demotable. When selection jumps, obsolete
  lookahead tasks should stop before camera I/O starts, or drop their result if
  they finish late.
- Keep camera transport operations behind one session-owned async executor.
  The executor may batch adjacent thumbnail requests, but should avoid
  unconstrained parallel calls into libgphoto2/Nikon PTP for the same device.
- Decode, resize, hash, and write cache files off the UI thread. These CPU and
  disk steps can run concurrently with future camera reads, bounded by a small
  worker pool.
- Use multi-layer caching: in-memory LRU for visible thumbnails and current
  previews, disk cache for thumbnails/large previews keyed by camera id,
  storage id, object handle/path, size, mtime/capture time, and requested
  quality, plus metadata cache for warm list startup.
- Prefer stale-while-revalidate behavior for browsing. If a cached thumbnail or
  large preview is available, show it immediately, then refresh only when object
  metadata indicates it may have changed.
- Enforce cache budgets separately for thumbnails, large previews, and originals
  so one large-file path cannot evict all navigation assets.
- Emit timing and cache metrics per request: queue wait, camera read time,
  decode time, cache hit/miss, bytes read, requested quality, and final
  displayed quality.

### Phase 3: hardware probes before productizing

Measure on the Z6III:

- Cold list time for a large card.
- Warm list time with object cache.
- Batched `GetThumb` latency for 10, 50, and 100 images.
- `GetLargeThumb` latency and pixel dimensions for JPG and NEF objects.
- Partial-object preview feasibility for NEF.
- Contention behavior when ImageCaptureCore or macOS `PTPCamera` owns the
  device.

Acceptance bar:

- List should not block the UI thread.
- Horizontal strip/list should stay responsive while thumbnails for off-screen
  or not-yet-visible items are still loading.
- The currently selected image should reach clear-preview quality before
  spending bandwidth on lower-priority neighbors.
- After the selected image is clear, the next screen of images should be
  preloaded as full/large previews so short horizontal navigation feels
  immediate.
- Preview loading should be cancellable or deprioritized when the user jumps to
  a different region of the strip.
- Selected preview should use large thumbnail/reference JPEG when available and
  avoid full original download in the common case.
- Backend errors should distinguish "camera busy", "macOS owns device",
  "operation unsupported", and "object vanished".

## Current decision

For preview/viewing, treat Nikon's official MTP command document plus
libgphoto2's Nikon PTP implementation as the main technical path. Treat Nikon
Remote Module SDK v2.0.0 as a secondary official SDK track for remote control,
capture, and LiveView until a card-browsing preview API is proven in its
headers/samples.

The next implementation should therefore extend the existing gphoto2 backend
plan rather than rewriting the app around the Nikon Remote SDK.
