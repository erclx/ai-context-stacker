# Architecture

Stackr is a VS Code extension for staging files into a named collection, then copying the combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Mental model

A **track** is a named group of files. The **stack** is whichever track is currently active. Developers maintain multiple tracks, one per feature, task, or context, and switch between them. Files in a track are called staged files and carry a small amount of metadata: pin state, folder scan origin, and token count.

```plaintext
workspace
├── track: "Auth refactor"   ← active (the stack)
│   ├── auth.ts
│   └── middleware.ts
└── track: "API work"
    └── routes.ts
```

- **Pinning** keeps files in the stack when the rest is cleared
- **Folder scan flag** controls refresh behavior: individually added files are verified cheaply, folder-sourced files trigger a rescan of their parent directory

## Layer responsibilities

Dependencies flow in one direction:

```plaintext
models → services → providers → commands / ui
```

- **Models:** pure data shapes, no VS Code imports
- **Services:** core logic: persistence, hydration, token analysis, tree building, file lifecycle watching
- **Providers:** bridge between services and VS Code; `TrackManager` owns all mutations, `StackProvider` owns the tree view
- **Commands:** thin handlers; resolve selection, delegate to providers or services, show feedback
- **UI:** tree rendering, status bar, drag and drop, webview preview; owns no state

## Things worth knowing

- State saves are debounced and skipped entirely if nothing changed, so mutations are cheap to call frequently
- Token analysis runs in the background; the tree renders immediately with placeholders and updates as analysis completes
- On startup, saved file paths are validated against the filesystem before the tree renders; missing files are dropped silently
- The tree patches optimistically on small changes rather than rebuilding from scratch, keeping interactions fast on large stacks
