---
title: Filtering and sorting
description: Pinned-only filter, sort weights, and refresh-vs-resort race semantics
---

# Filtering and sorting

## Overview

How the tree filters to pinned items, how items sort within a track, and how filter toggles interact with refresh events.

## Layout

- `src/providers/` owns pinned-filter state and context-key broadcasting
- `src/services/` owns sort weight calculation and filter-state mirroring to VS Code context keys

## Decisions

- `src/providers/stack-provider.ts` owns `_showPinnedOnly` state and broadcasts it via context keys.
- `src/services/tree-builder.ts` owns sort weight calculation.
- `src/services/context-key-service.ts` mirrors filter state to VS Code context keys for menu visibility.
- Sort uses `Intl.Collator` with numeric sensitivity. Files like `2-foo.ts` and `10-foo.ts` order numerically, not lexically. Within equal weight, ordering is alphabetic by display name.
- Pinned filter state is mirrored to a context key (`aiContextStacker.pinnedFilterActive`) so the toolbar button can swap its icon. The provider does not read the context key back. State is one-way out.
- `togglePinnedOnly()` marks dirty and triggers a full refresh. `resort()` skips the dirty-mark when no filter is active and fires refresh directly. Splitting these prevents a back-to-back toggle from racing a stale resort.

## Hidden contracts

- Sort weights are: pinned item +2, folder +1, root file 0. A pinned file (weight 2) outranks a pinned folder (weight 3) only because file pin adds +2 to a base 0 and folder pin adds +2 to a base 1.
- Filter is binary. There is no per-track filter state. Toggling the filter affects the active track view but the underlying file list is unchanged.
- "No matches" rendering is a synthetic `ai-stack:` URI item, not a real tree node. Filter code must emit this when the filtered list is empty so the user sees an explanation instead of a blank panel.

## Gotchas

- Filter state survives track switches. A user who toggles pinned-only on Track A and switches to Track B sees Track B already filtered. This is intentional but not obvious from the toolbar.
- `Intl.Collator` is locale-sensitive. Sort order of accented or non-Latin filenames depends on the host's default locale. No locale is forced.
