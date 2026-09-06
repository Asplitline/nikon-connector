# Changelog

All notable changes to Nikon Connector are documented in this file.

This project follows SemVer and keeps release notes in Keep a Changelog style.

## [Unreleased]

## [0.1.7] - 2026-09-06

### Added

- Render cached display previews for NEF files when the camera does not expose
  directly viewable originals.
- Show shooting metadata in the photo details panel.
- Add release notes and update-feed links to the settings panel.

### Changed

- Refined the photo review workspace layout, controls, zoom behavior, and
  filmstrip handling for faster culling.
- Prioritize clearer previews while preloading around the current filmstrip
  window.

### Fixed

- Derive preview preload counts from the active filmstrip window to avoid
  over-fetching previews outside the visible review range.

## [0.1.6] - 2026-09-04

### Changed

- Camera helper now runs as a persistent daemon over NDJSON instead of one
  subprocess per request, so the fixed ImageCaptureCore cost (device scan,
  session open, catalog wait) is paid once per app session rather than once
  per preview batch. Measured locally: ten requests cost the same 8s as one,
  where the previous architecture needed ~30s.
- Photo enumeration streams to the UI in batches through a `photos:batch`
  event, so the first thumbnails appear without waiting for the whole card.
- Preview requests are debounced and cancellable, so holding an arrow key no
  longer stacks one backend round-trip per keypress.
- The filmstrip is virtualized and thumbnails load lazily, so a large card no
  longer mounts one DOM node per photo.

## [0.1.4] - 2026-09-03

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
