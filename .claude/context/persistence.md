---
title: Persistence
description: workspaceState serialization, fingerprinting, and the 100KB cap behavior
---

# Persistence

## Overview

How `PersistenceService` writes track state to `workspaceState`, how fingerprinting skips redundant writes, and what happens at the 100KB cap.

## Layout

- `src/services/` owns serialization, debouncing, fingerprint comparison, and the save-trigger call on every mutation

## Decisions

- `src/services/persistence-service.ts` owns serialization, debouncing, and fingerprint comparison.
- `src/services/track-manager.ts` calls `requestSave()` on every mutation.
- VS Code's `ExtensionContext.workspaceState` is the storage backend.
- The fingerprint hashes track IDs, file URIs, and the active track ID. It does not include file order, stats, or per-file metadata. Reordering files within a track currently does change the URI list order. Mutations that produce the same fingerprint (a no-op rename to itself, an add-then-remove of the same file) are skipped.
- Hydration is deferred 10ms via `setTimeout`. This lets the extension activate and register views before the first storage read. Missing files are silently dropped during hydration. No error surfaces to the user.
- `saveImmediate()` exists as an explicit flush for moments where the debounce is unsafe (track switch, track deletion, deactivation). Normal mutations call `requestSave()` and rely on the 500ms debounce.

## Hidden contracts

- The storage key is `aiContextStacker.tracks.v1`. The `v1` suffix is a forward-compatibility marker. Schema migrations must bump the key, not transform in place.
- Save is aborted, not truncated, when serialized JSON exceeds 100KB. A warning message shows. There is no fallback storage and no per-track partial save.
- Debounce is 500ms. Multiple `requestSave()` calls within the window coalesce to a single write. The fingerprint check then decides if that write actually runs.

## Gotchas

- `workspaceState` is per-workspace and per-machine. There is no sync across machines and no migration path off the 100KB cap. A user who hits the cap loses any further additions until they remove files.
- Hydration drops missing files silently. A user who renames a file outside VS Code and reopens the workspace will see the file gone from the track, with no notification.
