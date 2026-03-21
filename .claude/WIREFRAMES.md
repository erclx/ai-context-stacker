# Wireframes

ASCII wireframes for planning purposes. Structure and layout only, not final design. Update this doc when a new surface is designed or a layout decision changes.

What belongs:

- ASCII diagrams showing layout, hierarchy, and component placement
- A context sentence per section describing when and where it appears
- All meaningful states: empty, loading, error, and any variant where the layout changes significantly
- Exact UI copy strings: labels, empty states, confirmation text, hints
- Interaction rules: what triggers what, navigation flow, confirmation behavior
- Intentional omissions with a brief reason, so they are not re-added later

What does not belong:

- Implementation details (event listeners, API call counts, storage keys); those live in ARCHITECTURE.md
- Visual decisions (colors, spacing, typography); those live in DESIGN.md
- Pixel values or final measurements; verify those in the browser

Use `←` for inline annotations inside diagrams. Use sentence case for all text labels. Document state variants as separate subsections when the layout changes. Keep behavior bullets to UX only: what the user sees and does, not how the code handles it.

## Context Tracks panel

The top panel in the Stackr activity bar container. Always visible. Shows all tracks and lets the user switch, create, rename, reorder, and delete them.

```plaintext
CONTEXT TRACKS                              [+] ← new track
─────────────────────────────────────────────────
  ★ Auth refactor               2.4k  [↑][↓][✗] ← active track (★ = active indicator)
    API work                    1.1k  [↑][↓][✗]
    Main                          —   [↑][↓][✗]
─────────────────────────────────────────────────
```

### Empty state

Shown only on first install before any tracks exist. In practice the "Main" default track is always present, so this state is never reached after activation.

### Behavior

- Clicking a track switches the active stack; the star moves to the clicked track and the Staged Files panel updates
- Double-clicking a track name opens an inline rename input
- Rename rejects duplicate names; the input reverts if the name is taken
- `[+]` opens a name input; pressing Enter creates the track and switches to it
- Tracks cannot be deleted when only one remains; the `[✗]` button is hidden in that case
- `[↑]` and `[↓]` move the track one position in the list; both are hidden when at the boundary
- Drag-and-drop reorders tracks; dropping on a track inserts the dragged track above it

## Staged Files panel

The bottom panel in the Stackr activity bar container. Shows the files staged in the active track, grouped by folder when two or more files share a parent directory.

### Populated state

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

### Empty state

```plaintext
STAGED FILES                [+][📁][⊞]
─────────────────────────────────────
  Add files to your stack →           ← placeholder, non-interactive
```

### Pinned-only filter active, no matching files

```plaintext
STAGED FILES  [filter active]
─────────────────────────────
  No files match your filter  ← shown when filter is on but no files are pinned
```

### Behavior

- `[+]` opens the file picker to add files
- `[📁]` opens the folder picker to add all files in a folder (respects ignore patterns)
- `[⊞]` adds all currently open editors to the stack
- `[📋]` copies the full stack to the clipboard
- `[👁]` opens the preview webview
- `[↺]` re-scans all staged folders for new files
- `[✕]` clears all unpinned files; pinned files stay
- Pinned files sort to the top of the list; pinned folders sort above unpinned folders
- Token count renders as a placeholder while analysis runs, then updates in place
- Files above the large-file threshold (default 5000 tokens) show a warning decoration; files above 2x the threshold show an error decoration
- Right-clicking a file opens a context menu with: Remove, Toggle Pin, Copy Content, Reveal in Explorer
- Drag-and-drop is not supported on the Staged Files panel (intentional; ordering is pinned-first, not manual)

## Status bar

Appears in the VS Code status bar on the left side whenever the extension is active.

```plaintext
 $(layers) Auth refactor · 3.9k tokens
```

### Behavior

- Clicking the status bar item reveals the Stackr activity bar view
- Token count updates as files are added, removed, or analyzed
- Shows `—` for token count when the stack is empty

## Preview webview

Opens as a panel beside the active editor. Shows the formatted output exactly as it would be copied to the clipboard.

````plaintext
┌─────────────────────────────────────────────┐
│  AI Context Preview                  [Copy] │
├─────────────────────────────────────────────┤
│  # Context Map                              │
│                                             │
│  └── src/                                  │
│      ├── middleware.ts                      │
│      └── auth.ts                           │
│                                             │
│  # File Contents                            │
│                                             │
│  File: src/middleware.ts                    │
│  ```typescript                              │
│  ...                                        │
│  ```                                        │
│                                             │
│  File: src/auth.ts                          │
│  ```typescript                              │
│  ...                                        │
│  ```                                        │
└─────────────────────────────────────────────┘
````

### Behavior

- `[Copy]` copies the displayed content to the clipboard and shows a brief confirmation message
- The panel updates automatically when the active stack changes
- Opening the preview while the stack is empty shows a warning message and does not open the panel
- The panel can be revived after VS Code restarts if it was open in the previous session
- Binary files appear in the tree map but their contents are omitted from the file contents section
