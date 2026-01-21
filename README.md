# AI Context Stacker

[![Current Version](https://img.shields.io/visual-studio-marketplace/v/erclx.ai-context-stacker?cacheSeconds=3600)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![VS Code Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/erclx.ai-context-stacker?label=vscode&cacheSeconds=3600)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/erclx/ai-context-stacker.svg?label=openvsx&cacheSeconds=3600)](https://open-vsx.org/extension/erclx/ai-context-stacker)

Prepare file context and directory maps for models like ChatGPT, Claude, or Gemini within VS Code. Drag files into organized tracks to copy project context in one action.

<p align="center">
  <img src="https://github.com/erclx/ai-context-stacker/raw/main/demos/hero.gif" alt="Drag and Drop Demo" width="800" />
</p>

## Quick Start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** the AI Context Stacker view in the Activity Bar.
3. **Stage Files** by dragging them into the Staged Files panel.
   - Or right-click a file in the Explorer to **Add to AI Context Stack** or **Copy Content for AI Context**.
4. **Quick Add** files from anywhere using <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>A</kbd>. Once the picker is open, use <kbd>Ctrl</kbd>+<kbd>A</kbd> to select all or <kbd>Ctrl</kbd>+<kbd>Space</kbd> to toggle individual selections.
5. **Preview** context with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (not available in Markdown files on Mac).
6. **Copy Stack** by clicking the copy icon or pressing <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> when focused on the Staged Files view.
7. **Paste** into the LLM.

**Tip**: Press <kbd>F1</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and type "AI Context Stacker" to view available commands.

## Key Features

### File Staging

Drag files or folders into the staging area to track and copy them in a single action.

- **Token Counting**: Token counts update as you type, with large files calculated in the background.
- **Startup**: Staged files persist between sessions and load automatically when VS Code opens.
- **Manual Refresh**: Use the **Refresh Stack** command (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>U</kbd>) to force a re-scan.
- **Multi-root Workspace Support**: Staged files are grouped by project folder name. Works with GitHub Codespaces, WSL2, and SSH Remote sessions.
- **Auto-Sync**: Renames and deletes are reflected automatically as the project structure changes.
- **Navigation**: Right-click files in the Explorer to add them, copy their content, or reveal them in the stack. Right-click staged files to reveal them in the system file manager. Use **Reveal in AI Context Stack** to locate a file within the staged context.

### Context Tracks

Create separate tracks for different tasks (e.g. _Bug Fix #123_, _Refactor Auth_). Each track maintains its own list of staged files.

- Reorder tracks by dragging or using <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Option</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd> / <kbd>Option</kbd>+<kbd>↓</kbd>
- Rename tracks inline with <kbd>F2</kbd>
- Switch between tracks with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>S</kbd>

Note: The extension always maintains at least one active track.

### Token Warnings

Files are color-coded based on estimated token count:

- **Amber** over 5,000 tokens (configurable via settings)
- **Red** over 10,000 tokens
- **Pinned files** retain their pin icon while inheriting warning colors

### Pinning and Filtering

Control which files remain in your stack and customize your view with pinning and filtering options.

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

## Commands

| Command                | Description                                                   | Keybinding                                                                                   |
| :--------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| `Copy Stack`           | Copy all staged content based on active settings and filters. | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> |
| `Copy and Clear Stack` | Copy context and clear unpinned files.                        | <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd> (when focused)                    |
| `Copy Content`         | Copy individual file or folder content.                       | <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd> (when item focused)               |
| `Preview Context`      | Open a Markdown preview of the current stack.                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> |

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut                                                                                     | Command           |
| :------------------------------------------------------------------------------------------- | :---------------- |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>A</kbd>     | Add Files Picker  |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>F</kbd>     | Add Folder Picker |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>K</kbd>     | New Track         |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>S</kbd>     | Switch Track      |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Preview Context   |

### Quick Pickers (when open)

| Shortcut                                                   | Command                     |
| :--------------------------------------------------------- | :-------------------------- |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd> | Select All                  |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd>                           | Toggle Selection            |
| <kbd>Ctrl</kbd>+<kbd>J</kbd>                               | Move Focus Down (Vim-style) |
| <kbd>Ctrl</kbd>+<kbd>K</kbd>                               | Move Focus Up (Vim-style)   |

### Staged Files View (when focused)

| Shortcut                                                                                     | Command              |
| :------------------------------------------------------------------------------------------- | :------------------- |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>U</kbd>     | Refresh Stack        |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy Stack           |
| <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd>                                   | Copy and Clear Stack |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd>                                   | Copy File            |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd>                                   | Select All           |
| <kbd>Space</kbd>                                                                             | Toggle Pin           |
| <kbd>Del</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd>                                         | Remove File          |
| <kbd>Shift</kbd>+<kbd>Del</kbd> / <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>Backspace</kbd>       | Clear Stack          |

### Context Tracks View (when focused)

| Shortcut                                                                                                                   | Command          |
| :------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| <kbd>F2</kbd>                                                                                                              | Rename Track     |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Option</kbd>+<kbd>↑</kbd>, <kbd>Alt</kbd>+<kbd>↓</kbd> / <kbd>Option</kbd>+<kbd>↓</kbd> | Move Track       |
| <kbd>Del</kbd> / <kbd>Cmd</kbd>+<kbd>Backspace</kbd>                                                                       | Delete Track     |
| <kbd>Shift</kbd>+<kbd>Del</kbd> / <kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>Backspace</kbd>                                     | Reset All Tracks |

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
