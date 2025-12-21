# AI Context Stacker

Stage files for AI prompts without leaving VS Code.

When you need to send multiple files to ChatGPT or Claude, copying and pasting each one breaks your flow. This extension gives you a staging area where you can collect the files you need, preview the output, and copy everything at once.

![Demo]()

---

## The Problem

Working with LLMs usually means:

1. Open a file, select all, copy
2. Switch to browser, paste
3. Go back to VS Code
4. Repeat for every file
5. Try to remember what you already copied

This gets old fast when you're working with 3-4 files at once.

---

## What It Does

### File Staging

Add files to a stack using the sidebar view, right-click menus, or commands. See exactly what you've staged before copying.

### Context Tracks

Create separate stacks for different tasks. Switch between "bug-fix" and "refactor" contexts without mixing files or losing your place.

### Tree View

Optionally include an ASCII directory tree so the LLM can see your project structure. Turn it off in settings if you don't need it.

### Pinning

Mark certain files (like documentation or specs) to stay in the stack even when you clear everything else.

---

## Installation

1. Open VS Code
2. Extensions (`Ctrl+Shift+X`)
3. Search "AI Context Stacker"
4. Install

---

## Settings

| Setting                            | Type      | Default | Description                                                      |
| ---------------------------------- | --------- | ------- | ---------------------------------------------------------------- |
| `aiContextStacker.excludes`        | `array`   | `[]`    | Glob patterns for files to skip (e.g., `["**/node_modules/**"]`) |
| `aiContextStacker.includeFileTree` | `boolean` | `true`  | Include ASCII tree in copied output                              |

Example:

```json
{
  "aiContextStacker.excludes": ["**/node_modules/**", "**/.git/**"],
  "aiContextStacker.includeFileTree": true
}
```

---

## Commands

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `Add Files`          | Pick files to add to the stack             |
| `Add All Open Files` | Stage everything currently open            |
| `Add Current File`   | Stage the active file                      |
| `Copy Stack`         | Copy all staged content to clipboard       |
| `Clear Stack`        | Remove all files (except pinned ones)      |
| `Preview Context`    | See what will be copied before you copy it |
| `Create New Track`   | Start a new context stack                  |
| `Switch Track`       | Change to a different track                |
| `Toggle Pin`         | Pin or unpin a file                        |

### Keyboard Shortcuts

In the sidebar view:

- `F2` - Rename track
- `Delete` - Remove track or file
- `Ctrl/Cmd+C` - Copy single file content

---

## Basic Workflow

1. Right-click a file → "Add to AI Context Stack"
2. Add more files as needed
3. Run "Copy Stack" (or use the button in the sidebar)
4. Paste into your LLM

For different tasks, create separate tracks so you're not constantly adding and removing the same files.

---

## Tips

**Multiple projects**: Each track keeps its own list of files. Name them by feature or bug number.

**Documentation files**: Pin your README or architecture docs so they're always included.

**Exclude patterns**: Set `aiContextStacker.excludes` to skip test files, build output, or dependencies.
