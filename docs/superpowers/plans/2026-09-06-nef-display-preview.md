# NEF Display Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected macOS camera preview for NEF files converge to a high-quality JPEG rendered from the downloaded original, while keeping filmstrip browsing asynchronous and smooth.

**Architecture:** Keep the camera-online transport path focused on ImageCapture/PTP operations: list files, fetch thumbnails, and download only prioritized preview originals. Add a small ImageIO rendering layer in the macOS helper that converts downloaded NEF/JPEG-compatible sources into a display JPEG cache file; frontend `previewUrl` continues to point at the best available display image.

**Tech Stack:** Swift 5.9, ImageCaptureCore, ImageIO/CoreGraphics, XCTest, React/Vitest existing preview queue.

**Spec:** `docs/research/nikon-preview-viewing-research.md`

## Global Constraints

- macOS only.
- Do not decode NEF in the browser/WebView; the browser receives a JPEG preview path.
- Keep camera operations prioritized: selected full preview first, next visible screen after, strip thumbnails lazily.
- Do not block thumbnail generation on RAW rendering.
- Reuse existing `CachedPhotoPreview.previewUrl` and `CameraPhoto.previewUrl` contracts.
- Preserve unrelated dirty worktree changes; stage and commit only hunk-level changes from this plan.

---

## File Structure

- `native/macos-camera-helper/Sources/NikonCameraHelper/PreviewCachePaths.swift`
  - Owns deterministic thumbnail, downloaded original, and rendered display JPEG cache paths.
- `native/macos-camera-helper/Sources/NikonCameraHelper/DisplayPreviewRenderer.swift`
  - New ImageIO/CoreGraphics renderer. Converts supported source files, including NEF when the OS supports the RAW variant, into a bounded JPEG for WebView display.
- `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
  - Uses the path helper and renderer when `cachePhotoPreviews` requests a preview tier.
- `native/macos-camera-helper/Package.swift`
  - Links ImageIO for Swift Package builds.
- `package.json`
  - Links ImageIO and includes `DisplayPreviewRenderer.swift` in `helper:build`.
- `native/macos-camera-helper/Tests/NikonCameraHelperTests/PreviewCachePathsTests.swift`
  - Adds cache-path tests for original and display preview paths.
- `native/macos-camera-helper/Tests/NikonCameraHelperTests/DisplayPreviewRendererTests.swift`
  - Adds renderer behavior tests using generated JPEG fixtures; invalid-source test covers graceful RAW failures without needing a NEF fixture.

---

### Task 1: Cache Paths For Original And Rendered Preview

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/PreviewCachePaths.swift`
- Test: `native/macos-camera-helper/Tests/NikonCameraHelperTests/PreviewCachePathsTests.swift`

**Interfaces:**
- Consumes: existing `PreviewCachePaths(cameraId:fileIdentifier:cacheDirectory:)`
- Produces:
  - `let originalPreviewURL: URL`
  - `let displayPreviewURL: URL`
  - `func existingDisplayPreviewPath() -> String`
  - `func originalPreviewURL(forExtension fileExtension: String) -> URL`

- [ ] **Step 1: Write the failing tests**

```swift
func testUsesDeterministicOriginalPreviewPathForSourceExtension() {
    let paths = PreviewCachePaths(
        cameraId: "Nikon Z6III",
        fileIdentifier: "42",
        cacheDirectory: FileManager.default.temporaryDirectory
    )

    XCTAssertTrue(paths.originalPreviewURL(forExtension: "NEF").lastPathComponent.hasSuffix("-original-preview.nef"))
    XCTAssertTrue(paths.originalPreviewURL(forExtension: ".jpg").lastPathComponent.hasSuffix("-original-preview.jpg"))
}

func testUsesExistingDisplayPreviewPathWithoutChangingTheCacheKey() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("nikon-display-preview-cache-paths-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }

    let paths = PreviewCachePaths(
        cameraId: "Nikon Z6III",
        fileIdentifier: "42",
        cacheDirectory: directory
    )
    try Data([0xff, 0xd8, 0xff, 0xd9]).write(to: paths.displayPreviewURL)

    XCTAssertEqual(paths.existingDisplayPreviewPath(), paths.displayPreviewURL.path)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk swift test --filter PreviewCachePathsTests`

Expected: FAIL because `originalPreviewURL(forExtension:)`, `displayPreviewURL`, and `existingDisplayPreviewPath()` do not exist.

- [ ] **Step 3: Write minimal implementation**

```swift
let displayPreviewURL: URL

init(cameraId: String, fileIdentifier: String, cacheDirectory: URL) {
    let cacheKey = Self.safeFileComponent("\(cameraId)-\(fileIdentifier)")
    thumbnailURL = cacheDirectory.appendingPathComponent("\(cacheKey)-thumb.jpg")
    displayPreviewURL = cacheDirectory.appendingPathComponent("\(cacheKey)-display-preview.jpg")
}

func originalPreviewURL(forExtension fileExtension: String) -> URL {
    let normalizedExtension = fileExtension
        .trimmingCharacters(in: CharacterSet(charactersIn: "."))
        .lowercased()
    return thumbnailURL
        .deletingLastPathComponent()
        .appendingPathComponent("\(thumbnailURL.deletingPathExtension().lastPathComponent.replacingOccurrences(of: "-thumb", with: ""))-original-preview.\(normalizedExtension)")
}

func existingDisplayPreviewPath() -> String {
    FileManager.default.fileExists(atPath: displayPreviewURL.path) ? displayPreviewURL.path : ""
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk swift test --filter PreviewCachePathsTests`

Expected: PASS.

---

### Task 2: ImageIO Display Preview Renderer

**Files:**
- Create: `native/macos-camera-helper/Sources/NikonCameraHelper/DisplayPreviewRenderer.swift`
- Create: `native/macos-camera-helper/Tests/NikonCameraHelperTests/DisplayPreviewRendererTests.swift`
- Modify: `native/macos-camera-helper/Package.swift`
- Modify: `package.json`

**Interfaces:**
- Consumes: `sourceURL: URL`, `destinationURL: URL`
- Produces:
  - `struct DisplayPreviewRenderer`
  - `func renderJPEGPreview(from sourceURL: URL, to destinationURL: URL, maxPixelSize: Int = 3200) -> Bool`

- [ ] **Step 1: Write the failing tests**

```swift
func testRendersDisplayJPEGFromJPEGSource() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("nikon-display-preview-renderer-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }

    let sourceURL = directory.appendingPathComponent("source.jpg")
    let destinationURL = directory.appendingPathComponent("preview.jpg")
    try makeJPEGFixture(at: sourceURL)

    let rendered = DisplayPreviewRenderer().renderJPEGPreview(
        from: sourceURL,
        to: destinationURL,
        maxPixelSize: 320
    )

    XCTAssertTrue(rendered)
    XCTAssertTrue(FileManager.default.fileExists(atPath: destinationURL.path))
    XCTAssertGreaterThan((try FileManager.default.attributesOfItem(atPath: destinationURL.path)[.size] as? NSNumber)?.intValue ?? 0, 0)
}

func testReturnsFalseForInvalidSourceWithoutCreatingPreview() throws {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("nikon-display-preview-renderer-invalid-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }

    let sourceURL = directory.appendingPathComponent("source.nef")
    let destinationURL = directory.appendingPathComponent("preview.jpg")
    try Data("not an image".utf8).write(to: sourceURL)

    let rendered = DisplayPreviewRenderer().renderJPEGPreview(from: sourceURL, to: destinationURL)

    XCTAssertFalse(rendered)
    XCTAssertFalse(FileManager.default.fileExists(atPath: destinationURL.path))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk swift test --filter DisplayPreviewRendererTests`

Expected: FAIL because `DisplayPreviewRenderer` does not exist.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation
import ImageIO

struct DisplayPreviewRenderer {
    func renderJPEGPreview(
        from sourceURL: URL,
        to destinationURL: URL,
        maxPixelSize: Int = 3200
    ) -> Bool {
        guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil) else {
            return false
        }

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              let destination = CGImageDestinationCreateWithURL(destinationURL as CFURL, "public.jpeg" as CFString, 1, nil) else {
            return false
        }

        CGImageDestinationAddImage(destination, image, [
            kCGImageDestinationLossyCompressionQuality: 0.9
        ] as CFDictionary)
        return CGImageDestinationFinalize(destination)
    }
}
```

- [ ] **Step 4: Link ImageIO**

Add `.linkedFramework("ImageIO")` in `Package.swift`, and add `-framework ImageIO` plus `DisplayPreviewRenderer.swift` in `package.json` `helper:build`.

- [ ] **Step 5: Run test to verify it passes**

Run: `rtk swift test --filter DisplayPreviewRendererTests`

Expected: PASS.

---

### Task 3: Use Rendered Display JPEG For Requested Previews

**Files:**
- Modify: `native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift`
- Test: `native/macos-camera-helper/Tests/NikonCameraHelperTests/PreviewCachePathsTests.swift`
- Test: `native/macos-camera-helper/Tests/NikonCameraHelperTests/DisplayPreviewRendererTests.swift`

**Interfaces:**
- Consumes:
  - `PreviewCachePaths.originalPreviewURL(forExtension:)`
  - `PreviewCachePaths.displayPreviewURL`
  - `DisplayPreviewRenderer.renderJPEGPreview(from:to:maxPixelSize:)`
- Produces:
  - `CachedPhotoPreview.previewUrl` points to `*-display-preview.jpg` for rendered NEF/JPEG previews.
  - Existing same-stem JPG fallback remains valid.

- [ ] **Step 1: Write the failing testable helper if direct camera tests are unavailable**

Add a private helper that can be exercised indirectly by path and renderer tests:

```swift
private func displayPreviewPath(
    for sourceURL: URL,
    cachePaths: PreviewCachePaths,
    renderer: DisplayPreviewRenderer = DisplayPreviewRenderer()
) -> String {
    let existingDisplayPreviewPath = cachePaths.existingDisplayPreviewPath()
    if !existingDisplayPreviewPath.isEmpty {
        return existingDisplayPreviewPath
    }
    return renderer.renderJPEGPreview(from: sourceURL, to: cachePaths.displayPreviewURL)
        ? cachePaths.displayPreviewURL.path
        : ""
}
```

- [ ] **Step 2: Run focused Swift tests before implementation**

Run: `rtk swift test --filter NikonCameraHelperTests`

Expected: PASS before store integration; if this fails, stop and fix the test/module setup first.

- [ ] **Step 3: Integrate preview rendering into `cacheImages`**

Replace the preview block with this behavior:

```swift
let sourceExtension = URL(fileURLWithPath: previewFileName).pathExtension
let originalPreviewURL = cachePaths.originalPreviewURL(forExtension: sourceExtension)
let hasOriginalPreview = FileManager.default.fileExists(atPath: originalPreviewURL.path) ||
    download(
        file: previewFile,
        from: camera,
        to: cacheURL,
        fileName: originalPreviewURL.lastPathComponent,
        timeout: timeout
    )

if hasOriginalPreview {
    let renderedPath = displayPreviewPath(for: originalPreviewURL, cachePaths: cachePaths)
    let previewPath = renderedPath.isEmpty ? originalPreviewURL.path : renderedPath
    lock.lock()
    var cachedImage = paths[fileIdentifier] ?? CachedImagePaths()
    cachedImage.previewPath = previewPath
    paths[fileIdentifier] = cachedImage
    lock.unlock()
}
```

- [ ] **Step 4: Let NEF files be valid preview sources**

Change:

```swift
let source = canCacheOriginalPreview(for: fileName)
    ? file
    : jpegFilesByStem[fileNameStem(fileName)]
```

to:

```swift
let source = canDownloadForDisplayPreview(for: fileName)
    ? file
    : jpegFilesByStem[fileNameStem(fileName)]
```

Add:

```swift
private func canDownloadForDisplayPreview(for fileName: String) -> Bool {
    let fileType = URL(fileURLWithPath: fileName).pathExtension.lowercased()
    return ["jpg", "jpeg", "nef", "nrw"].contains(fileType)
}
```

- [ ] **Step 5: Run helper build and Swift tests**

Run:

```bash
rtk bun run helper:build
rtk swift test
```

Expected: both PASS.

---

### Task 4: Verify App Contract And Commit

**Files:**
- Modify only if required by compiler/tests:
  - `src/lib/cameraApi.ts`
  - `src/features/photos/types.ts`
  - `src/features/photos/PhotoStage.tsx`

**Interfaces:**
- Consumes: existing `previewUrl` string contract.
- Produces: no frontend API change unless tests reveal a mismatch.

- [ ] **Step 1: Confirm frontend already prefers `previewUrl`**

Run: `rtk rg -n "previewUrl \\|\\||previewUrl|thumbnailUrl" src/features/photos src/features/app src/lib`

Expected: `PhotoStage` uses `photo.previewUrl || photo.thumbnailUrl`.

- [ ] **Step 2: Run app tests**

Run:

```bash
rtk bun run test
rtk bun run lint
rtk bun run build
```

Expected: all PASS.

- [ ] **Step 3: Review changed files**

Run:

```bash
rtk git diff -- native/macos-camera-helper/Sources/NikonCameraHelper/PreviewCachePaths.swift native/macos-camera-helper/Sources/NikonCameraHelper/DisplayPreviewRenderer.swift native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift native/macos-camera-helper/Package.swift package.json native/macos-camera-helper/Tests/NikonCameraHelperTests/PreviewCachePathsTests.swift native/macos-camera-helper/Tests/NikonCameraHelperTests/DisplayPreviewRendererTests.swift docs/superpowers/plans/2026-09-06-nef-display-preview.md
```

Expected: diff contains only this NEF display preview plan and implementation.

- [ ] **Step 4: Commit only plan-related hunks**

Run:

```bash
rtk git add docs/superpowers/plans/2026-09-06-nef-display-preview.md native/macos-camera-helper/Sources/NikonCameraHelper/DisplayPreviewRenderer.swift native/macos-camera-helper/Tests/NikonCameraHelperTests/DisplayPreviewRendererTests.swift
rtk proxy git add -p native/macos-camera-helper/Sources/NikonCameraHelper/PreviewCachePaths.swift native/macos-camera-helper/Sources/NikonCameraHelper/ImageCaptureCameraStore.swift native/macos-camera-helper/Package.swift package.json native/macos-camera-helper/Tests/NikonCameraHelperTests/PreviewCachePathsTests.swift
rtk git commit -m "feat: render downloaded previews for nef display"
```

Expected: commit includes only the files and hunks listed above.

---

## Self-Review

- Spec coverage: The plan covers online camera transport, NEF display rendering, cache paths, fallback behavior, asynchronous queue compatibility, and verification.
- Placeholder scan: No `TBD`, unresolved `TODO`, or unspecified test steps remain.
- Type consistency: `DisplayPreviewRenderer.renderJPEGPreview(from:to:maxPixelSize:)`, `PreviewCachePaths.displayPreviewURL`, `PreviewCachePaths.originalPreviewURL(forExtension:)`, and `PreviewCachePaths.existingDisplayPreviewPath()` are named consistently across tasks.
