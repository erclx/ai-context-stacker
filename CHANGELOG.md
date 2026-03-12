# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.3] - 2026-03-12

### Changed

- branding: renamed from "AI Context Stacker" to "Stackr" and updated marketplace description

## [0.1.2] - 2026-02-09

### Added

- stack: new commands to refresh specific folders or the entire stack

### Changed

- shortcuts: standardized the refresh shortcut to Ctrl+R / Cmd+R

## [0.1.1] - 2026-01-30

### Fixed

- pickers: correct quickpick select all behavior with active query

## [0.1.0] - 2026-01-30

### Fixed

- ui: suppressed internal drag processing in stack view
- stack: synchronized staged items when a folder is renamed
- lifecycle: handled recursive folder renames to ensure correct file tracking

## [0.0.15] - 2026-01-20

### Added

- explorer: added "Copy Content for AI Context" command to explorer context menu
- pickers: added Ctrl+J and Ctrl+K for Vim-style navigation within all selection pickers

### Changed

- ui: standardized command titles for consistency
- menus: explicitly ordered items in the explorer context menu

## [0.0.14] - 2026-01-20

### Changed

- marketplace: added Open VSX badges and refined README labels for better display on extension registries

## [0.0.13] - 2026-01-18

### Added

- registry: extension published to the Open VSX Registry
- pickers: added select all and toggle selection shortcuts to file pickers

## [0.0.10 - 0.0.11] - 2026-01-05

### Added

- status bar: displays a success checkmark after successful clipboard copies
- pinning: folders visually inherit pinned status from contents; pinned items sort to the top

### Fixed

- multi-root: optimized path resolution and hydration to prevent file pruning
- activation: fixed crashes during rapid activation cycles and window shutdowns

## [0.0.9] - 2026-01-05

### Added

- analysis: background analysis yielding and state dirty-checking to keep the UI responsive on large projects
- tree: staged files view performs granular updates instead of full refreshes

## [0.0.8] - 2025-12-30

### Added

- tracks: load in chunks to prevent UI blocking during startup
- file events: optimized handling of rapid file renames and deletions
- tree: updates specific branches instead of rebuilding the entire tree

## [0.0.7] - 2025-12-30

### Added

- stack: recursive re-scanning of staged directories to discover new files
- folders: support for pinning and removing folders, affecting all nested files

### Fixed

- sync: resolved zombie folder issue where deleted directories persisted in the stack

## [0.0.6] - 2025-12-29

### Added

- analysis: caching and hardware scaling for faster token counting
- background: analysis pauses when the editor is blurred or sidebar is hidden
- status bar: indicator for active background analysis

### Changed

- output: streaming tree generation to reduce memory usage during large copies
- ignore: global ignore patterns to exclude files from token analysis

## [0.0.5] - 2025-12-28

### Added

- folders: aggregated token counts for all nested files
- sync: native VS Code events for immediate rename and delete tracking

### Fixed

- ui: fixed freeze caused by async loops persisting across window reloads
- resources: fixed CPU spikes from undisposed timers and token calculators

## [0.0.4] - 2025-12-28

### Changed

- ux: improved folder picker visibility and standardized multi-root project labeling

## [0.0.3] - 2025-12-27

### Added

- startup: loading indicators and non-blocking warmup sequence

## [0.0.1] - 2025-12-27

### Added

- staging: drag-and-drop file staging with support for multiple context tracks
- context map: optional ASCII directory tree generation for clipboard output
- output: automatic binary file skipping and Markdown preview of staged context
- tokens: real-time token counting with configurable warning thresholds
- limits: 100MB clipboard cap and 5MB per-file limit

[Unreleased]: https://github.com/erclx/stackr/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/erclx/stackr/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/erclx/stackr/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/erclx/stackr/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/erclx/stackr/compare/v0.0.16...v0.1.0
[0.0.15]: https://github.com/erclx/stackr/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/erclx/stackr/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/erclx/stackr/compare/v0.0.10...v0.0.13
[0.0.10 - 0.0.11]: https://github.com/erclx/stackr/compare/v0.0.9...v0.0.11
[0.0.9]: https://github.com/erclx/stackr/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/erclx/stackr/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/erclx/stackr/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/erclx/stackr/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/erclx/stackr/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/erclx/stackr/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/erclx/stackr/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/erclx/stackr/releases/tag/v0.0.1
