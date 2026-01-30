# Changelog

All notable changes to the "AI Context Stacker" extension will be documented in this file.

## [Unreleased]

## [0.1.0] - 2026-01-30

### Fixed

- **UI:** Suppressed internal drag processing in stack view.
- **Stack:** Synchronized staged items when a folder is renamed.
- **Lifecycle:** Handled recursive folder renames to ensure correct file lifecycle.

## [0.0.16] - 2026-01-21

## [0.0.15] - 2026-01-20

### Added

- **Copy Content**: Added "Copy Content for AI Context" command to explorer context menu.
- **Picker Navigation**: Added Ctrl+J and Ctrl+K for Vim-style navigation within all selection pickers.

### Changed

- **UI Wording**: Standardized command titles for consistency (e.g., "Reveal in AI Context Stack").
- **Menu Order**: Explicitly ordered items in the explorer context menu.

## [0.0.14] - 2026-01-20

### Changed

- **Marketplace Visibility**: Added Open VSX badges and refined README labels for better display on extension registries.

## [0.0.13] - 2026-01-18

### Added

- **Open VSX Support**: Extension is now officially published to the Open VSX Registry.
- **Picker Keybindings**: Added Select All and Toggle Selection shortcuts to the file pickers.

## [0.0.10 - 0.0.11] - 2026-01-05

### Added

- **Visual Feedback**: The status bar now displays a success checkmark upon successful clipboard copies.
- **Smart Pinning**: Folders now visually inherit pinned status from their contents, and pinned items automatically sort to the top.

### Fixed

- **Multi-Root Stability**: Optimized path resolution and hydration for multi-root workspaces to prevent file pruning.
- **Extension Reliability**: Fixed several potential crashes during rapid activation cycles and window shutdowns.

## [0.0.9] - 2026-01-05

### Added

- **Performance Optimization**: Implemented background analysis yielding and state dirty-checking to keep the VS Code UI highly responsive in large projects.
- **Tree View Patching**: The staged files view now performs granular updates instead of full refreshes for better performance.

## [0.0.8] - 2025-12-30

### Added

- **Incremental Loading**: Tracks now load in chunks to prevent UI blocking during startup.
- **Batched File Events**: Optimized handling of rapid file renames and deletions.
- **Tree Node Patching**: UI now updates specific branches instead of rebuilding the entire tree.

## [0.0.7] - 2025-12-30

### Added

- **Deep Refresh**: Added recursive re-scanning of staged directories to discover new files.
- **Folder Interaction**: Added support for pinning and removing folders (affects all nested files).

### Fixed

- **Sync Logic**: Resolved "Zombie Folder" issues where deleted directories persisted in the stack.

## [0.0.6] - 2025-12-29

### Added

- **Performance Engine**: Added analysis caching and multi-core hardware scaling for faster token counting.
- **Background Processing**: Background analysis now pauses when the editor is blurred or the sidebar is hidden.
- **Token Feedback**: Added a status bar indicator to show active background analysis.

### Changed

- **Safety Guards**: Implemented streaming tree generation to minimize memory usage during large copies.
- **Customization**: Added global ignore patterns to exclude files from token analysis.

## [0.0.5] - 2025-12-28

### Added

- **Recursive Stats**: Folders now display aggregated token counts for all nested files.
- **Live Sync**: Integrated native VS Code events for immediate rename/delete tracking.

### Fixed

- **UI Freeze**: Fixed freeze caused by async loops persisting across window reloads.
- **Resource Leak**: Fixed CPU spikes from undisposed timers and token calculators.

## [0.0.4] - 2025-12-28

### Changed

- **UX Refinement**: Improved folder picker visibility and standardized multi-root project labeling.

## [0.0.3] - 2025-12-27

### Added

- **Initialization UI**: Added loading indicators and a non-blocking warmup sequence for extension startup.

## [0.0.1] - 2025-12-27

### Added

- **Core Staging**: Drag-and-drop file staging with support for multiple "Context Tracks."
- **AI Context Map**: Optional ASCII directory tree generation for clipboard output.
- **Smart Formatting**: Automatic binary file skipping and Markdown preview of staged context.
- **Token Estimation**: Real-time token counting with configurable warning thresholds.
- **Safety Limits**: 100MB clipboard cap and 5MB per-file limit for extension stability.
- **Privacy First**: 100% local processing; no data is sent to external servers.

[Unreleased]: https://github.com/erclx/ai-context-stacker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/erclx/ai-context-stacker/compare/v0.0.16...v0.1.0
[0.0.16]: https://github.com/erclx/ai-context-stacker/compare/v0.0.15...v0.0.16
[0.0.15]: https://github.com/erclx/ai-context-stacker/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/erclx/ai-context-stacker/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/erclx/ai-context-stacker/compare/v0.0.10...v0.0.13
[0.0.10 - 0.0.11]: https://github.com/erclx/ai-context-stacker/compare/v0.0.9...v0.0.11
[0.0.9]: https://github.com/erclx/ai-context-stacker/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/erclx/ai-context-stacker/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/erclx/ai-context-stacker/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/erclx/ai-context-stacker/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/erclx/ai-context-stacker/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/erclx/ai-context-stacker/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/erclx/ai-context-stacker/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/erclx/ai-context-stacker/releases/tag/v0.0.1
