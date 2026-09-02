# Tag Release Design

## Goal

Add a local, tag-driven release workflow for Nikon Connector that keeps app
versions synchronized, records release notes, and builds Tauri artifacts from
validated version tags.

## Scope

- The release version format is SemVer without prerelease metadata:
  `MAJOR.MINOR.PATCH`.
- Git tags use the annotated tag format `vMAJOR.MINOR.PATCH`.
- `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the
  root `nikon-connector` entry in `src-tauri/Cargo.lock` must carry the same
  version before a release build.
- `CHANGELOG.md` follows Keep a Changelog style with an `Unreleased` section
  and dated version sections.
- The workflow stays local and CI-agnostic for now. GitHub Actions can be added
  later without changing the release contract.

## Commands

- `bun run release:check` validates version consistency, changelog structure,
  and the optional current Git tag.
- `bun run release:prepare -- <version>` updates all version files and promotes
  `CHANGELOG.md`'s `Unreleased` notes into a dated release section.
- `bun run release:tag` creates an annotated `v<version>` tag for the current
  synchronized version.
- `bun run release:build` runs `release:check`, frontend checks, tests, and
  `tauri build --bundles dmg` by default. Explicit bundle arguments such as
  `-- --bundles app` are passed through for local debugging.
- `bun run release:package` builds the default DMG installer and copies it to
  `dist/releases/Nikon-Connector-v<version>-macos-aarch64.dmg`.
- `bun run release:push` pushes the current branch and annotated release tag to
  `origin`.
- `bun run release:github` creates a GitHub Release from the pushed tag using
  `gh release create`, uses that version's `CHANGELOG.md` section as release
  notes, and uploads the packaged DMG installer asset.
- `bun run release:publish` runs package, push, and GitHub release creation in
  order.

## Error Handling

- Invalid versions fail before files are changed.
- Version mismatches fail with a list of files and observed values.
- Preparing an already documented version fails to avoid duplicate changelog
  sections.
- Tag creation fails when the tag already exists.

## Verification

Release tooling is covered by Vitest unit tests that exercise controlled fixture
files instead of grepping source text. Full verification runs `bun run test`,
`bun run check`, and `bun run release:check`.
