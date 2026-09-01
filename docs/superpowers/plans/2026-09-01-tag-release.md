# Tag Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, tag-driven release workflow that synchronizes versions,
maintains `CHANGELOG.md`, and builds Tauri release artifacts.

**Architecture:** A single Node ESM CLI in `scripts/release.mjs` owns version
parsing, file updates, changelog promotion, release validation, tag creation,
and build orchestration. Package scripts expose the stable command surface.

**Tech Stack:** Bun scripts, Node ESM standard library, Vitest, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-09-01-tag-release-design.md`

## Global Constraints

- Release versions use `MAJOR.MINOR.PATCH`.
- Git tags use annotated `vMAJOR.MINOR.PATCH`.
- Versions must match in `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.
- `CHANGELOG.md` keeps an `Unreleased` section and dated release sections.

---

### Task 1: Release Tool Tests

**Files:**
- Create: `scripts/release.test.mjs`

**Interfaces:**
- Produces expectations for `parseVersion`, `readProjectVersions`,
  `setProjectVersion`, `prepareChangelog`, `validateReleaseState`, and
  `tagForVersion`.

- [x] Write failing tests against fixture files.
- [x] Run `bun run test scripts/release.test.mjs` and confirm missing module
  failures.

### Task 2: Release CLI

**Files:**
- Create: `scripts/release.mjs`

**Interfaces:**
- Exports pure helpers for tests and a CLI entry point for package scripts.

- [x] Implement SemVer and tag parsing.
- [x] Implement version reading and synchronized file updates.
- [x] Implement changelog promotion.
- [x] Implement check, prepare, tag, and build commands.
- [x] Default release builds to the macOS `.app` bundle and allow explicit Tauri
  bundle overrides.
- [x] Run focused tests until they pass.

### Task 3: Package Scripts And Docs

**Files:**
- Modify: `package.json`
- Create: `CHANGELOG.md`
- Create: `docs/release.md`
- Modify: `README.md`

**Interfaces:**
- Exposes `release:check`, `release:prepare`, `release:tag`, and
  `release:build`.

- [x] Wire package scripts to `scripts/release.mjs`.
- [x] Document the release workflow and tag rules.
- [x] Run full verification commands.
