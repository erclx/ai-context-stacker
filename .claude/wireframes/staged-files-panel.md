---
title: Staged Files panel
description: Bottom panel in the Stackr activity bar, shows files staged in the active track
---

# Staged Files panel

The bottom panel in the Stackr activity bar container. Shows the files staged in the active track, grouped by folder when two or more files share a parent directory.

## Populated state

```plaintext
STAGED FILES                [+][📁][⊞][📋][👁][↺][✕]
─────────────────────────────────────────────────────
  📌 middleware.ts                          800  ← pinned, at top
  📌 auth.ts                               650
  📁 src/services/
       persistence-service.ts             1.2k
       hydration-service.ts                 900
  routes.ts                                350  ← heavy threshold approaching
─────────────────────────────────────────────────────
  Total: 3.9k tokens
```

## Empty state

```plaintext
STAGED FILES                [+][📁][⊞]
─────────────────────────────────────
  Add files to your stack →           ← placeholder, non-interactive
```

## Pinned-only filter active, no matching files

```plaintext
STAGED FILES  [filter active]
─────────────────────────────
  No files match your filter  ← shown when filter is on but no files are pinned
```

## Behavior

- `[+]` opens the file picker to add files
- `[📁]` opens the folder picker to add all files in a folder (respects ignore patterns)
- `[⊞]` adds all currently open editors to the stack
- `[📋]` copies the full stack to the clipboard
- `[👁]` opens the preview webview
- `[↺]` re-scans all staged folders for new files
- `[✕]` clears all unpinned files. Pinned files stay
- Pinned files sort to the top of the list. Pinned folders sort above unpinned folders
- Token count renders as a placeholder while analysis runs, then updates in place
- Files above the large-file threshold (default 5000 tokens) show a warning decoration. Files above 2x the threshold show an error decoration
- Right-clicking a file opens a context menu with: Remove, Toggle Pin, Copy Content, Reveal in Explorer
- Drag-and-drop is not supported on the Staged Files panel (intentional. Ordering is pinned-first, not manual)
