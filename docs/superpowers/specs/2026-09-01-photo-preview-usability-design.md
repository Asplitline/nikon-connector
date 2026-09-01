# Photo Preview Usability Design

**Date:** 2026-09-01

## Goal

Make the Nikon Connector photo review screen robust for real camera-card content: very large images, very long file/status/metadata text, and keyboard-first review workflows.

## Context

The app is a calm photo browser for Nikon Z6III users on macOS. The preview image is the primary surface. Chrome, metadata, ratings, and device state should support quick review without competing with the image.

## Scope

This design covers the existing React photo review UI:

- Stable image preview layout for oversized photos.
- Text overflow handling for long file names, statuses, and metadata.
- Keyboard operations for browsing and rating photos.
- Tests and browser verification needed before claiming the UI is usable.

This design does not cover image zoom/pan, raw decoding, real SDK write-back behavior, multi-select, import workflows, or editing metadata beyond star ratings.

## Oversized Images

The photo preview must never resize the app shell, push side panels off-screen, or create page-level horizontal scrolling.

Approach:

- Keep the preview inside a fixed photo stage controlled by the surrounding grid.
- Ensure the stage and grid children use `min-width: 0` and `min-height: 0` so large media can shrink inside the available space.
- Render preview images with `object-fit: contain`, `max-width: 100%`, and `max-height: 100%`.
- On desktop, preserve the current three-zone review layout: sidebar, central stage, details panel.
- On mobile, give the stage a bounded viewport-relative height so the image remains central without pushing rating/details/filmstrip too far down.
- Avoid cropping in default review mode. Users are deciding what the image is; the whole frame should be visible.

Future extension:

- Add a separate zoom mode later if needed, with explicit controls for fit, 100%, and pan. It should not replace the default fit-to-stage review mode.

## Long Text

Long text must not break the layout or hide core controls.

Rules:

- Top filename: single-line truncation with `title` for the full value.
- Status text: allow wrapping, but constrain width and line-height so it does not push the rating controls out of reach.
- Thumbnail filename: single-line truncation, with rating fixed to the right side.
- Details values: allow wrapping with `overflow-wrap: anywhere` so long metadata cannot create horizontal overflow.
- Error text: allow multi-line wrapping inside its panel.
- Buttons and counters: keep fixed or minimum dimensions so dynamic labels do not shift nearby controls.

Useful cases to test:

- A filename longer than 120 characters.
- A status message with a long device path or adapter error.
- A metadata value with no spaces.
- A photo count with three or four digits.

## Keyboard Operations

Keyboard support should prioritize fast review without requiring mouse movement.

Shortcuts:

- `ArrowRight`: select next photo.
- `ArrowLeft`: select previous photo.
- `Home`: select first photo.
- `End`: select last photo.
- `1` through `5`: set current photo rating.
- `0`: clear current photo rating.
- `Backspace`: clear current photo rating.

Behavior:

- Browsing shortcuts work whenever photos are loaded.
- Rating shortcuts only attempt write-back when a selected photo exists and the connection state is `connected`.
- If write-back fails, restore the previous rating and show the existing rating error message.
- Shortcuts must not fire while the user is typing in an input, textarea, select, or contenteditable element.
- Shortcut handlers should use the same catalog and rating update paths as click/tap interactions.
- Reaching the first or last photo should clamp rather than wrap. This avoids disorienting jumps during focused review.

## Implementation Shape

Recommended file changes:

- `src/features/photos/catalog.ts`: add small pure helpers for next/previous/first/last selection, or a single bounded selection helper.
- `src/features/photos/catalog.test.ts`: add tests for clamped keyboard navigation behavior.
- `src/App.tsx`: wire a document-level keyboard listener that delegates to catalog helpers and existing rating handler.
- `src/index.css`: harden long-text and oversized-image CSS constraints.
- `src/features/photos/StarRating.tsx`: keep existing button behavior; optionally add clearer labels/titles if tests reveal gaps.

The keyboard mapping can be extracted into a pure helper only if direct component testing is awkward. Prefer the smallest testable unit that keeps production code readable.

## Verification

Required commands:

- `rtk bun run lint`
- `rtk bun run build`
- `rtk bun run test`
- `rtk git diff --check`

Manual/browser checks:

- Desktop viewport: no horizontal overflow, image fully contained, details visible, filmstrip usable.
- Mobile viewport around 390px wide: no horizontal overflow, rating remains reachable, details wrap cleanly.
- Keyboard: arrows change selection, Home/End clamp correctly, number keys update rating, `0` and Backspace clear rating.
- Long data: artificially test long filename/status/metadata and confirm controls do not overlap.

## Acceptance Criteria

- Oversized images never break the shell or create layout overflow.
- Long text does not cover, push away, or resize core review controls unexpectedly.
- Keyboard users can move through photos and rate/clear ratings without using the mouse.
- All automated verification commands pass.
- Browser QA confirms image loading and no horizontal overflow at desktop and mobile widths.
