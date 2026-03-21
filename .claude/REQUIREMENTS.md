# Requirements

Describe what the product does and why. Not how it works; that lives in ARCHITECTURE.md. Update this doc when scope changes, goals shift, or a non-goal is promoted to a feature.

What belongs:

- The problem being solved and for whom
- User-facing goals stated as outcomes, not implementation
- Explicit non-goals: scope boundaries that prevent feature creep. Mark deferred items "(deferred)" to signal they are not permanently excluded.
- MVP features as a numbered list: feature name and one-line description; no implementation detail
- Tech stack as a plain list of tools; rationale lives in ARCHITECTURE.md
- Hard constraints that shape all decisions

What does not belong:

- Implementation details, API names, or internal component references
- Rationale for tech choices; that lives in ARCHITECTURE.md
- Anything that describes how a feature is built rather than what it does

## Problem

Developers using AI assistants need to assemble relevant file contents into a single block of text. Copy-pasting files manually is repetitive and loses context across sessions. There is no native VS Code mechanism to stage a named group of files and copy their combined content.

## Goals

- Stage files into named tracks and switch between them without losing context
- Copy the combined content of the active stack to the clipboard with one action
- State persists per workspace across VS Code sessions
- Minimize friction: adding a file, switching a track, or copying context each take one step

## Non-goals

- Making AI API calls or integrating with any external AI service
- Editing file contents from within the extension
- Git-aware staging or diff views (deferred)
- Sharing tracks or context across workspaces (deferred)
- Syncing state across machines

## MVP features

1. Stage files: add files to the active track individually, by folder, or from open editors
2. Remove files: remove staged files individually or by folder, or clear the entire stack
3. Named tracks: create, rename, delete, and switch between named tracks
4. Track ordering: reorder tracks via drag-and-drop or move-up/move-down commands
5. Copy stack: copy combined content of the active stack to the clipboard
6. Copy and clear: copy then immediately clear the stack in one action
7. Pin files: pin files to survive clear operations; pinned files remain until explicitly removed
8. Token counts: display per-file and total token estimates; flag heavy and critical files by threshold
9. Status bar: show the active track name and total token count
10. Preview: render the combined context in a webview panel before copying
11. File lifecycle: auto-update or remove staged files when they are renamed or deleted on disk
12. Folder sync: re-scan staged folders to pick up new files added since the folder was staged
13. Filter: toggle a pinned-only view of the stack

## Tech stack

- VS Code extension API
- TypeScript
- esbuild (bundler)
- `@vscode/test-cli` (test runner)
- sinon (stubs in tests)

## Constraints

- `workspaceState` storage cap: 100KB hard limit per workspace
- Must work fully offline with no network access
- No new runtime dependencies without strong justification; prefer VS Code native APIs
- Must not affect VS Code startup time; activation is event-driven
