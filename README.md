# AI Context Stacker

[![Version](https://img.shields.io/visual-studio-marketplace/v/erclx.ai-context-stacker)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/erclx.ai-context-stacker)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/erclx.ai-context-stacker)](https://marketplace.visualstudio.com/items?itemName=erclx.ai-context-stacker)

Prepare file context and directory maps for models like ChatGPT, Claude, or Gemini without leaving VS Code. Drag files into organized tracks to copy complete project context in one action.

<p align="center">
  <img src="https://github.com/erclx/ai-context-stacker/raw/main/demos/hero.gif" alt="Drag and Drop Demo" width="800" />
</p>

## The Problem

When working with LLMs, you typically need to:

1. Open a file and copy its contents
2. Switch to your browser
3. Paste it into the chat
4. Return to VS Code
5. Repeat for each additional file

This gets tedious fast—especially with larger codebases or multi-file tasks.

## Quick Start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** the AI Context Stacker view in the Activity Bar.
3. **Stage Files** by dragging them into the Staged Files panel.
   - Or right-click any file in the Explorer → **Add to AI Context Stack**.
4. **Quick Add** files from anywhere using <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> on Mac).
5. **Preview** your context with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> on Mac, except in Markdown files).
6. **Copy Stack** by clicking the copy icon or pressing <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> on Mac) when focused on the Staged Files view.
7. **Paste** into your LLM.

> **Tip**: Press <kbd>F1</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> on Mac) and type "AI Context Stacker" to discover all available commands.

## Key Features

### File Staging

Drag files or folders into the staging area. Right-click any file in the Explorer to add it. The extension shows what's staged and lets you copy everything in one go.

**Live Token Updates**: Token counts refresh automatically as you edit (400ms debounce). Files over 1MB use optimized statistical estimation to keep the editor responsive during rapid typing.

**Startup Behavior**: The sidebar appears immediately when VS Code opens. Token analysis runs in the background during a brief warmup period, showing a loading spinner and "Calculating..." in the Status Bar until complete.

**Manual Refresh**: Use the dedicated **Refresh Stack** command (found in the `...` menu or press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd>) to force a re-scan of the filesystem and re-calculate all token counts.

### Context Tracks

Create separate tracks for different tasks (e.g. _Bug Fix #123_, _Refactor Auth_). Each track maintains its own list of staged files.

- Reorder tracks by dragging or using <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd>
- Rename tracks inline with <kbd>F2</kbd>
- Quickly switch between tracks with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> on Mac)

Note: The extension always maintains at least one active track. The last remaining track cannot be deleted.

### Multi-root Workspace Support

Designed for professional workflows, AI Context Stacker fully supports **Multi-root Workspaces**.

Staged files are grouped by their project folder name so the LLM understands which project each file belongs to—even when multiple projects contain identical paths like `src/index.ts`.

Works seamlessly across GitHub Codespaces, WSL2, and SSH Remote sessions with optimized clipboard and drag-and-drop handling for remote environments.

### Token Warnings

Files are color-coded based on estimated token count:

- **Amber** — over 5,000 tokens (configurable via `largeFileThreshold`)
- **Red** — over 10,000 tokens (2x the threshold)
- **Pinned files** retain their pin icon while inheriting warning colors

This helps you spot large files before hitting model limits.

### Pinning and Filtering

- Pin files to protect them from **Clear Stack**
- Toggle **Show Pinned Files Only** to filter the view
- Copy commands respect the active filter
- Use <kbd>Space</kbd> to quickly toggle pin on selected files

Pinned files persist across clears and workflow resets.

### Context Map

Optionally include an ASCII directory tree in the copied output to help the LLM understand project structure.

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

Copy commands adapt to your current selection:

- **Files selected** → Copies only the selected files
- **Nothing selected** → Copies the entire visible stack (respects active filters)

This makes both targeted and bulk operations intuitive without separate commands.

### Navigation

- Right-click files in the Explorer to add them or reveal them in the stack
- Right-click staged files to reveal them in your system file manager
- Use **Reveal in AI Stack** to locate and highlight any file within your staged context

## Performance

The extension handles large stacks without blocking VS Code. The sidebar renders immediately on startup while token counting happens in the background. Folder trees with hundreds of files build quickly, and long operations show progress using VS Code's native progress bar.

## Commands

### Stack Operations

| Command                   | Description                                                               | Keybinding                                                                               |
| :------------------------ | :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| `Add Files...`            | Pick files to add to the stack (includes **Add All** option).             | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> |
| `Add Folder...`           | Recursively scan and add an entire directory.                             | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> |
| `Remove Files...`         | Bulk-remove selected files from the stack.                                |                                                                                          |
| `Add All Open Files`      | Stage all currently open text editors.                                    |                                                                                          |
| `Add Current File`        | Stage the active editor.                                                  |                                                                                          |
| `Add to AI Context Stack` | Add file from Explorer context menu.                                      |                                                                                          |
| `Reveal in AI Stack`      | Locate and highlight any file within your staged context.                 |                                                                                          |
| `Clear Stack`             | Remove all **unpinned** files from the current track.                     | <kbd>Shift</kbd>+<kbd>Del</kbd> (when focused)                                           |
| `Toggle Pin`              | Pin or unpin selected file(s) for bulk protection.                        | <kbd>Space</kbd> (when focused)                                                          |
| `Unpin All`               | Instantly unpin all files in the current track (found in the `...` menu). |                                                                                          |
| `Refresh Stack`           | Manually re-calculate token counts and sync file metadata from disk.      | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>U</kbd> (when focused)                               |
| `Select All`              | Select all staged files for bulk operations (Pin/Remove).                 | <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd>                               |

### Output & Clipboard

| Command                | Description                                                        | Keybinding                                                                                   |
| :--------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `Copy Stack`           | Copy all staged content based on your active settings and filters. | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> |
| `Copy and Clear Stack` | Copy context and immediately clear all unpinned files in one step. | <kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd> (when focused)                    |
| `Copy Content`         | Copy individual file or folder content.                            | <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd> (when item focused)               |
| `Preview Context`      | Open a live-syncing Markdown preview of your current stack.        | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> |

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
| `New Track...`       | Create a new isolated context track.                  | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd> |
| `Switch Track...`    | Switch between your saved tracks.                     | <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> |
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

All configuration is managed natively via VS Code Settings.

| Setting                                   | Default           | Description                                                      |
| :---------------------------------------- | :---------------- | :--------------------------------------------------------------- |
| `aiContextStacker.excludes`               | `[]`              | File patterns to exclude (glob patterns).                        |
| `aiContextStacker.largeFileThreshold`     | `5000`            | Token count for **Heavy** warning (Amber). Red at 2x this value. |
| `aiContextStacker.showTreeMap`            | `true`            | Include the ASCII directory tree in output.                      |
| `aiContextStacker.showTreeMapHeader`      | `true`            | Show the title text above the tree map.                          |
| `aiContextStacker.treeMapText`            | `# Context Map`   | Custom text for the map header.                                  |
| `aiContextStacker.includeFileContents`    | `true`            | Include the actual code/text of staged files.                    |
| `aiContextStacker.showFileContentsHeader` | `true`            | Show the title text above file contents.                         |
| `aiContextStacker.fileContentsText`       | `# File Contents` | Custom text for the contents header.                             |

## Tips

- **Model Context**: Adjust `largeFileThreshold` based on your model's context window to match your specific LLM's token limits.
- **Iteration**: Use **Copy and Clear Stack** (<kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Cmd</kbd>+<kbd>X</kbd>) to quickly grab context and reset for your next prompt.
- **Smart Copying**: Pressing <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd> in the Staged Files view is selection-aware. Select specific files to copy only those, or copy the entire visible stack when nothing is selected.
- **Bulk Operations**: Use <kbd>Ctrl</kbd>+<kbd>A</kbd> / <kbd>Cmd</kbd>+<kbd>A</kbd> to select all files, then <kbd>Space</kbd> to toggle pin on multiple files at once.
- **Remote Work**: Optimized for GitHub Codespaces, WSL2, and SSH sessions with clipboard and file operations.

## Known Limitations

- **Clipboard Safeguard**: Payload is capped at 100MB to prevent V8 engine crashes and system lag. Operations exceeding this limit return empty to protect IDE stability.
- **Large File Shield**: Files over 5MB are excluded from context to prevent model rejection. Files over 1MB use high-speed statistical estimation instead of full buffer scanning to maintain UI responsiveness.
- **Binary Files**: Automatically detected and skipped via null-byte scanning.
- **Token Accuracy**: Estimates use character/word density heuristics optimized for speed. While highly accurate, they may vary slightly from specific model tokenizers.
- **Bulk Safety**: Adding folders with more than 200 files triggers a confirmation warning.
- **Clipboard API**: In web-based VS Code environments (e.g., vscode.dev), clipboard access requires a secure HTTPS context.

## Support

- **Issues**: [GitHub Issues](https://github.com/erclx/ai-context-stacker/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## License

This project is licensed under the [MIT License](LICENSE).
