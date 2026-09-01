# Release Workflow

Nikon Connector releases are driven by SemVer versions and annotated Git tags.
The local release tooling keeps JavaScript, Tauri, and Rust package metadata in
sync before packaging.

## Version Rules

- Release versions use `MAJOR.MINOR.PATCH`, for example `0.2.0`.
- Git tags use `vMAJOR.MINOR.PATCH`, for example `v0.2.0`.
- Tags must be annotated, not lightweight.
- The version must match in:
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`

## Changelog Rules

`CHANGELOG.md` keeps an `## [Unreleased]` section at the top. Add release notes
there while developing, grouped under Keep a Changelog headings:

- `Added`
- `Changed`
- `Fixed`
- `Removed`

When a release is prepared, the tooling moves the current `Unreleased` notes
into a dated `## [x.y.z] - YYYY-MM-DD` section.

## Prepare A Release

```bash
bun run release:prepare -- 0.2.0
bun run release:check
git diff
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
git commit -m "chore: prepare v0.2.0 release"
```

`release:prepare` updates all version files and promotes changelog notes. It
fails before changing files when the version is not valid SemVer.

## Tag A Release

```bash
bun run release:tag
git push origin main
git push origin v0.2.0
```

`release:tag` reads the synchronized project version and creates an annotated
tag named `v<version>`. It fails if the tag already exists.

## Build Artifacts

```bash
bun run release:build
```

This command validates release metadata, runs frontend checks, runs tests, and
then executes `bun run tauri build --bundles app`. Tauri writes the macOS app
bundle under `src-tauri/target/release/bundle/macos/`.

To produce a DMG on a full macOS desktop environment with `hdiutil` disk image
support, pass the bundle target explicitly:

```bash
bun run release:build -- --bundles dmg
```

DMG creation mounts a temporary disk image. It can fail in restricted shells or
CI runners that cannot create disk devices.

## Rebuild Or Retag

If a tag was created against the wrong commit and has not been shared, delete it
locally, fix the release commit, and rerun `bun run release:tag`.

```bash
git tag -d v0.2.0
```

If the tag has already been pushed, create a new patch release instead of
rewriting the published tag.
