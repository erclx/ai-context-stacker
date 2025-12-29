# Changelog

All notable changes to the "AI Context Stacker" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Removal Pickers**: Standardized to check-to-remove pattern with full relative paths displayed.

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

[Unreleased]: https://github.com/erclx/ai-context-stacker/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/erclx/ai-context-stacker/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/erclx/ai-context-stacker/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/erclx/ai-context-stacker/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/erclx/ai-context-stacker/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/erclx/ai-context-stacker/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/erclx/ai-context-stacker/releases/tag/v0.0.1
