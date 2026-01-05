# Changelog

All notable changes to the "AI Context Stacker" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.11] - 2026-01-05

### Changed

- **README Refinement**: Focused content on user features over technical details.

### Fixed

- **Spell Check**: Moved custom word lists to external files for better organization.

## [0.0.10] - 2026-01-05

### Added

- **Visual Copy Feedback**: Status bar shows checkmark on successful clipboard operations.
- **Smart URI Resolution**: Concurrent path probing for faster workspace hydration.
- **Lifecycle Guards**: Disposal awareness prevents race conditions during teardown.

### Changed

- **Architecture Cleanup**: Unified token statistics types to reduce memory footprint.
- **State Management**: Removed internal purge command for standard state handling.
- **Main Track Guarantee**: Track existence enforced at initialization.

### Fixed

- **Store Disposal Errors**: Resolved exceptions during rapid activation cycles.
- **Multi-Root Resolution**: Fixed secondary workspace files being pruned during hydration.

## [0.0.9] - 2026-01-05

### Added

- **Hierarchical Pin Bubbling**: Folders inherit pinned status when they contain pinned children.
- **Pinned Item Priority**: Pinned items sort to the top at every tree level.
- **Reactive Tree Re-sorting**: Pin toggles re-order the UI instantly without full tree rebuilds.
- **Incremental Tree Patching**: Tree view updates specific branches instead of full rebuilds.
- **URI Compression**: Paths stored in compact format to reduce storage footprint.
- **State Fingerprinting**: Smart dirty-checking skips redundant save operations.
- **Macro-task Yielding**: Background analysis yields to keep UI responsive.
- **Multi-Root Resolution**: Parallel path probing across multiple workspace folders.
- **Throttled Debugging**: Log sampling prevents output channel flooding.

### Changed

- **Weighted Sort Heuristic**: Tree sorting now follows pinned status, then item type, then alphabetical order.
- **Centralized Lifecycle**: Unified rename and delete logic to prevent de-sync.
- **Reactive UI**: Tree providers observe core state changes passively.
- **Service Disposal**: Reverse-order cleanup ensures proper resource teardown.
- **State Hashing**: Hash-based dirty checking replaces simple length comparison.

### Fixed

- **Pinned Folder Visibility**: Pinned folders now stay at the top instead of being buried alphabetically.
- **Extension Host Starvation**: Resolved race conditions in background loops.
- **Memory Leaks**: Improved service disposal to prevent ghost listeners.
- **Test Stability**: Fixed async timing issues and race conditions.
- **Teardown Race Conditions**: Added filesystem settle-period in tests.
- **Multi-Root Ambiguity**: Absolute URIs stored in multi-root workspaces.

## [0.0.8] - 2025-12-30

### Added

- **Track Loading Service**: Tracks now load in smaller chunks to avoid blocking VS Code on startup.
- **File Lookup Index**: Added faster file existence checks using a lookup table instead of searching arrays.
- **Workspace Event Handler**: Batches rapid file rename and delete operations to reduce processing overhead.
- **Tree Node Updates**: Tree view updates individual items instead of rebuilding the entire tree.
- **Path Caching**: File paths are calculated once when added rather than repeatedly during display.

### Changed

- **Track Manager**: Moved track loading and analysis logic into separate modules.
- **Token Calculation**: Stats are calculated only for the current track and stop immediately when switching tracks.
- **UI Updates**: Reduced frequency of context menu and status bar refreshes.

## [0.0.7] - 2025-12-30

### Added

- **Deep Refresh**: Refresh Stack now performs recursive re-scan of staged directories to discover newly created files.
- **Recursive Tree Traversal**: Added utility to resolve all descendant files when interacting with folder nodes.
- **Folder Pinning UI**: Pin icon and "(Pinned)" label now visible on folder items.
- **Recursive Deletion Sync**: Deleting a folder in Explorer removes all nested staged files from the stack.

### Changed

- **Removal Pickers**: Standardized to check-to-remove pattern with full relative paths displayed.
- **Scan Root Optimization**: Prune nested paths to scan file system at the highest level and reduce I/O overhead.

### Fixed

- **Zombie Folder Bug**: Removing or pinning folders now correctly targets all nested files in the sub-tree.
- **Stale UI State**: Tree reconstruction accurately reflects deletions by flushing recursive folder mappings.
- **Folder Context Menus**: Pin/Remove actions now enabled on folder nodes.

## [0.0.6] - 2025-12-29

### Added

- **Token Analysis Caching**: Analysis data is saved between sessions to eliminate repeated warmup delays.
- **Hardware Scaling**: Processing automatically adjusts based on available CPU cores.
- **Status Bar Indicator**: "Analyzing..." message shows when background token counts are calculating.
- **Track Name Validation**: Real-time duplicate detection prevents creating tracks with existing names.
- **Token Aggregator Service**: Centralized token calculation logic for consistent UI updates.
- **Context Key Service**: Command state management with batched updates to reduce overhead.
- **Persistence Service**: Debounced storage writes to minimize disk I/O.
- **Visibility-Aware Analysis**: Token processing pauses when window is blurred or sidebar is hidden.
- **Non-Blocking Tree Construction**: Large file groups are processed in chunks to prevent UI freezes.
- **Default Excludes Setting**: Added `aiContextStacker.defaultExcludes` for customizable base ignore patterns.
- **Extension-Based Binary Detection**: Fast-path heuristic skips disk I/O for known binary and text file extensions.
- **Constants Module**: Centralized file type sets, size limits, and exclude patterns.

### Changed

- **Track Loading**: Rebuilt initialization to ensure tracks load reliably on startup.
- **UI Refresh**: Improved list updates to reduce flickering when staging large file groups.
- **Registry Architecture**: Eliminated circular dependencies between track and stack providers.
- **Command Registration**: Standardized command factory pattern for maintainability.
- **Configuration Access**: Large file thresholds are now cached to reduce settings reads.
- **Tree Generation**: Context tree uses streaming pattern to reduce memory usage during copies.

### Fixed

- **Stuck Spinner**: Resolved issue where "Warming up..." indicator remained visible after analysis completed.
- **Provider Dependencies**: Fixed circular reference issues in internal registry.
- **File Tracking**: Corrected reference counting logic for accurate cross-track file management.

## [0.0.5] - 2025-12-28

### Added

- **Recursive Stats**: Folder descriptions now show aggregated token counts for entire subtrees.
- **Rename and Delete Sync**: Uses native VS Code events for rename and delete operations.

### Changed

- **Activation**: Extension now activates immediately using direct state loading.
- **File Watching**: Switched from low-level file system watchers to VS Code's high-level events.
- **Process Management**: Added cleanup to terminate background processes on startup.
- **Storage**: Limited workspace state to 100KB to reduce startup time.

### Fixed

- **UI Freeze**: Fixed freeze caused by async loops persisting across window reloads.
- **Resource Leak**: Fixed CPU spikes from undisposed timers and token calculators.
- **Rename Detection**: Fixed issues with rename operations not updating in the Explorer.

## [0.0.4] - 2025-12-28

### Added

- **Picker Consistency**: Added title and search placeholder to the folder picker UI.

### Changed

- **UI Refinement**: Updated "Workspace Root" label to "Project Root" for better clarity.
- **Search Optimization**: Improved folder filtering by hiding technical metadata from search results.
- **Multi-root Support**: Added folder names to project roots to distinguish them in multi-folder workspaces.
- **Folder Picker Refactor**: Standardized the internal logic to match the file picker's structure.

## [0.0.3] - 2025-12-27

### Added

- **Warmup Indicator**: Loading spinner and "Warming up..." label displayed in sidebar during startup.
- **Progress Bar**: VS Code progress bar shown during background token analysis.
- **Status Bar Updates**: "Calculating..." message shown while the extension initializes.

### Changed

- **Sidebar Rendering**: Sidebar now appears immediately on VS Code startup.
- **Token Counting**: Improved performance for large stacks and deep folder structures.
- **Startup Behavior**: Extension no longer blocks VS Code activation.

## [0.0.2] - 2025-12-27

### Added

- **CI/CD Pipeline**: GitHub Actions for cross-platform testing and Marketplace publishing on version tags.
- **Issue Templates**: Bug Report and Feature Request forms.
- **Project Support Setup**: GitHub Discussions enabled and support links configured via `config.yml`.

## [0.0.1] - 2025-12-27

### Added

- **File Staging**: Drag-and-drop files and folders into a staging area.
- **Context Tracks**: Multiple independent stacks for different tasks.
- **Clipboard Copying**: Copies selected items or the full stack when no selection is active.
- **Token Counting**: Live token estimates with debounce.
- **File Warnings**: Visual indicators for large files.
- **Pinning & Filtering**: Pin files and filter to pinned-only view.
- **Context Tree**: Optional ASCII directory tree in clipboard output.
- **Multi-root Support**: Handles multi-folder workspaces correctly.
- **Remote Support**: Works in SSH, WSL, and Codespaces environments.
- **Markdown Preview**: Live preview synced with the stack.
- **Batch Actions**: Add all open files, recursive folder add, bulk select.
- **Navigation Commands**: Reveal files in Explorer or AI Stack.

### Performance & Safety

- **Clipboard Limit**: 100MB maximum clipboard output.
- **File Limits**:
  - Files over 5MB are excluded.
  - Approximate token counting for files over 1MB.
- **Binary Skipping**: Binary files are automatically ignored.
- **Folder Guard**: Confirmation required when adding more than 200 files.

### Security

- All processing is local.
- No data is sent externally.

[Unreleased]: https://github.com/erclx/ai-context-stacker/compare/v0.0.11...HEAD
[0.0.11]: https://github.com/erclx/ai-context-stacker/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/erclx/ai-context-stacker/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/erclx/ai-context-stacker/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/erclx/ai-context-stacker/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/erclx/ai-context-stacker/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/erclx/ai-context-stacker/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/erclx/ai-context-stacker/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/erclx/ai-context-stacker/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/erclx/ai-context-stacker/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/erclx/ai-context-stacker/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/erclx/ai-context-stacker/releases/tag/v0.0.1
