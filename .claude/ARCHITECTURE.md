# Architecture

Describe the system shape and the decisions behind it. Not a tutorial, setup guide, or implementation walkthrough. Update this doc when a new decision is made or a risk is resolved, not after the fact.

What belongs:

- A high-level overview of how the system is structured and why
- A file tree with brief inline annotations, enough to orient a new developer
- Key technical decisions as named H3 entries: what was chosen and why this over the alternatives, including stack and library choices
- Risks and open questions still unresolved

What does not belong:

- Setup commands or install instructions; those live in README
- How individual functions work line by line; that belongs in code comments
- Full type definitions; those live in code. Reference the shape conceptually if needed.

Name each decision clearly. Give the reasoning, especially for non-obvious choices. Skip entries where the rationale is self-evident.

## Overview

Stackr is a VS Code extension with a strict unidirectional dependency graph: `models → services → providers → commands / ui`. `ServiceRegistry` is the composition root; it constructs every service, wires dependencies, and owns the disposal lifecycle. `extension.ts` calls `services.register()` then hands off to `ViewManager` and command registration.

State flows in one direction: `TrackManager` owns all mutations to tracks and files. `StackProvider` and `TrackProvider` observe `TrackManager` via events and push updates to the tree views. Commands delegate to providers; providers delegate to services.

## Structure

```plaintext
src/
├── commands/          ← one file per command group, all thin handlers
├── models/            ← pure data shapes, no VS Code imports
├── providers/         ← VS Code TreeDataProvider implementations and track/ignore management
├── services/          ← core logic: persistence, hydration, analysis, tree building, file watching
├── ui/                ← tree rendering, status bar, drag and drop, webview preview
├── utils/             ← stateless helpers: clipboard, formatting, file scanning, token estimation
├── constants.ts       ← shared constants: file size limits, exclude patterns, known extensions
└── extension.ts       ← activation entry point, wires ServiceRegistry and registers commands
```

## Key technical decisions

### esbuild for bundling, tsc for type checking

esbuild handles bundling; `tsc --noEmit` runs separately for type errors. Both run as part of `compile` and `package`. This keeps the bundle step fast while keeping strict type safety. The two processes are independent: esbuild does not perform type checking, and tsc does not emit files.

### ServiceRegistry as a singleton with disposal tiers

`ServiceRegistry` is constructed fresh on every activation and stores itself as a static `_instance`. `ServiceRegistry.disposeExisting()` runs first on activation to kill any zombie instance from a previous dev host session. Disposal runs in three tiers — foundation services first, then stateful services, then view providers — to prevent use-after-dispose errors during shutdown.

### workspaceState for persistence

State is stored in VS Code's `workspaceState`, keyed as `aiContextStacker.tracks.v1`. This gives per-workspace isolation with no filesystem writes and no file-watching overhead. The tradeoff is a hard 100KB storage cap enforced in `PersistenceService`. Files that exceed the cap are not saved; a warning message is shown instead.

### Debounced, fingerprinted saves

`PersistenceService.requestSave()` debounces writes by 500ms. Before each write, the service computes a hash over all track IDs, file URIs, and the active track ID. If the hash matches the last written fingerprint, the write is skipped. This makes it safe to call `requestSave()` on every mutation without redundant storage writes.

### Async hydration deferred by 10ms

`TrackManager` schedules hydration via `setTimeout(..., 10)` rather than calling it in the constructor. This lets the extension activate and register its views before the first storage read. Missing files are dropped silently during hydration; the tree renders with whatever survives validation.

### Optimistic tree patching

`StackProvider` maintains a cached tree. On single-file add or remove operations, it patches the cache in place rather than rebuilding from scratch. A full rebuild only runs when the tree is marked dirty (track switch, filter toggle, or structural change). This keeps interactions fast on large stacks.

### Background token analysis with cancellation

`AnalysisEngine` enriches files in the background after each add or track switch. The provider issues a `CancellationTokenSource` for each enrichment run and cancels the previous one before starting a new one. The tree renders immediately with placeholder token counts and updates in place as analysis completes via `onDidUpdateStats`.

## Risks / open questions

- The 100KB `workspaceState` cap is a hard wall with no migration path. Large workspaces with many staged files across many tracks could hit it.
- Token estimation is character-based approximation, not a real tokenizer. Counts are directionally correct but not model-accurate.
