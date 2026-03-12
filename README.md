# Stackr

[![Current Version](https://img.shields.io/visual-studio-marketplace/v/erclx.ai-context-stacker?cacheSeconds=3600)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![VS Code Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/erclx.ai-context-stacker?label=vscode&cacheSeconds=3600)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/erclx/ai-context-stacker.svg?label=openvsx&cacheSeconds=3600)](https://open-vsx.org/extension/erclx/ai-context-stacker)

Prepare file context and directory maps for models like ChatGPT, Claude, or Gemini within VS Code. Drag files into organized tracks to copy project context in one action.

<p align="center">
  <img src="https://github.com/erclx/ai-context-stacker/raw/main/demos/hero.gif" alt="Drag and Drop Demo" width="800" />
</p>

## Quick start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** the Stackr view in the Activity Bar.
3. **Stage files** by dragging them into the Staged Files panel, or right-click any file in the Explorer to add it directly.
4. **Quick add** files with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>A</kbd>. Use <kbd>Ctrl</kbd>+<kbd>A</kbd> to select all or <kbd>Ctrl</kbd>+<kbd>Space</kbd> to toggle individual items in the picker.
5. **Preview** the context with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>.
6. **Copy** with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> when focused on the Staged Files view.
7. **Paste** into the model.

Press <kbd>F1</kbd> and type "Stackr" to see all available commands.

## Features

### File staging

- **Token counting:** counts update as you type; large files calculate in the background
- **Persistence:** staged files survive session restarts and load automatically on open
- **Folder syncing:** rescan all staged folders or sync individual folders from their context menu
- **Auto-sync:** renames and deletes reflect automatically as the project structure changes
- **Multi-root support:** works with GitHub Codespaces, WSL2, and SSH Remote sessions

### Context tracks

Create separate tracks for different tasks, for example "Bug Fix #123" or "Refactor Auth." Each track maintains its own staged file list.

- Switch tracks with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>S</kbd>
- Rename inline with <kbd>F2</kbd>
- Reorder by dragging or with <kbd>Alt</kbd>+<kbd>↑↓</kbd> / <kbd>Option</kbd>+<kbd>↑↓</kbd>

### Pinning and filtering

- Pin files to keep them through a **Clear Stack**
- Toggle **Show Pinned Only** to filter the view; copy commands respect the active filter
- Press <kbd>Space</kbd> to toggle pin on selected files

### Context map

Copied output optionally includes an ASCII directory tree:

```plaintext
# Context Map

├── components
│   ├── Header.tsx
│   └── Footer.tsx
└── utils
    └── api.ts
```

### Token warnings

- **Amber** above 5,000 tokens
- **Red** above 10,000 tokens

Both thresholds are configurable in settings.

## Commands

The most common commands and their default keybindings. Press <kbd>F1</kbd> and type "Stackr" to see the full list.

| Command                | Description                                        | Keybinding                                                                                   |
| :--------------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `Copy Stack`           | Copy all staged content respecting active filters. | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> |
| `Copy and Clear Stack` | Copy context then clear unpinned files.            | <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd> (when focused)                    |
| `Preview Context`      | Open a Markdown preview of the current stack.      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> |
| `Add Files`            | Open the file picker.                              | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>A</kbd>     |
| `Switch Track`         | Switch the active track.                           | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>S</kbd>     |

## Settings

All settings are prefixed with `aiContextStacker` in `settings.json`.

| Setting                                   | Default           | Description                                                          |
| :---------------------------------------- | :---------------- | :------------------------------------------------------------------- |
| `aiContextStacker.excludes`               | `[]`              | Glob patterns to exclude from file operations.                       |
| `aiContextStacker.defaultExcludes`        | `[]`              | Base exclude patterns applied to all tracks.                         |
| `aiContextStacker.largeFileThreshold`     | `5000`            | Token count for the amber warning. Red at 2x this value.             |
| `aiContextStacker.showTreeMap`            | `true`            | Include the ASCII directory tree in copied output.                   |
| `aiContextStacker.showTreeMapHeader`      | `true`            | Show the header above the tree map.                                  |
| `aiContextStacker.treeMapText`            | `# Context Map`   | Custom header text for the tree map.                                 |
| `aiContextStacker.includeFileContents`    | `true`            | Include file contents in copied output.                              |
| `aiContextStacker.showFileContentsHeader` | `true`            | Show the header above file contents.                                 |
| `aiContextStacker.fileContentsText`       | `# File Contents` | Custom header text for file contents.                                |
| `aiContextStacker.logLevel`               | `INFO`            | Output channel verbosity. Options: `DEBUG`, `INFO`, `WARN`, `ERROR`. |

## Known limitations

- Output is capped at 100MB
- Files over 5MB are excluded from context
- Token counts are approximate and may differ from model-specific tokenizers
- Binary files are skipped automatically

## Support

- **Issues:** [GitHub Issues](https://github.com/erclx/ai-context-stacker/issues)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE)
