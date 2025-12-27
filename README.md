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

1. Install the extension from the VS Code Marketplace.
2. Open the **AI Context Stacker** view in the Activity Bar.
3. Drag files into the **Staged Files** panel.
   - Or right-click → **Add to AI Context Stack**.
4. Use **`Ctrl+Alt+A`** (`Cmd+Alt+A` on Mac) to search and add files from anywhere in the editor.
5. Click **Copy Stack** or press **`Ctrl+Shift+C`** when focused on the Staged Files view.
6. Use **`Ctrl+Shift+V`** (`Cmd+Shift+V` on Mac, except in Markdown files) to preview your context before copying.
7. Paste into your LLM.

## Key Features

### File Staging

Drag files or folders into the staging area. Right-click any file in the Explorer to add it. The extension shows what's staged and lets you copy everything in one go.

**Live Token Updates**: Token counts refresh automatically as you edit (400ms debounce). Files over 1MB use optimized statistical estimation to keep the editor responsive during rapid typing.

**Manual Refresh**: Use the dedicated **Refresh Stack** command (found in the `...` menu or press **`Ctrl+Alt+U`**) to force a re-scan of the filesystem and re-calculate all token counts.

### Context Tracks

Create separate tracks for different tasks (e.g. _Bug Fix #123_, _Refactor Auth_). Each track maintains its own list of staged files.

- Reorder tracks by dragging or using **Alt + Up / Down**
- Rename tracks inline with **F2**
- Quickly switch between tracks with **`Ctrl+Alt+S`** (`Cmd+Alt+S` on Mac)

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
- Use **Space** to quickly toggle pin on selected files

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

## Commands

### Stack Operations

| Command                   | Description                                                               | Keybinding                  |
| :------------------------ | :------------------------------------------------------------------------ | :-------------------------- |
| `Add Files...`            | Pick files to add to the stack (includes **Add All** option).             | `Ctrl+Alt+A` / `Cmd+Alt+A`  |
| `Add Folder...`           | Recursively scan and add an entire directory.                             | `Ctrl+Alt+F` / `Cmd+Alt+F`  |
| `Remove Files...`         | Bulk-remove selected files from the stack.                                |                             |
| `Add All Open Files`      | Stage all currently open text editors.                                    |                             |
| `Add Current File`        | Stage the active editor.                                                  |                             |
| `Add to AI Context Stack` | Add file from Explorer context menu.                                      |                             |
| `Reveal in AI Stack`      | Locate and highlight any file within your staged context.                 |                             |
| `Clear Stack`             | Remove all **unpinned** files from the current track.                     | `Shift+Del` (when focused)  |
| `Toggle Pin`              | Pin or unpin selected file(s) for bulk protection.                        | `Space` (when focused)      |
| `Unpin All`               | Instantly unpin all files in the current track (found in the `...` menu). |                             |
| `Refresh Stack`           | Manually re-calculate token counts and sync file metadata from disk.      | `Ctrl+Alt+U` (when focused) |
| `Select All`              | Select all staged files for bulk operations (Pin/Remove).                 | `Ctrl+A` / `Cmd+A`          |

### Output & Clipboard

| Command                | Description                                                        | Keybinding                             |
| :--------------------- | :----------------------------------------------------------------- | :------------------------------------- |
| `Copy Stack`           | Copy all staged content based on your active settings and filters. | `Ctrl+Shift+C` / `Cmd+Shift+C`         |
| `Copy and Clear Stack` | Copy context and immediately clear all unpinned files in one step. | `Ctrl+X` / `Cmd+X` (when focused)      |
| `Copy Content`         | Copy individual file or folder content.                            | `Ctrl+C` / `Cmd+C` (when item focused) |
| `Preview Context`      | Open a live-syncing Markdown preview of your current stack.        | `Ctrl+Shift+V` / `Cmd+Shift+V`         |

### View & Filtering

| Command                  | Description                                           |
| :----------------------- | :---------------------------------------------------- |
| `Reveal in Explorer`     | Open the staged file in the system file manager.      |
| `Collapse All`           | Collapse all folders in the Staged Files view.        |
| `Show Pinned Files Only` | Filter the view to only show pinned items.            |
| `Show All Files`         | Reset filters to show the full stack.                 |
| `Settings...`            | Open VS Code Settings filtered to AI Context Stacker. |

### Track Management

| Command              | Description                                           | Keybinding                             |
| :------------------- | :---------------------------------------------------- | :------------------------------------- |
| `New Track...`       | Create a new isolated context track.                  | `Ctrl+Alt+K` / `Cmd+Alt+K`             |
| `Switch Track...`    | Switch between your saved tracks.                     | `Ctrl+Alt+S` / `Cmd+Alt+S`             |
| `Rename Track...`    | Rename the selected track.                            | `F2` (when focused on track)           |
| `Delete Track`       | Delete the selected track (except for the last one).  | `Del` / `Cmd+Backspace` (when focused) |
| `Reset All Tracks`   | Reset the extension state (removes all tracks/files). | `Shift+Del` / `Shift+Cmd+Backspace`    |
| `Move Track Up/Down` | Reorder tracks in the sidebar.                        | `Alt+Up` / `Alt+Down` (when focused)   |

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut                       | Command           |
| :----------------------------- | :---------------- |
| `Ctrl+Alt+A` / `Cmd+Alt+A`     | Add Files Picker  |
| `Ctrl+Alt+F` / `Cmd+Alt+F`     | Add Folder Picker |
| `Ctrl+Alt+K` / `Cmd+Alt+K`     | New Track         |
| `Ctrl+Alt+S` / `Cmd+Alt+S`     | Switch Track      |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Preview Context   |

### Staged Files View (when focused)

| Shortcut                            | Command              |
| :---------------------------------- | :------------------- |
| `Ctrl+Alt+U` / `Cmd+Alt+U`          | Refresh Stack        |
| `Ctrl+Shift+C` / `Cmd+Shift+C`      | Copy Stack           |
| `Ctrl+X` / `Cmd+X`                  | Copy and Clear Stack |
| `Ctrl+C` / `Cmd+C`                  | Copy File            |
| `Ctrl+A` / `Cmd+A`                  | Select All           |
| `Space`                             | Toggle Pin           |
| `Del` / `Cmd+Backspace`             | Remove File          |
| `Shift+Del` / `Shift+Cmd+Backspace` | Clear Stack          |

### Context Tracks View (when focused)

| Shortcut                            | Command          |
| :---------------------------------- | :--------------- |
| `F2`                                | Rename Track     |
| `Alt+Up` / `Alt+Down`               | Move Track       |
| `Del` / `Cmd+Backspace`             | Delete Track     |
| `Shift+Del` / `Shift+Cmd+Backspace` | Reset All Tracks |

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
- **Iteration**: Use **Copy and Clear Stack** (`Ctrl+X` / `Cmd+X`) to quickly grab context and reset for your next prompt.
- **Smart Copying**: Pressing `Ctrl+C` in the Staged Files view is selection-aware. Select specific files to copy only those, or copy the entire visible stack when nothing is selected.
- **Bulk Operations**: Use `Ctrl+A` to select all files, then `Space` to toggle pin on multiple files at once.
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
