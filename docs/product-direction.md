# Nikon Connector Product Direction

## Current Viable Directions

At this stage, the most practical directions are:

1. Fast desktop culling
2. Selective export after culling
3. Shooting review and EXIF insight

These directions match the main reason a Nikon user would choose a computer
instead of a phone: larger-screen judgment, faster keyboard workflows, batch
operations, direct file management, and a smoother path into editing tools.

The app should not compete with card readers or normal import tools by forcing
users to copy everything before review. If the workflow is "import to computer,
then inspect," a card reader, Finder, Lightroom, or NX Studio is simpler and
faster. Nikon Connector's advantage is reading the camera card directly,
helping users decide what matters, and exporting only the selected results.

## Direction A: Direct Camera Culling

Use the computer as a focused review station while still reading from the
connected camera or camera card. The user should be able to judge photos before
committing disk space or importing a full shoot.

Key ideas:

- Full-size preview with fast keyboard navigation.
- 0-5 star rating from the keyboard.
- Zoom for focus and detail checks.
- Filters for unrated, rated, and high-rated photos.
- Efficient review of large card contents without importing everything.
- Local rating state when official camera write-back is unavailable.
- Clear distinction between local marks and camera/file-visible metadata.

## Direction B: Selective Export After Culling

Do not make import the first step. Use export as the result of culling: once the
user has reviewed the card, copy only the current selection, rating threshold,
or filtered set to the computer.

Key ideas:

- Export the current filtered result.
- Export by rating threshold, such as 3 stars and above.
- Export the current photo for one-off use.
- Choose a destination folder and optional shoot name.
- Detect duplicate exports.
- Show an export summary with copied, skipped, and failed counts.
- Open the completed export folder in Finder.
- Later, hand off exported files to NX Studio, Lightroom, or Capture One.

## Direction E: Shooting Review And EXIF Insight

Use the app to help Nikon users understand what happened during a shoot before
or after export. The insight should come from the card contents and local
ratings; it should not require importing the entire shoot first.

Key ideas:

- Summarize photos by lens, focal length, aperture, shutter speed, and ISO.
- Compare rating distribution by camera settings.
- Highlight common risk patterns such as slow shutter or high ISO.
- Show which settings produced the strongest keepers.
- Provide a concise shoot summary after review.

## Suggested Milestones

### v0.2: Direct Culling Foundation

- Stabilize real camera photo listing.
- Improve thumbnail and preview cache behavior.
- Persist local ratings per camera-card photo.
- Add filters for all, unrated, rated, 3+, 4+, and 5-star photos.
- Add sorting by capture time, filename, and rating.
- Show whether ratings are local-only or written to camera/file metadata.

### v0.3: Selective Export

- Export the current filtered result.
- Export photos at or above a selected star threshold.
- Export the current selected photo.
- Add duplicate detection.
- Show export progress and a completion summary.
- Open the export destination in Finder.

### v0.4: Shooting Review

- Read and normalize EXIF fields needed for review.
- Summarize photos by lens, focal length, aperture, shutter speed, and ISO.
- Correlate ratings with EXIF settings.
- Show keep-rate summaries by setting group.
- Highlight risk patterns such as slow shutter or high ISO.
- Provide a concise shoot summary.

## Later Inspiration Pool

These ideas are intentionally deferred. They are useful product inspiration, but
they should not drive the current implementation until the core desktop workflow
is stable.

### RAW And JPG Pair Workflow

For users who shoot RAW+JPG, the app could pair `.NEF` and `.JPG` versions of
the same shot, use JPG for fast preview, and keep RAW files attached to the same
rating or selection decision.

Possible future features:

- Detect RAW+JPG pairs.
- Apply one rating to both files.
- Show whether a selected photo has RAW, JPG, or both.
- Export or import only the selected RAW files.
- Generate sidecar metadata when official camera write-back is unavailable.

### Client Selection Mode

For photographers working with clients, the app could offer a simplified review
mode for selecting favorites without exposing technical controls.

Possible future features:

- Presentation-style review mode.
- Client favorites separate from photographer ratings.
- Exportable selection list.
- Watermarked previews.
- Locked-down controls to prevent accidental file or metadata changes.
