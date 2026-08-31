# Real Camera Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hard-coded mock boundary with a staged native-provider architecture that can first report real camera availability and then grow into photo enumeration, preview caching, and Nikon rating write-back.

**Architecture:** Keep the React UI contract stable through `src/lib/cameraApi.ts`. On the Rust side, split Tauri commands from provider implementations so mock, macOS ImageCaptureCore, and Nikon SDK code can be swapped without changing frontend calls.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vite, Tailwind CSS, Bun, ESLint.

**Spec:** `docs/architecture.md`

## Global Constraints

- Use Bun for package management and scripts.
- Keep tests minimal; rely on `bun run lint`, `bun run build`, and `cargo check` as the primary quality gates.
- Preserve the existing Tauri command contract: `list_cameras`, `list_photos`, `set_photo_rating`.
- Nikon Z6III is the first supported hardware target.
- Do not require the Nikon SDK to compile until its files are present under `src-tauri/vendor/NikonSDK/`.
- Do not replace the current UI while implementing native integration.

---

### Task 1: Rust Provider Boundary

**Files:**
- Create: `src-tauri/src/camera/mod.rs`
- Create: `src-tauri/src/camera/types.rs`
- Create: `src-tauri/src/camera/mock_provider.rs`
- Create: `src-tauri/src/rating/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: existing Tauri command names from `src/lib/cameraApi.ts`
- Produces:
  - `camera::list_cameras() -> Vec<CameraDevice>`
  - `camera::list_photos(camera_id: &str) -> Vec<CameraPhoto>`
  - `rating::set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String>`

- [ ] **Step 1: Move shared Rust types**

Create `src-tauri/src/camera/types.rs`:

```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub connection: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraPhoto {
    pub id: String,
    pub camera_id: String,
    pub file_name: String,
    pub captured_at: String,
    pub rating: u8,
    pub file_type: String,
    pub width: u32,
    pub height: u32,
    pub size_mb: f32,
    pub preview_url: String,
    pub thumbnail_url: String,
}
```

- [ ] **Step 2: Move current mock data behind a provider**

Create `src-tauri/src/camera/mock_provider.rs` with `list_cameras`, `list_photos`, and `mock_photos` using the current data from `src-tauri/src/lib.rs`.

- [ ] **Step 3: Add module facade**

Create `src-tauri/src/camera/mod.rs`:

```rust
mod mock_provider;
pub mod types;

pub use types::{CameraDevice, CameraPhoto};

pub fn list_cameras() -> Vec<CameraDevice> {
    mock_provider::list_cameras()
}

pub fn list_photos(camera_id: &str) -> Vec<CameraPhoto> {
    mock_provider::list_photos(camera_id)
}

pub fn find_photo(photo_id: &str) -> Option<CameraPhoto> {
    mock_provider::mock_photos()
        .into_iter()
        .find(|photo| photo.id == photo_id)
}
```

- [ ] **Step 4: Move rating command logic into rating module**

Create `src-tauri/src/rating/mod.rs`:

```rust
use crate::camera::{self, CameraPhoto};

pub fn set_photo_rating(photo_id: String, rating: u8) -> Result<CameraPhoto, String> {
    if rating > 5 {
        return Err("Rating must be between 0 and 5.".into());
    }

    let mut photo = camera::find_photo(&photo_id).ok_or_else(|| "Photo not found.".to_string())?;
    photo.rating = rating;
    Ok(photo)
}
```

- [ ] **Step 5: Keep Tauri commands thin**

Modify `src-tauri/src/lib.rs` so commands delegate to `camera` and `rating`.

- [ ] **Step 6: Verify**

Run:

```bash
bun run lint
bun run build
cargo check
```

Expected: all commands exit 0.

### Task 2: Frontend Provider State Readiness

**Files:**
- Modify: `src/features/photos/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/lib/cameraApi.ts`

**Interfaces:**
- Consumes: `CameraDevice.connection`
- Produces: UI copy that distinguishes mock data, USB camera data, and unsupported rating write-back.

- [ ] **Step 1: Extend connection type**

Change `CameraDevice.connection` to include `"image_capture"` and `"nikon_sdk"`.

- [ ] **Step 2: Show provider-specific status**

In `App.tsx`, display:

```text
Preview data
USB connected
Nikon SDK connected
```

based on the returned connection value.

- [ ] **Step 3: Verify**

Run:

```bash
bun run lint
bun run build
```

Expected: both commands exit 0.

### Task 3: macOS ImageCaptureCore Discovery Spike

**Files:**
- Create: `docs/research/imagecapturecore-z6iii.md`
- Create: `src-tauri/src/camera/macos_provider.rs`
- Modify: `src-tauri/src/camera/mod.rs`

**Interfaces:**
- Consumes: macOS ImageCaptureCore availability.
- Produces: compile-gated provider candidate that can later replace mock discovery.

- [ ] **Step 1: Record API decisions**

Document the intended bridge shape in `docs/research/imagecapturecore-z6iii.md`: device discovery, object enumeration, thumbnail request, permission states, and macOS-only compilation.

- [ ] **Step 2: Add macOS provider shell**

Create `src-tauri/src/camera/macos_provider.rs` with a compile-safe placeholder:

```rust
use super::types::CameraDevice;

pub fn list_cameras() -> Vec<CameraDevice> {
    Vec::new()
}
```

- [ ] **Step 3: Keep mock as runtime fallback**

Keep `camera::list_cameras()` returning mock data until a real ImageCaptureCore bridge is wired and tested with a physical Z6III.

- [ ] **Step 4: Verify**

Run:

```bash
cargo check
bun run lint
```

Expected: both commands exit 0.

### Task 4: Photo Enumeration Contract

**Files:**
- Modify: `docs/architecture.md`
- Modify: `src-tauri/src/camera/types.rs`
- Modify: `src/features/photos/types.ts`

**Interfaces:**
- Consumes: current `CameraPhoto`.
- Produces: stable fields for real PTP objects: object handle, storage id, downloadable flag, and preview availability.

- [ ] **Step 1: Add optional object metadata**

Add optional fields to both Rust and TypeScript types:

```typescript
objectHandle?: string;
storageId?: string;
canDownloadOriginal?: boolean;
hasEmbeddedPreview?: boolean;
```

- [ ] **Step 2: Document real-camera mapping**

Update `docs/architecture.md` with how PTP/ImageCaptureCore objects map into `CameraPhoto`.

- [ ] **Step 3: Verify**

Run:

```bash
bun run lint
bun run build
cargo check
```

Expected: all commands exit 0.

### Task 5: Nikon Rating Adapter Contract

**Files:**
- Create: `src-tauri/src/nikon_sdk/mod.rs`
- Modify: `src-tauri/src/rating/mod.rs`
- Modify: `src-tauri/src/nikon_sdk/README.md`

**Interfaces:**
- Consumes: `rating::set_photo_rating(photo_id, rating)`.
- Produces:
  - `nikon_sdk::rating_write_back_available() -> bool`
  - `nikon_sdk::set_rating(photo_id: &str, rating: u8) -> Result<(), String>`

- [ ] **Step 1: Add compile-safe Nikon SDK adapter shell**

Create `src-tauri/src/nikon_sdk/mod.rs`:

```rust
pub fn rating_write_back_available() -> bool {
    false
}

pub fn set_rating(_photo_id: &str, _rating: u8) -> Result<(), String> {
    Err("Nikon SDK rating write-back is not connected yet.".into())
}
```

- [ ] **Step 2: Keep mock rating behavior for development**

In `rating::set_photo_rating`, call the Nikon adapter only when `rating_write_back_available()` is true. Otherwise keep current mock update behavior.

- [ ] **Step 3: Document SDK handoff**

Update `src-tauri/src/nikon_sdk/README.md` with the exact expected functions and failure mode.

- [ ] **Step 4: Verify**

Run:

```bash
bun run lint
bun run build
cargo check
```

Expected: all commands exit 0.
