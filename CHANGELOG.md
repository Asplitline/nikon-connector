# Changelog

All notable changes to Nikon Connector are documented in this file.

This project follows SemVer and keeps release notes in Keep a Changelog style.

## [Unreleased]

### Added

- Real Nikon Z6III camera discovery.
- Camera-card photo enumeration.
- Local thumbnail and preview caching.
- Direct-culling filters and sorting for unrated, rated, 3+, 4+, 5-star,
  capture-time, filename, and rating review workflows.
- Local rating persistence for filtering and selective export while Nikon SDK
  write-back is unavailable.
- Selective export controls and a macOS ImageCaptureCore export command path
  for copying chosen camera-card originals after culling.
- Shooting review summary with rated, keeper, keep-rate, format mix, and
  unrated counts.
- Official Nikon SDK rating write-back when supported by the installed SDK;
  this is not currently confirmed or enabled.
- Photo preview zoom controls with keyboard shortcuts for zoom in, zoom out,
  fit-to-window, and actual-size review.
- Settings panel with software version, development log, update feed, and
  update check/install controls.
- Tauri updater integration for GitHub Releases `latest.json` feeds.

## [0.1.3] - 2026-09-01

### Changed

- Release packaging now publishes a macOS DMG installer asset instead of a
  source-style app archive.
- GitHub Release notes are generated from the matching `CHANGELOG.md` version
  section so each tag displays the latest changes and features.

### Fixed

- Narrowed photo review keyboard shortcuts before applying ratings so zoom
  shortcuts do not break TypeScript release builds.

## [0.1.2] - 2026-09-01

### Added

- GitHub Release publishing commands that push the release tag and upload the
  packaged macOS artifact.

## [0.1.1] - 2026-09-01

### Added

- Local tag-driven release workflow with version synchronization and Tauri
  packaging commands.

## [0.1.0] - 2026-08-31

### Added

- Initialized the Nikon Connector Tauri app with React, TypeScript, and Vite.
- Added the first mock camera/photo workflow and rating command contracts.
- Documented the real-camera integration direction for Nikon Z6III support.
