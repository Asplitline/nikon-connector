# gphoto2 PTP Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional gphoto2/libgphoto2 PTP backend for Nikon Z6III USB browsing that avoids ImageCaptureCore preview bottlenecks while keeping one user-facing desktop app.

**Architecture:** Preserve the existing React and Tauri command contract. Add a Rust provider selector behind `src-tauri/src/camera/mod.rs`, then add a persistent macOS helper process for gphoto2-backed camera access. The helper owns one PTP session and serializes all camera operations so thumbnails, selected previews, and exports do not compete for the same USB interface.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Swift helper for the current ImageCaptureCore backend, Homebrew gphoto2/libgphoto2 for local verification, JSON over stdio for helper communication.

**Spec:** `docs/research/gphoto2-ptp-z6iii.md`

## Global Constraints

- Keep the existing frontend camera API in `src/lib/cameraApi.ts` stable.
- Keep ImageCaptureCore as the default backend until gphoto2 is verified inside the app.
- Use `NIKON_CAMERA_BACKEND=gphoto2` as the initial opt-in switch.
- Do not invoke one `gphoto2` process per image in production code.
- Serialize all PTP operations through one backend queue.
- Grid/list images use thumbnails only; the selected main preview may request a larger image.
- Do not run ImageCaptureCore and gphoto2 against the same camera at the same time.
- Every shell command in this repository must be prefixed with `rtk`.

---

### Task 1: Provider Selection Boundary

**Files:**
- Modify: `src-tauri/src/camera/mod.rs`
- Modify: `src-tauri/src/camera/helper_bridge.rs`
- Create: `src-tauri/src/camera/backend.rs`
- Test: `src-tauri/src/camera/backend.rs`

**Interfaces:**
- Consumes: existing public functions in `src-tauri/src/camera/mod.rs`
- Produces: `CameraBackendKind`, `selected_backend_from_env`, and `CameraBackendError`

- [ ] **Step 1: Write failing backend selection tests**

Add this test module to the new `src-tauri/src/camera/backend.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_image_capture_on_macos() {
        assert_eq!(
            selected_backend_from_env(None, TargetOs::Macos),
            CameraBackendKind::ImageCapture
        );
    }

    #[test]
    fn honors_gphoto2_env_on_macos() {
        assert_eq!(
            selected_backend_from_env(Some("gphoto2"), TargetOs::Macos),
            CameraBackendKind::Gphoto2
        );
    }

    #[test]
    fn falls_back_to_mock_off_macos() {
        assert_eq!(
            selected_backend_from_env(Some("gphoto2"), TargetOs::Other),
            CameraBackendKind::Mock
        );
    }

    #[test]
    fn unknown_backend_returns_image_capture_on_macos() {
        assert_eq!(
            selected_backend_from_env(Some("unknown"), TargetOs::Macos),
            CameraBackendKind::ImageCapture
        );
    }
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk cargo test --lib camera::backend
```

Expected: fail because `src-tauri/src/camera/backend.rs` and the named types do not exist.

- [ ] **Step 3: Implement backend selector**

Create `src-tauri/src/camera/backend.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CameraBackendKind {
    ImageCapture,
    Gphoto2,
    Mock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetOs {
    Macos,
    Other,
}

pub fn current_target_os() -> TargetOs {
    if cfg!(target_os = "macos") {
        TargetOs::Macos
    } else {
        TargetOs::Other
    }
}

pub fn selected_backend_from_env(value: Option<&str>, target_os: TargetOs) -> CameraBackendKind {
    match target_os {
        TargetOs::Other => CameraBackendKind::Mock,
        TargetOs::Macos => match value.unwrap_or("").trim().to_ascii_lowercase().as_str() {
            "gphoto2" => CameraBackendKind::Gphoto2,
            "imagecapture" | "image_capture" | "" => CameraBackendKind::ImageCapture,
            _ => CameraBackendKind::ImageCapture,
        },
    }
}

pub fn selected_backend() -> CameraBackendKind {
    selected_backend_from_env(
        std::env::var("NIKON_CAMERA_BACKEND").ok().as_deref(),
        current_target_os(),
    )
}
```

- [ ] **Step 4: Wire selector without changing behavior**

In `src-tauri/src/camera/mod.rs`, add:

```rust
mod backend;
```

Use `backend::selected_backend()` in `list_cameras`, `list_photos`, `cache_photo_previews`, and `export_photos`. For this task, both `ImageCapture` and `Gphoto2` branches can call the existing ImageCapture helper while logging that gphoto2 is not implemented yet:

```rust
eprintln!("[nikon-connector] selected camera backend: {:?}", backend::selected_backend());
```

- [ ] **Step 5: Run tests**

Run:

```bash
rtk cargo test --lib camera::backend
rtk cargo check --lib
```

Expected: tests and check pass.

### Task 2: gphoto2 Capability Probe

**Files:**
- Create: `src-tauri/src/camera/gphoto2_probe.rs`
- Modify: `src-tauri/src/camera/mod.rs`
- Test: `src-tauri/src/camera/gphoto2_probe.rs`

**Interfaces:**
- Consumes: `CameraBackendKind::Gphoto2`
- Produces: `Gphoto2Probe`, `find_gphoto2_binary`, `parse_auto_detect_output`

- [ ] **Step 1: Write parser tests**

Create `src-tauri/src/camera/gphoto2_probe.rs` with tests first:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nikon_z6iii_auto_detect() {
        let output = "Model                          Port\n----------------------------------------------------------\nNikon Z6 III                   usb:000,001\n";
        let cameras = parse_auto_detect_output(output);
        assert_eq!(cameras.len(), 1);
        assert_eq!(cameras[0].name, "Nikon Z6 III");
        assert_eq!(cameras[0].port, "usb:000,001");
    }

    #[test]
    fn ignores_header_only_auto_detect_output() {
        let output = "Model                          Port\n----------------------------------------------------------\n";
        assert!(parse_auto_detect_output(output).is_empty());
    }
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk cargo test --lib camera::gphoto2_probe
```

Expected: fail because parser types/functions are missing.

- [ ] **Step 3: Implement parser and binary probe**

Implement:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Gphoto2Camera {
    pub name: String,
    pub port: String,
}

pub fn parse_auto_detect_output(output: &str) -> Vec<Gphoto2Camera> {
    output
        .lines()
        .skip_while(|line| !line.starts_with("---"))
        .skip(1)
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let port_start = trimmed.rfind("usb:")?;
            Some(Gphoto2Camera {
                name: trimmed[..port_start].trim().to_string(),
                port: trimmed[port_start..].trim().to_string(),
            })
        })
        .collect()
}

pub fn find_gphoto2_binary() -> Option<std::path::PathBuf> {
    std::env::var_os("GPHOTO2_BIN")
        .map(std::path::PathBuf::from)
        .or_else(|| which::which("gphoto2").ok())
}
```

Add `which` only if the repository does not already have a command lookup helper. If adding it, update `src-tauri/Cargo.toml`.

- [ ] **Step 4: Add opt-in diagnostic log**

When `NIKON_CAMERA_BACKEND=gphoto2`, log whether `gphoto2` is available and the path used. Do not replace ImageCapture behavior yet.

- [ ] **Step 5: Run tests**

Run:

```bash
rtk cargo test --lib camera::gphoto2_probe
rtk cargo check --lib
```

Expected: tests and check pass.

### Task 3: PTP Contention Diagnostic

**Files:**
- Modify: `src/features/photos/connectionDiagnostics.ts`
- Modify: `src/features/photos/connectionDiagnostics.test.ts`
- Modify: `src/i18n.ts`
- Modify: `src/i18n.test.ts`

**Interfaces:**
- Consumes: existing connection state and error messages
- Produces: a user-visible diagnostic for `Could not claim the USB device`

- [ ] **Step 1: Add failing diagnostic test**

Add a test case that passes an error string containing:

```text
Could not claim the USB device
MacOS PTPCamera service
```

Expected user message:

```text
相机已连接，但 macOS 图像捕捉或 PTP 服务正在占用它。请退出图像捕捉，再重新扫描。
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk bunx vitest run src/features/photos/connectionDiagnostics.test.ts src/i18n.test.ts
```

Expected: fail because the diagnostic key is missing.

- [ ] **Step 3: Implement diagnostic matcher**

In `connectionDiagnostics.ts`, detect case-insensitive substrings:

```text
could not claim the usb device
ptpcamera
```

Return a dedicated diagnostic code such as `camera.ptpDeviceBusy`.

- [ ] **Step 4: Add i18n copy**

Add Chinese copy:

```text
相机已连接，但 macOS 图像捕捉或 PTP 服务正在占用它。请退出图像捕捉，再重新扫描。
```

Add the matching title:

```text
相机被系统占用
```

- [ ] **Step 5: Run tests**

Run:

```bash
rtk bunx vitest run src/features/photos/connectionDiagnostics.test.ts src/i18n.test.ts
```

Expected: tests pass.

### Task 4: Persistent Helper Protocol

**Files:**
- Create: `src-tauri/src/camera/gphoto2_session.rs`
- Create: `src-tauri/tests/gphoto2_session_protocol.rs`
- Modify: `src-tauri/src/camera/mod.rs`

**Interfaces:**
- Consumes: `CameraPhoto`, `CachedPhotoPreview`, `ExportPhotosSummary`
- Produces: `Gphoto2Session`, `Gphoto2Request`, `Gphoto2Response`

- [ ] **Step 1: Write protocol serialization tests**

Create request/response JSON tests for:

```json
{"id":1,"command":"list_cameras"}
{"id":2,"command":"cache_photo_previews","camera_id":"usb:000,001","photo_ids":["1","2"],"preview_photo_ids":["1"]}
{"id":3,"command":"shutdown"}
```

Assert that the structs serialize and deserialize with snake_case fields.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk cargo test --test gphoto2_session_protocol
```

Expected: fail because protocol structs do not exist.

- [ ] **Step 3: Implement protocol structs**

Use `serde` enums with tagged commands:

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum Gphoto2RequestBody {
    ListCameras,
    ListPhotos { camera_id: String },
    CachePhotoPreviews {
        camera_id: String,
        photo_ids: Vec<String>,
        preview_photo_ids: Vec<String>,
    },
    ExportPhotos {
        camera_id: String,
        destination_dir: String,
        photo_ids: Vec<String>,
    },
    DiagnoseCamera { camera_id: String },
    Shutdown,
}
```

Wrap it with an `id: u64` request envelope and response envelope.

- [ ] **Step 4: Add session process wrapper**

Implement `Gphoto2Session` with:

- `start(helper_path: PathBuf) -> Result<Self, String>`
- `request<T>(&mut self, body: Gphoto2RequestBody) -> Result<T, String>`
- one mutex or single worker owner so calls cannot run concurrently
- stderr logging with `[nikon-connector][gphoto2]`

- [ ] **Step 5: Run tests**

Run:

```bash
rtk cargo test --test gphoto2_session_protocol
rtk cargo check --lib
```

Expected: tests and check pass.

### Task 5: Local gphoto2 Helper Prototype

**Files:**
- Create: `native/gphoto2-helper/README.md`
- Create: `native/gphoto2-helper/package.sh`
- Create: `native/gphoto2-helper/gphoto2-helper`
- Modify: `package.json`

**Interfaces:**
- Consumes: the JSONL protocol from Task 4
- Produces: a prototype helper executable path set through `GPHOTO2_HELPER`

- [ ] **Step 1: Add prototype helper script**

Create `native/gphoto2-helper/gphoto2-helper` as an executable script that:

- reads one JSON object per line from stdin
- handles `list_cameras` using `gphoto2 --auto-detect`
- handles `diagnose_camera` using `gphoto2 --summary`
- returns JSON responses with the same `id`
- returns a structured error if output contains `Could not claim the USB device`

- [ ] **Step 2: Add package script**

Add to `package.json`:

```json
"helper:gphoto2:check": "GPHOTO2_HELPER=native/gphoto2-helper/gphoto2-helper cargo check --manifest-path src-tauri/Cargo.toml --lib"
```

- [ ] **Step 3: Make prototype executable**

Run:

```bash
rtk chmod +x native/gphoto2-helper/gphoto2-helper native/gphoto2-helper/package.sh
```

- [ ] **Step 4: Verify protocol manually**

Run:

```bash
rtk printf '%s\n' '{"id":1,"command":"list_cameras"}' '{"id":2,"command":"shutdown"}' | native/gphoto2-helper/gphoto2-helper
```

Expected: a JSON response containing the Nikon Z6III when connected and available.

- [ ] **Step 5: Run build check**

Run:

```bash
rtk bun run helper:gphoto2:check
```

Expected: command exits 0.

### Task 6: App Integration Behind Opt-In Switch

**Files:**
- Modify: `src-tauri/src/camera/mod.rs`
- Modify: `src-tauri/src/camera/gphoto2_session.rs`
- Modify: `src-tauri/src/camera/types.rs`
- Modify: `src/lib/cameraApi.test.ts`

**Interfaces:**
- Consumes: `Gphoto2Session`
- Produces: working `list_cameras` and `diagnose_camera` behavior for the opt-in gphoto2 backend

- [ ] **Step 1: Add Rust tests for fallback behavior**

Test that:

- unset `NIKON_CAMERA_BACKEND` still uses ImageCapture on macOS
- `NIKON_CAMERA_BACKEND=gphoto2` requires `GPHOTO2_HELPER`
- helper startup failure returns a diagnostic error instead of falling back silently

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk cargo test --lib camera
```

Expected: fail because gphoto2 session is not wired.

- [ ] **Step 3: Wire gphoto2 branch**

In `list_cameras`, route `CameraBackendKind::Gphoto2` to the session wrapper.

For `list_photos`, `cache_photo_previews`, and `export_photos`, return explicit unsupported errors until Task 7:

```text
gphoto2 backend does not implement list_photos yet.
```

- [ ] **Step 4: Run tests**

Run:

```bash
rtk cargo test --lib camera
rtk cargo check --lib
```

Expected: tests and check pass.

### Task 7: Thumbnail and Preview Pipeline

**Files:**
- Modify: `src-tauri/src/camera/gphoto2_session.rs`
- Modify: `src-tauri/src/camera/cache.rs`
- Modify: `src-tauri/src/camera/types.rs`
- Modify: `src/features/photos/previewQueue.ts`
- Modify: `src/features/photos/previewQueue.test.ts`

**Interfaces:**
- Consumes: `cache_photo_previews(camera_id, photo_ids, preview_photo_ids, cache_dir)`
- Produces: thumbnail-only grid caching and selected-photo preview caching for gphoto2 backend

- [ ] **Step 1: Add queue regression tests**

Add tests that assert:

- cached thumbnails are skipped
- selected photo appears first
- only selected `photoId` is passed in `previewPhotoIds`
- stale near-neighbor requests are not duplicated while in flight

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
rtk bunx vitest run src/features/photos/previewQueue.test.ts
```

Expected: fail until queue behavior matches the desired selected-preview policy.

- [ ] **Step 3: Implement gphoto2 thumbnail batching**

The helper must call one batched operation for thumbnails:

```bash
gphoto2 --folder /store_00010001/DCIM/100NZ6_3 --get-thumbnail 1-10
```

It must cache thumbnails under the Tauri app cache and return asset URLs through existing `CachedPhotoPreview`.

- [ ] **Step 4: Implement selected preview fetch**

For IDs in `preview_photo_ids`, fetch a larger representation. If gphoto2 can only return the full JPG for that object, save it as a selected-preview cache entry and never request it for non-selected grid items.

- [ ] **Step 5: Run tests and hardware smoke test**

Run:

```bash
rtk bunx vitest run src/features/photos/previewQueue.test.ts src/lib/cameraApi.test.ts
rtk cargo check --lib
NIKON_CAMERA_BACKEND=gphoto2 GPHOTO2_HELPER=native/gphoto2-helper/gphoto2-helper rtk bun run dev:app
```

Expected:

- grid thumbnails appear in batches
- selecting a photo fetches the larger preview
- changing selection does not queue full-size downloads for every row

### Task 8: Release Decision Gate

**Files:**
- Modify: `docs/research/gphoto2-ptp-z6iii.md`
- Modify: `docs/architecture.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: measured ImageCaptureCore and gphoto2 app behavior on the same card
- Produces: documented decision about whether gphoto2 becomes default

- [ ] **Step 1: Record app-level timings**

Measure on the same physical card:

```text
ImageCaptureCore: first camera visible
ImageCaptureCore: first 80 thumbnails cached
ImageCaptureCore: selected main preview visible
gphoto2: first camera visible
gphoto2: first 80 thumbnails cached
gphoto2: selected main preview visible
```

- [ ] **Step 2: Add decision table**

Update `docs/research/gphoto2-ptp-z6iii.md` with the measured values and a decision:

```text
default backend: ImageCaptureCore | gphoto2
reason:
known caveats:
```

- [ ] **Step 3: Update architecture**

Document the selected default and the fallback backend in `docs/architecture.md`.

- [ ] **Step 4: Update changelog**

Add an Unreleased entry describing the opt-in gphoto2 backend and PTP device-busy diagnostic.

- [ ] **Step 5: Run final verification**

Run:

```bash
rtk bunx vitest run src/lib/cameraApi.test.ts src/lib/singleFlight.test.ts src/features/photos/previewQueue.test.ts src/features/photos/catalog.test.ts src/i18n.test.ts src/features/photos/connectionDiagnostics.test.ts
rtk bun run build
rtk cargo check --lib
rtk bun run helper:build
```

Expected: all commands exit 0 before claiming the backend is ready.
