---
title: Preview webview
description: Side panel showing the formatted output exactly as it would be copied to the clipboard
---

# Preview webview

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

## Behavior

- `[Copy]` copies the displayed content to the clipboard and shows a brief confirmation message
- The panel updates automatically when the active stack changes
- Opening the preview while the stack is empty shows a warning message and does not open the panel
- The panel can be revived after VS Code restarts if it was open in the previous session
- Binary files appear in the tree map but their contents are omitted from the file contents section
