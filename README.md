# AI Context Stacker

Stage files for LLM prompts without juggling tabs.

Build context for ChatGPT, Claude, Gemini or any LLM directly from VS Code. Drag in files, organize them into tracks, and copy everything at once.

<p align="center">
  <img src="./demos/hero.gif" alt="Drag and Drop Demo" width="800" />
</p>

## The Problem

When working with LLMs, you typically need to:

1. Open a file, copy its contents
2. Switch to your browser
3. Paste it into the chat
4. Return to VS Code
5. Repeat for each additional file

This gets tedious with multiple files.

## Quick Start

1. Install the extension from the VS Code Marketplace
2. Open the AI Context Stacker view in the Activity Bar (left sidebar)
3. Drag files into the "Staged Files" panel (or right-click → "Add to AI Context Stack")
4. Click the Copy Stack button (📋 icon)
5. Paste into your LLM

## Key Features

### File Staging

Drag files or folders into the staging area. Right-click any file in the Explorer to add it. The extension shows you what's staged and lets you copy everything at once.

When adding folders, the picker highlights project directories (ones containing `package.json`, `tsconfig.json`, or `README.md`) to help you find relevant roots quickly.

### Token Warnings

Files are color-coded based on their token count:

- **Amber**: Files over 5k tokens (configurable)
- **Red**: Files over 10k tokens
- **Pinned files** keep their pin icon but inherit the warning color

This helps you spot large files that might hit token limits.

### Navigation

Right-click a file in the Explorer to either add it (if new) or reveal it in the stack (if already staged). Right-click staged files to reveal them in your system file manager.

### Context Tracks

Create separate tracks for different tasks (e.g., "Bug Fix #123", "Refactor Auth"). Each track maintains its own list of staged files. You can reorder tracks by dragging them or using Alt+Up/Down.

Note: You cannot delete the last remaining track. The extension always maintains at least one active track.

### Pinning and Filtering

Pin files to protect them from the "Clear Stack" command. Toggle "Show Pinned Only" to filter the view. The Copy command respects whatever filter is active.

### Context Map

The extension can include an ASCII directory tree in the copied output. This helps the LLM understand your project structure.

```
Context Map
├── components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
├── utils
│   ├── api.ts
│   └── helpers.ts
└── README.md
```

## Installation

1. Open VS Code
2. Open Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search "AI Context Stacker"
4. Click Install

## Settings

Most settings can be configured through the UI (see Commands below), but you can also edit them in `settings.json`:

| Setting                               | Default | Description                                                   |
| :------------------------------------ | :------ | :------------------------------------------------------------ |
| `aiContextStacker.excludes`           | `[]`    | File patterns to exclude (e.g., `["**/node_modules/**"]`)     |
| `aiContextStacker.includeFileTree`    | `true`  | Include ASCII tree in copied output                           |
| `aiContextStacker.largeFileThreshold` | `5000`  | Token count for "Heavy" warning. "Critical" is 2x this value. |

**Tip:** Use "Configure Output...", "Manage Excludes...", and "Set Large File Threshold..." commands instead of manually editing these settings.

## Commands

### Stack Operations

| Command              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `Add Files...`       | Pick files to add to the stack (includes "Add All" option) |
| `Add Folder...`      | Recursively scan and add an entire directory               |
| `Remove Files...`    | Bulk uncheck files to remove them                          |
| `Add All Open Files` | Stage everything currently open                            |
| `Add Current File`   | Stage the active file                                      |
| `Reveal in AI Stack` | Locate the active file in the stack                        |
| `Clear Stack`        | Remove all files (except pinned ones)                      |
| `Toggle Pin`         | Pin or unpin selected file(s) - supports bulk operations   |

### Output & Clipboard

| Command                  | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| `Copy Stack`             | Copy all staged content to clipboard (respects active filter)              |
| `Copy Context Map Only`  | Copy just the ASCII tree                                                   |
| `Copy File Content Only` | Copy files without the tree                                                |
| `Preview Context`        | Open a live-syncing webview. Retains scroll position when you switch tabs. |

### View & Filtering

| Command                       | Description                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `Reveal in Explorer`          | Open selected staged file in system file manager                                 |
| `Collapse All`                | Instantly collapse all folders (auto-hides if no folders)                        |
| `Select All`                  | Use `Cmd+A` or `Ctrl+A` to instantly select all staged files for bulk operations |
| `Show Pinned Files Only`      | Filter the view to only pinned files                                             |
| `Show All Files`              | Reset the view to show all staged files                                          |
| `Manage Excludes...`          | Configure exclusion patterns                                                     |
| `Configure Output...`         | Toggle output options                                                            |
| `Set Large File Threshold...` | Adjust token warning levels                                                      |

### Track Management

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `New Track...`      | Start a new context stack                        |
| `Switch Track...`   | Change to a different track                      |
| `Rename Track...`   | Rename the current track                         |
| `Delete Track`      | Remove a track                                   |
| `Delete All Tracks` | Reset workspace (delete all tracks)              |
| `Move Up / Down`    | Reorder tracks via Context Menu or Alt + Up/Down |

## Keyboard Shortcuts

| Shortcut                   | Command         | Context                        |
| -------------------------- | --------------- | ------------------------------ |
| `F2`                       | Rename Track    | When focused on Context Tracks |
| `Delete` / `Cmd+Backspace` | Delete Track    | When focused on Context Tracks |
| `Delete` / `Cmd+Backspace` | Remove File     | When focused on Staged Files   |
| `Ctrl+C` / `Cmd+C`         | Copy Content    | When focused on Staged Files   |
| `Alt+Up`                   | Move Track Up   | When focused on Context Tracks |
| `Alt+Down`                 | Move Track Down | When focused on Context Tracks |
| `Ctrl+A` / `Cmd+A`         | Select All      | When focused on Staged Files   |

## Tips

Adjust `aiContextStacker.largeFileThreshold` based on your model's context window. Lower values for smaller models, higher for larger ones.

Use "Show Pinned Only" when you only want to copy specific files. The Copy command respects active filters.

Click the status bar item to quickly copy your stack without opening the sidebar.

## Known Limitations

- Binary files are automatically detected by scanning the first 512 bytes for null characters, not just by extension
- Files over 100KB use faster character-based token estimation instead of word counting
- Individual files over 5MB are skipped to prevent extension lag
- Total context payload is capped at 100MB to ensure clipboard stability
- Token estimates are approximate (based on character count heuristics, not actual tokenizer output)
- The extension respects VS Code's file scheme restrictions (works with local files and most remote schemes)
- Bulk Protection: Adding folders with >200 files triggers a confirmation warning to prevent Extension Host performance issues

## Support

- **Issues**: [GitHub Issues](https://github.com/erclx/ai-context-stacker/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## License

MIT © 2025

Made with ☕ for developers who are tired of context switching.
