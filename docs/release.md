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
```

`release:tag` reads the synchronized project version and creates an annotated
tag named `v<version>`. It fails if the tag already exists.

## Package Artifacts

```bash
bun run release:package
```

This command validates release metadata, runs frontend checks, runs tests, and
then executes `bun run tauri build --bundles dmg`. Tauri writes the macOS DMG
installer under `src-tauri/target/release/bundle/dmg/`, then copies it as:

```text
dist/releases/Nikon-Connector-v<version>-macos-aarch64.dmg
```

DMG creation mounts a temporary disk image. It can fail in restricted shells or
CI runners that cannot create disk devices. To build only the app bundle during
local debugging, pass the bundle target explicitly:

```bash
bun run release:build -- --bundles app
```

## Publish To GitHub

GitHub releases are created from the annotated version tag. The release notes
come from that version's section in `CHANGELOG.md`, so GitHub displays the
latest changes and features recorded for the tag. The packaged DMG installer is
uploaded as the release asset.

The shortest release command is:

```bash
bun run release:all -- 0.2.0
```

It prepares the version and changelog, packages the DMG, commits the release,
creates the annotated tag, pushes the current branch and tag, then creates the
GitHub Release.

```bash
bun run release:push
bun run release:github
```

`release:push` pushes the current branch and `v<version>` tag to `origin`.
`release:github` runs `gh release create v<version> ... --verify-tag`, so it
requires the GitHub CLI to be installed and authenticated.

To package, push, and publish in one command:

```bash
bun run release:publish
```

The full release flow is:

```bash
bun run release:prepare -- 0.2.0
git diff
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
git commit -m "chore: prepare v0.2.0 release"
bun run release:tag
bun run release:publish
```

## Rebuild Or Retag

If a tag was created against the wrong commit and has not been shared, delete it
locally, fix the release commit, and rerun `bun run release:tag`.

```bash
git tag -d v0.2.0
```

If the tag has already been pushed, create a new patch release instead of
rewriting the published tag.
