---
title: Tree building
description: Folder-and-file tree assembly, optimistic patching, and pin-state propagation
---

# Tree building

## Overview

How `StackProvider` assembles the staged files into a hierarchical tree, when it patches in place vs rebuilds, and how pin state propagates through folders.

## Layout

- `src/services/` owns pure tree assembly from a flat file list
- `src/providers/` owns the cached tree, dirty-bit, and the patch-or-rebuild decision
- `src/ui/` owns the per-item visual representation

## Decisions

- `src/services/tree-builder.ts` owns pure tree assembly from a flat file list.
- `src/providers/stack-provider.ts` owns the cached tree, dirty-bit, and the decision to patch or rebuild.
- `src/ui/stack-item-renderer.ts` owns the per-item visual representation.
- `propagatePinState()` walks the tree bottom-up and sets `folder.isPinned = true` whenever any descendant is pinned. This auto-pins parent folders so they sort with their pinned children. The folder's own `isPinned` flag is the propagated value, not a user-set one.
- `getSortWeight()` adds +2 for pinned items and +1 for folders. Folders therefore sort above root files even when neither is pinned. Pinned files outrank pinned folders only because file weight starts at 0 and folder weight starts at +1.
- `StackProvider.canPerformOptimisticPatch()` short-circuits the rebuild path. Preconditions are: tree not dirty, no filter active, cache exists. Any failure falls back to a full rebuild via `tree-builder`.

## Hidden contracts

- `file.pathSegments` is lazily computed and cached. Once set it is never cleared except via `refreshFileLabel()`. Callers that mutate file URIs (rename, move) must invoke `refreshFileLabel()` or the cached segments will lie. See `src/commands/copy-file.ts` and `src/services/file-lifecycle-service.ts` for the pattern.
- `folder.containedFiles` tracks only direct descendants, not transitive ones. The folder tooltip in `stack-item-renderer.ts` reads this for the "X files directly inside" line and would over-count if it walked subfolders.
- The `ai-stack:` URI scheme marks synthetic empty-state and "no matches" items. Tree code must check `element.uri.scheme === 'ai-stack'` before treating an item as a real file.

## Gotchas

- Optimistic patching only handles single-file add and remove. Track switch, filter toggle, or any structural change marks the tree dirty and forces a full rebuild.
- A user-pinned file inside an unpinned folder still propagates pin to the folder. There is no way to express "pin this file, leave the folder unpinned" in the sort order.
