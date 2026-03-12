# Architecture overview

AI Context Stacker is a VS Code extension for staging files into a named collection, then copying the combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Mental model

The two core concepts are a **track** and a **stack**. A track is a named group of files. The stack is whichever track is currently active. Developers can maintain multiple tracks — one per feature, task, or context — and switch between them. Files in a track are called staged files. They carry a small amount of metadata: whether they're pinned, whether they came from a folder scan, and their token count.

Pinning keeps files in the stack when the rest is cleared. The folder scan flag changes how the extension behaves during a refresh — files added individually are verified cheaply, files from a folder scan trigger a rescan of their parent directory.

## Layer responsibilities

The codebase splits into five layers. Each owns a distinct concern and depends only on layers below it.

**Models** define the data shapes everything else uses. Nothing else lives here.

**Services** handle the hard problems in isolation: reading and writing state to disk, validating saved files against the filesystem on startup, counting tokens, building and updating the tree structure, and watching for file renames and deletions in the workspace.

**Providers** are the bridge between services and VS Code. `TrackManager` is the single source of truth for all file mutations. `StackProvider` owns the tree view and decides when to rebuild or patch it. Neither knows about commands or UI.

**Commands** are thin. Each one resolves what the user selected, delegates to a provider or service, and shows feedback. No business logic lives in a command.

**UI** covers tree item rendering, the status bar, drag and drop, and the webview preview. It reads from providers and fires commands; it owns nothing itself.

## Things worth knowing

State is saved debounced and skipped entirely if nothing has changed, so mutations are cheap to call frequently.

Token analysis runs in the background after files are added. The tree renders immediately with placeholder values and updates as analysis completes, so large stacks do not block the UI.

On startup, previously saved file paths are validated against the filesystem before the tree renders. Files that no longer exist are dropped silently.

The tree updates optimistically on small changes rather than rebuilding from scratch, which keeps interactions fast even with large stacks.
