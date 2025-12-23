# Changelog

All notable changes to the "AI Context Stacker" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

**Visual Heatmap (Token Warnings)**

- Added configurable token thresholds (`aiContextStacker.largeFileThreshold`) to flag heavy files.
- **Amber Icon**: Files exceeding the threshold (Default: 5k tokens).
- **Red Icon**: Files exceeding 2x the threshold (Default: 10k tokens).
- **Smart Pinned State**: Pinned files retain their "Pin" icon shape but inherit the warning color if they are large.
- Enhanced tooltips to show specific status (e.g., "Critical: Exceeds 10k tokens").

**Advanced Filtering & Selection**

- **Show Pinned Only**: New toggle in the View Title menu to filter the view to only pinned files.
- **Dynamic View Title**: The view header updates to show `(Pinned Only)` when the filter is active.
- **Filtered Operations**: "Copy Stack" and "Preview Context" commands now respect the active filter (copying only what you see).
- **Remove File Picker**: New "Remove Files..." command launching a multi-select QuickPick for bulk removal.

**Track Management**

- **Drag-and-Drop Reordering**: Context Tracks can now be reordered via drag-and-drop.
- **Manual Reordering**: Added "Move Up" and "Move Down" context menu actions for tracks.
- **Smart Menu Visibility**: Move commands are automatically hidden when invalid (e.g., "Move Up" hidden on the first track).
- **Persisted Order**: Custom track order is saved and restored across VS Code sessions.

**Core Functionality**

- File staging area with hierarchical tree view organized by folder structure
- Context Tracks for managing multiple independent staging contexts
- Drag-and-drop support for files and folders from VS Code Explorer
- Copy Stack command to copy all staged files with one click
- Preview Context command with syntax-highlighted webview
- Status bar integration showing active track name and total token count

**File Management**

- Add Current File command
- Add All Open Files command
- Add Files picker with fuzzy search
- Remove files from stack (individual or bulk)
- Clear Stack command (preserves pinned files)
- Pin/Unpin toggle to protect files from Clear operation
- Automatic detection and filtering of binary files

**Context Organization**

- Create, rename, delete, and switch between tracks
- Track list view showing all available contexts
- Active track indicator in status bar and track list
- Persistent state across VS Code sessions

**Output Options**

- ASCII tree map generation showing project structure
- Copy Context Map Only command (tree without file contents)
- Copy File Content Only command (files without tree)
- Configure Output command for toggling tree inclusion

**Exclusion Management**

- Automatic parsing and respect for `.gitignore` patterns
- Custom exclusion patterns via settings
- Manage Excludes command with checkbox UI for pattern library
- Default exclusions for common directories (node_modules, .git, dist, etc.)

**Performance Features**

- Live token counting with debounced updates during editing
- Estimated token counts displayed per file and in aggregate
- Lazy tree reconstruction to minimize UI blocking
- Asynchronous file statistics enrichment
- Batched file scanning for large directory operations

**User Interface**

- Right-click context menu integration in Explorer
- Right-click context menu integration in editor tabs
- Keyboard shortcuts (F2 for rename, Delete for remove, Ctrl/Cmd+C for copy)
- Empty state with instructional placeholder
- Collapsible folder nodes in tree view
- Icon indicators for pinned files and high-token-count files
- Visual warnings for binary files

**Developer Experience**

- Automatic file rename/move detection via filesystem watcher
- Automatic removal of deleted files from all tracks
- Cancellable operations for long-running scans
- Progress notifications for folder scanning
- Error handling with user-friendly messages and logging
- Output channel for debugging (accessible via "Show Log" button)

### Changed

- **Stack Preview**: Added a guard clause to prevent opening the preview webview when the stack is empty.
- **Context Switching**: "Switch Track" context menu option is now hidden for the currently active track to prevent redundant actions.
- **UI Refinements**: Moved filter and remove commands to a dedicated `filtering` group in the View Title menu (`...`).

### Configuration

- Added `aiContextStacker.largeFileThreshold`: Integer setting to control the token warning levels (default: `5000`).
- `aiContextStacker.excludes` - Array of glob patterns to exclude from file operations (default: `[]`)
- `aiContextStacker.includeFileTree` - Boolean to control ASCII tree inclusion in copied output (default: `true`)

### Technical Details

- Supports VS Code 1.107.0 and above
- TypeScript implementation with strict type checking
- Modular architecture with service registry pattern
- Comprehensive error boundaries around all commands
- Memory-efficient tree building and token estimation
- Webview panel serialization for session persistence
