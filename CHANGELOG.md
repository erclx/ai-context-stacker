# Changelog

All notable changes to the "AI Context Stacker" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2025-12-27

### Added

- **Automated CI/CD**: Implemented GitHub Actions to automatically run cross-platform tests (Windows, macOS, Ubuntu) and publish to the Marketplace on version tags.
- **Issue Templates**: Added structured forms for Bug Reports and Feature Requests to streamline community feedback.
- **Community Infrastructure**: Enabled GitHub Discussions and configured `config.yml` to redirect support questions and documentation requests.

## [0.0.1] - 2025-12-27

### Added

- **File Staging System**: Drag-and-drop files or folders into the staging area to build context for LLM prompts without tab-switching.
- **Context Tracks**: Create and manage multiple isolated staging environments (e.g., "Refactor Auth," "Bug Fix #102") to stay organized across tasks.
- **Smart Clipboard Operations**: Selection-aware copying that automatically detects user intent—copies specifically selected items or the entire stack if no selection is active.
- **Live Token Counting**: Real-time token estimation with a 400ms debounce to ensure the UI remains responsive even during heavy document edits.
- **Visual Warning System**: Color-coded indicators for large files (Amber at 5k tokens, Red at 10k tokens) to help manage model context window limits.
- **Pin & Filter**: Protect specific files from "Clear Stack" operations and toggle a "Pinned Only" view to focus on core project context.
- **ASCII Context Map**: Optionally include a visual directory tree structure in your clipboard output to help LLMs understand your project's architecture.
- **Multi-root Workspace Support**: Automatic project folder grouping and path disambiguation for professional multi-repo workflows.
- **Remote Environment Support**: Fully optimized for VS Code Remote (SSH, WSL2) and GitHub Codespaces.
- **Live Preview System**: Dedicated Markdown preview (`Ctrl+Shift+V`) that live-syncs with your stack, allowing verification before you copy.
- **Bulk Productivity Tools**: "Add All Open Files," recursive folder scanning, and "Select All" for batch removal or pinning.
- **Navigation Shortcuts**: "Reveal in Explorer" and "Reveal in AI Stack" commands to bridge the gap between your workspace and your staged context.

### Performance & Safety

- **Memory Guard**: Implemented a **100MB clipboard cap** to protect the VS Code Extension Host and V8 engine from memory exhaustion.
- **File Size Shields**:
  - Automatically excludes files **>5MB** from context to prevent LLM rejection.
  - Implemented high-speed statistical heuristics for token counts on files **>1MB** to maintain IDE fluidity.
- **Binary Detection**: Integrated a null-byte head-scan (512-byte buffer) to detect and automatically skip binary assets.
- **Batch Safeguard**: Added a confirmation threshold for folder additions exceeding 200 files to prevent accidental I/O saturation.

### Security

- All processing and context generation occur **strictly locally** on your machine.
- No code data is ever transmitted to external servers by this extension.

[Unreleased]: https://github.com/erclx/ai-context-stacker/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/erclx/ai-context-stacker/releases/tag/v0.0.1
