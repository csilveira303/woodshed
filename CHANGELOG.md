# Changelog

All notable changes to WoodShed are documented in this file.

## [Unreleased]

### Added
- **Help (❓) documentation modal** — an in-app guide covering sessions, blocks, voicing practice, playback, progressions, settings, and iPhone install steps.

### Changed
- **Settings moved behind a gear icon (⚙️)** — Left-Handed, 7th Chords, and Keep Screen Awake now live in a popup modal instead of cluttering the main page as always-visible buttons. The per-block progression pickers remain inline, now under a "Progressions" panel.

## 2026-08-15

### Added
- Installable PWA support for iPhone: web app manifest, iOS meta tags, and a Workbox service worker that precaches the app for full offline use.
- App icon (shed + guitar neck design) generated via [scripts/generate-icons.js](scripts/generate-icons.js), at 192px and 512px.
- GitHub Pages deployment (`npm run deploy`) — live at https://csilveira303.github.io/woodshed
- README with development, build, icon-generation, install, and deploy instructions.
- **Keep Screen Awake setting** — toggle in Settings (on by default) that controls the Screen Wake Lock used to keep the display on during practice. Previously the wake lock was always on with no way to disable it.

### Changed
- Renamed the app from "Guitar Skill Builder" to **WoodShed** across the page title, manifest, and package metadata.
