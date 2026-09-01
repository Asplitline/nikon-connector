# Photo Preview Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the desktop photo review screen usable with oversized photos, long camera metadata, and keyboard-first review workflows.

**Architecture:** Add small pure helpers for clamped catalog navigation and keyboard shortcut mapping, then wire them into the existing React screen. Harden CSS constraints so the fixed desktop workbench remains visible while the preview image scales inside its stage.

**Tech Stack:** Tauri 2, React 19, TypeScript, Tailwind CSS, Bun, Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-01-photo-preview-usability-design.md`

## Global Constraints

- Use Bun for scripts.
- Keep tests focused on pure behavior; rely on lint/build for broad UI safety.
- Preserve the current app screen and Tauri command contract.
- Do not add zoom/pan, import, or real SDK behavior in this phase.

---

### Task 1: Clamped Catalog Navigation

**Files:**
- Modify: `src/features/photos/catalog.ts`
- Modify: `src/features/photos/catalog.test.ts`

**Interfaces:**
- Produces:
  - `selectPhotoByOffset(state, offset)`
  - `selectPhotoEdge(state, edge)`

- [x] Add clamped next/previous selection helpers.
- [x] Add first/last edge selection helper.
- [x] Add focused tests for clamping and empty catalogs.

### Task 2: Keyboard Shortcut Mapping

**Files:**
- Create: `src/features/photos/keyboard.ts`
- Create: `src/features/photos/keyboard.test.ts`

**Interfaces:**
- Produces:
  - `getPhotoReviewShortcut(key)`
  - `shouldIgnorePhotoReviewShortcut(target)`

- [x] Map arrows, Home, End, 0-5, and Backspace.
- [x] Ignore shortcut handling for editable targets.
- [x] Keep tests DOM-light so the project does not need jsdom.

### Task 3: App Wiring

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes catalog and keyboard helpers.
- Produces document-level review shortcuts that reuse existing selection and rating paths.

- [x] Add a keydown listener.
- [x] Clamp navigation at catalog edges.
- [x] Use existing optimistic rating update and rollback behavior.
- [x] Skip shortcuts while editing text.

### Task 4: Layout Hardening

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces fixed-shell image review behavior with long text wrapping/truncation.

- [x] Add `min-width: 0` and `min-height: 0` constraints to layout children.
- [x] Keep preview images contained in the stage.
- [x] Add title attributes and wrapping rules for long filenames, statuses, and details.

### Task 5: Verification

**Files:**
- No code files.

**Interfaces:**
- Produces verified implementation state.

- [x] Run `bun run lint`.
- [x] Run `bun run build`.
- [x] Run `bun run test`.
- [x] Run `git diff --check`.
