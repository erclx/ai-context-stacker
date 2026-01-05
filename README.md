# AI Context Stacker

[![Version](https://img.shields.io/visual-studio-marketplace/v/erclx.ai-context-stacker)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/erclx.ai-context-stacker)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)

Prepare file context and directory maps for models like ChatGPT, Claude, or Gemini within VS Code. Drag files into organized tracks to copy project context in one action.

<p align="center">
  <img src="https://github.com/erclx/ai-context-stacker/raw/main/demos/hero.gif" alt="Drag and Drop Demo" width="800" />
</p>

## The Problem

When working with LLMs, the typical workflow involves:

1. Opening a file and copying its contents
2. Switching to the browser
3. Pasting into the chat
4. Returning to VS Code
5. Repeating for each additional file

This process is repetitive, especially with larger codebases or multi-file tasks.

## Quick Start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** the AI Context Stacker view in the Activity Bar.
3. **Stage Files** by dragging them into the Staged Files panel.
   - Or right-click any file in the Explorer → **Add to AI Context Stack**.
4. **Quick Add** files from anywhere using <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> on Mac).
5. **Preview** context with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> on Mac, except in Markdown files).
6. **Copy Stack** by clicking the copy icon or pressing <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> on Mac) when focused on the Staged Files view.
7. **Paste** into the LLM.

**Tip**: Press <kbd>F1</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on Mac) and type "AI Context Stacker" to view available commands.

## Key Features

### File Staging

Drag files or folders into the staging area. The extension tracks added items and allows copying them in a single action.

**Token Counting**: Token counts update as you type. Large files and folders are calculated in the background to prevent blocking the VS Code UI.

**Startup**: The sidebar loads when VS Code opens. Staged files are persisted between sessions.

**Manual Refresh**: If changes occur outside VS Code, use the **Refresh Stack** command (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>) to force a re-scan.

### Context Tracks

Create separate tracks for different tasks (e.g. _Bug Fix #123_, _Refactor Auth_). Each track maintains its own list of staged files.

- Reorder tracks by dragging or using <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd>
- Rename tracks inline with <kbd>F2</kbd>
- Switch between tracks with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> on Mac)

Note: The extension always maintains at least one active track.

### Multi-root Workspace Support

The extension supports **Multi-root Workspaces**.

Staged files are grouped by their project folder name. This clarifies which project each file belongs to, even if multiple projects contain identical paths like `src/index.ts`.

It works with GitHub Codespaces, WSL2, and SSH Remote sessions.

### Auto-Sync

The extension uses VS Code events to keep the stack in sync with the file system.

- **Renames**: Renaming a file in the Explorer updates its path in the stack.
- **Deletes**: Deleting a file removes it from the stack.
- **Updates**: The tree view updates automatically as the project structure changes.

### Token Warnings

Files are color-coded based on estimated token count:

- **Amber** over 5,000 tokens (configurable via settings)
- **Red** over 10,000 tokens
- **Pinned files** retain their pin icon while inheriting warning colors

### Pinning and Filtering

- Pin files to prevent removal during **Clear Stack**
- Toggle **Show Pinned Files Only** to filter the view
- Copy commands respect the active filter
- Use <kbd>Space</kbd> to toggle pin on selected files

Pinned files persist across clears. This is useful for keeping core instruction files in the context.

### Context Map

Optionally include an ASCII directory tree in the copied output.

```

# Context Map

├── components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
├── utils
│   ├── api.ts
│   └── helpers.ts
└── README.md

```

### Selection-Aware Copying

Copy behavior adapts to the current selection:

- **Files selected**: Copies only the selected files.
- **Nothing selected**: Copies the entire visible stack (respecting active filters).

### Navigation

- Right-click files in the Explorer to add them or reveal them in the stack.
- Right-click staged files to reveal them in the system file manager.
- Use **Reveal in AI Stack** to locate a file within the staged context.

## Commands

### Stack Operations

| Command                   | Description                                                   | Keybinding                                                                               |
| :------------------------ | :------------------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| `Add Files...`            | Pick files to add to the stack (includes **Add All** option). | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> |
| `Add Folder...`           | Recursively scan and add a directory.                         | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> |
| `Remove Files...`         | Select files to remove from the stack.                        |                                                                                          |
| `Add All Open Files`      | Stage all currently open text editors.                        |                                                                                          |
| `Add Current File`        | Stage the active editor.                                      |                                                                                          |
| `Add to AI Context Stack` | Add file from Explorer context menu.                          |                                                                                          |
| `Reveal in AI Stack`      | Locate and highlight a file within the staged context.        |                                                                                          |
| `Clear Stack`             | Remove all **unpinned** files from the current track.         | <kbd>Shift</kbd>+<kbd>Del</kbd> (when focused)                                           |
| `Toggle Pin`              | Pin or unpin selected file(s).                                | <kbd>Space</kbd> (when focused)                                                          |
| `Unpin All`               | Unpin all files in the current track (found in `...` menu).   |                                                                                          |
| `Refresh Stack`           | Re-scan filesystem and discover new files in staged folders.  | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> (when focused)                               |
| `Select All`              | Select all staged files.                                      | <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd>                               |

### Output & Clipboard

| Command                | Description                                                   | Keybinding                                                                                   |
| :--------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| `Copy Stack`           | Copy all staged content based on active settings and filters. | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> |
| `Copy and Clear Stack` | Copy context and clear unpinned files.                        | <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd> (when focused)                    |
| `Copy Content`         | Copy individual file or folder content.                       | <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd> (when item focused)               |
| `Preview Context`      | Open a Markdown preview of the current stack.                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> |

### View & Filtering

| Command                  | Description                                           |
| :----------------------- | :---------------------------------------------------- |
| `Reveal in Explorer`     | Open the staged file in the system file manager.      |
| `Collapse All`           | Collapse all folders in the Staged Files view.        |
| `Show Pinned Files Only` | Filter the view to only show pinned items.            |
| `Show All Files`         | Reset filters to show the full stack.                 |
| `Settings...`            | Open VS Code Settings filtered to AI Context Stacker. |

### Track Management

| Command              | Description                                           | Keybinding                                                                               |
| :------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `New Track...`       | Create a new context track.                           | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> |
| `Switch Track...`    | Switch between tracks.                                | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> |
| `Rename Track...`    | Rename the selected track.                            | <kbd>F2</kbd> (when focused on track)                                                    |
| `Delete Track`       | Delete the selected track (except for the last one).  | <kbd>Del</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd> (when focused)                      |
| `Reset All Tracks`   | Reset the extension state (removes all tracks/files). | <kbd>Shift</kbd>+<kbd>Del</kbd> / <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>Backspace</kbd>   |
| `Move Track Up/Down` | Reorder tracks in the sidebar.                        | <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd> (when focused)                 |

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut                                                                                     | Command           |
| :------------------------------------------------------------------------------------------- | :---------------- |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd>     | Add Files Picker  |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd>     | Add Folder Picker |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd>     | New Track         |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd>     | Switch Track      |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Preview Context   |

### Staged Files View (when focused)

| Shortcut                                                                                     | Command              |
| :------------------------------------------------------------------------------------------- | :------------------- |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>     | Refresh Stack        |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy Stack           |
| <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd>                                   | Copy and Clear Stack |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd>                                   | Copy File            |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd>                                   | Select All           |
| <kbd>Space</kbd>                                                                             | Toggle Pin           |
| <kbd>Del</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd>                                         | Remove File          |
| <kbd>Shift</kbd>+<kbd>Del</kbd> / <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>Backspace</kbd>       | Clear Stack          |

### Context Tracks View (when focused)

| Shortcut                                                                               | Command          |
| :------------------------------------------------------------------------------------- | :--------------- |
| <kbd>F2</kbd>                                                                          | Rename Track     |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd>                              | Move Track       |
| <kbd>Del</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd>                                   | Delete Track     |
| <kbd>Shift</kbd>+<kbd>Del</kbd> / <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>Backspace</kbd> | Reset All Tracks |

## Settings

Configuration is managed via VS Code Settings.

| Setting                                   | Default           | Description                                                                             |
| :---------------------------------------- | :---------------- | :-------------------------------------------------------------------------------------- |
| `aiContextStacker.excludes`               | `[]`              | File patterns to exclude (glob patterns).                                               |
| `aiContextStacker.defaultExcludes`        | `[]`              | Base exclude patterns applied to all tracks.                                            |
| `aiContextStacker.largeFileThreshold`     | `5000`            | Token count for **Heavy** warning (Amber). Red at 2x this value.                        |
| `aiContextStacker.showTreeMap`            | `true`            | Include the ASCII directory tree in output.                                             |
| `aiContextStacker.showTreeMapHeader`      | `true`            | Show the title text above the tree map.                                                 |
| `aiContextStacker.treeMapText`            | `# Context Map`   | Custom text for the map header.                                                         |
| `aiContextStacker.includeFileContents`    | `true`            | Include the actual code/text of staged files.                                           |
| `aiContextStacker.showFileContentsHeader` | `true`            | Show the title text above file contents.                                                |
| `aiContextStacker.fileContentsText`       | `# File Contents` | Custom text for the contents header.                                                    |
| `aiContextStacker.logLevel`               | `INFO`            | Control the verbosity of the Output Channel. Options: `DEBUG`, `INFO`, `WARN`, `ERROR`. |

## Tips

- **Sidebar Placement**: Keeping the extension in the **left Activity Bar** improves drag-and-drop from the Explorer.
- **Model Limits**: Adjust `largeFileThreshold` to match your model's context window.
- **Fast Iteration**: Use **Copy and Clear Stack** (<kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd>) to reset quickly between prompts.
- **Selective Copy**: Select specific files to copy only those, or copy everything when nothing is selected.
- **Bulk Actions**: Use <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>A</kbd> then <kbd>Space</kbd> to pin or unpin multiple files at once.

## Known Limitations

- **Clipboard Size**: Output is capped at 100MB to protect VS Code stability.
- **Large Files**: Files over 5MB are excluded from context.
- **Token Estimates**: Counts are approximate and may differ slightly from model-specific tokenizers.
- **Binary Files**: Binary assets are automatically skipped.
- **Large Folders**: Adding folders with more than 200 files requires confirmation.
- **Web VS Code**: Clipboard access in browser-based VS Code requires a secure HTTPS context.

## Support

- **Issues**: [GitHub Issues](https://github.com/erclx/ai-context-stacker/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## License

This project is licensed under the [MIT License](LICENSE).
