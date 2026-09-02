# Nikon Connector

A macOS desktop app for reviewing Nikon Z6III camera-card photos, applying
0-5 star ratings, and shipping signed release builds through GitHub Releases.

## Features

- Detects connected cameras through a native macOS ImageCaptureCore helper.
- Shows a photo-first review workspace with keyboard navigation and 0-5 star
  rating shortcuts.
- Supports preview zoom controls for fit-to-window, actual size, zoom in, and
  zoom out.
- Exposes app version, changelog, update feed, and update actions in the
  settings panel.
- Publishes release notes from `CHANGELOG.md` and uploads macOS DMG installers
  to GitHub Releases.

## Stack

- Tauri 2 desktop shell
- React 19, TypeScript, Vite, and Tailwind CSS
- Rust commands for the app boundary
- Swift Package Manager helper for macOS camera discovery
- GitHub Releases plus Tauri updater metadata for distribution

## Development

```bash
bun install
bun run dev
bun run lint
bun run tauri dev
```

Use `bun run check` before shipping frontend changes. Keep automated tests
focused on core behavior and let lint catch broad TypeScript/React issues.

## Native Camera Helper

The macOS helper lives in `native/macos-camera-helper` and is built separately
with Swift Package Manager:

```bash
swift build --package-path native/macos-camera-helper
swift run --package-path native/macos-camera-helper nikon-camera-helper list-cameras
```

`list-cameras` uses ImageCaptureCore to enumerate connected cameras. Photo
listing and rating write-back remain staged behind the app contracts while the
Nikon SDK bridge is completed.

## Releases

Release metadata is synchronized through the local tag-driven workflow. Tags are
the release source of truth, and GitHub Release notes are generated from the
matching section in `CHANGELOG.md`.

```bash
bun run release:prepare -- 0.2.0
bun run release:check
bun run release:tag
bun run release:publish
```

`release:package` builds a macOS DMG installer at
`dist/releases/Nikon-Connector-v<version>-macos-aarch64.dmg`. `release:github`
uploads that installer to the GitHub Release for `v<version>`.

`gh` must be installed and authenticated before publishing:

```bash
gh auth login
```

See `docs/release.md` for version, changelog, tag, packaging, and GitHub
publishing rules.

## Nikon SDK

Place the official Nikon Remote Module SDK 2.0.0 files for Z6III in
`src-tauri/vendor/NikonSDK/`. Rating write-back is still guarded by the Rust
rating boundary until the SDK adapter is implemented.
