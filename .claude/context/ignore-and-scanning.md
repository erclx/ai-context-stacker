---
title: Ignore and scanning
description: Exclude pattern merging, gitignore parsing, and folder-scan batching
---

# Ignore and scanning

How `IgnoreManager` merges exclude patterns from multiple sources, how `.gitignore` patterns convert to VS Code globs, and how folder scans batch to keep the event loop responsive.

## Layer responsibilities

- `src/services/ignore-manager.ts` merges sources and exposes the combined glob string
- `src/services/ignore-parser.ts` converts `.gitignore` syntax to VS Code glob syntax
- `src/commands/copy-file.ts` and `src/services/folder-scanner.ts` consume the glob via `vscode.workspace.findFiles()`

## Decisions

- Three sources merge into one glob: `.gitignore` (parsed), user setting `aiContextStacker.excludes`, and fallback patterns from `src/constants.ts`. The merged form is a single `{a,b,c}` brace expression passed to `findFiles()`.
- `convertToGlob()` normalizes `.gitignore` patterns: strip leading `/`, strip trailing `/`, prefix non-`**/` patterns with `**/` so they match at any depth. This matches the user's intuition that `node_modules` in `.gitignore` excludes every `node_modules` folder, not just root-level.
- Folder scans batch in groups of five with a yield to the event loop between batches. This keeps the UI responsive on large folders without paying per-file scheduling overhead.

## Hidden contracts

- Negation (`!pattern`) is dropped during parsing, not honored. A `.gitignore` that whitelists a file inside an excluded folder will still exclude it.
- Comments (`#`) are dropped during parsing. Inline `#` mid-pattern is treated as part of the pattern, which is consistent with `.gitignore` semantics.
- The exclusion cache invalidates on three events only: `.gitignore` save, workspace config change, and file create or delete touching `.gitignore`. Other changes (a new file appearing in `node_modules` after the user adds the pattern) do not invalidate the cache.

## Gotchas

- The glob is a single brace expression. VS Code's `findFiles()` has a length limit that is not documented but is around 1000 patterns in practice. A pathological `.gitignore` with thousands of entries can silently truncate. The codebase has no current guard for this.
- Folder scans use `vscode.RelativePattern`. Drives or workspace folders other than the active one are not scanned, even if the file picker selected a path inside them.
