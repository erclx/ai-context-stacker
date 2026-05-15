---
title: Context Tracks panel
description: Top panel in the Stackr activity bar, lists tracks and lets the user switch, create, rename, reorder, delete
---

# Context Tracks panel

The top panel in the Stackr activity bar container. Always visible. Shows all tracks and lets the user switch, create, rename, reorder, and delete them.

```plaintext
CONTEXT TRACKS                              [+] ← new track
─────────────────────────────────────────────────
  ★ Auth refactor               2.4k  [↑][↓][✗] ← active track (★ = active indicator)
    API work                    1.1k  [↑][↓][✗]
    Main                          —   [↑][↓][✗]
─────────────────────────────────────────────────
```

## Empty state

Shown only on first install before any tracks exist. In practice the "Main" default track is always present, so this state is never reached after activation.

## Behavior

- Clicking a track switches the active stack. The star moves to the clicked track and the Staged Files panel updates
- Double-clicking a track name opens an inline rename input
- Rename rejects duplicate names. The input reverts if the name is taken
- `[+]` opens a name input. Pressing Enter creates the track and switches to it
- Tracks cannot be deleted when only one remains. The `[✗]` button is hidden in that case
- `[↑]` and `[↓]` move the track one position in the list. Both are hidden when at the boundary
- Drag-and-drop reorders tracks. Dropping on a track inserts the dragged track above it
