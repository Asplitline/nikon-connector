# Nikon Connector

A macOS desktop app for browsing Nikon Z6III camera-card photos and applying
0-5 star ratings through a future Nikon SDK bridge.

## Development

```bash
bun install
bun run dev
bun run lint
bun run tauri dev
```

Use `bun run check` before shipping frontend changes. Keep automated tests
focused on core behavior and let lint catch broad TypeScript/React issues.

## Releases

Release metadata is synchronized through the local tag-driven workflow:

```bash
bun run release:prepare -- 0.2.0
bun run release:check
bun run release:tag
bun run release:build
```

See `docs/release.md` for version, changelog, tag, and packaging rules.

## Nikon SDK

Place the official Nikon Remote Module SDK 2.0.0 files for Z6III in
`src-tauri/vendor/NikonSDK/`. The current Rust commands return mock data so the
frontend and rating workflow can be developed before SDK integration.
