---
title: Stats and analysis
description: Background token enrichment, debounce priority, and stat cache invariants
---

# Stats and analysis

How `AnalysisEngine` enriches files with token counts in the background, how debounce priority shifts based on user activity, and what the stat cache does and does not invalidate on.

## Layer responsibilities

- `src/services/analysis-engine.ts` owns the enrichment queue, warming-up state, and cancellation
- `src/services/stats-processor.ts` owns the per-file stat cache keyed by mtime and size
- `src/utils/token-estimator.ts` is the stateless character-based estimator

## Decisions

- Debounce priority is dynamic. `setExecutionPriority(true)` switches the engine to 400ms debounce for active typing. `setExecutionPriority(false)` reverts to 2000ms for idle background work. Callers flip priority around user-driven mutations (track switch, file add) so the user sees fast updates without paying the cost continuously.
- UI updates are throttled separately at 100ms via `UI_THROTTLE_MS`. Even when analysis bursts, the tree re-renders no more than ten times a second.
- Stat cache caps at 1000 entries. On overflow, oldest-by-mtime entries are trimmed in `stats-processor.ts`. This is a soft LRU. It assumes mtime is a fair proxy for "least recently used".

## Hidden contracts

- `_isWarmingUp` stays true until the first enrichment pass completes. UI gates "Calculating..." display on this flag combined with `_activeEnrichmentCount > 0`. A file with `stats === undefined` after warmup is permanently unprocessed for that session, not pending.
- `isAnalyzing` is the public read for UI. It is true whenever any enrichment is running. Code that needs to check warmup specifically must read `_isWarmingUp`.
- Token estimation is character-based, not tokenizer-accurate. Counts are directionally correct but not model-accurate. ARCHITECTURE.md notes this. Code that surfaces the count to the user prefixes it with `~`.

## Gotchas

- The stat cache does not invalidate on external file edits if mtime and size are unchanged. A user who edits a staged file outside VS Code in a way that preserves byte size (overwrite with same length) will see a stale token count for that file until the file is re-added.
- Cancellation runs per enrichment pass. A new pass cancels the previous via the `CancellationTokenSource`. Files mid-enrichment are dropped, not requeued. The next mutation triggers them again.
