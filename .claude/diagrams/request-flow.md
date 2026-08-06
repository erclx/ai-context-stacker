---
title: Request flow
description: What happens between the command handler and the tree view when a user adds a file, and where the two updates split
category: Request flow
verified: 'TODO: never verified'
---

# Request flow

```mermaid
sequenceDiagram
    accTitle: What happens when a user adds a file
    accDescr: A command handler calls the provider, which mutates through the track manager and patches the tree immediately, then a background analysis pass patches token counts in a second update.

    actor User
    participant CMD as Command handler
    participant SP as StackProvider
    participant TM as TrackManager
    participant PS as PersistenceService
    participant AE as AnalysisEngine
    participant TV as VS Code TreeView

    User->>CMD: Add file
    CMD->>SP: addFile uri
    SP->>TM: addFile trackId, uri
    TM->>TM: mutate state
    TM->>PS: requestSave debounced 500ms
    TM-->>SP: onDidChangeTracks
    SP->>SP: optimistic patch cache
    SP-->>TV: onDidChangeTreeData
    TV->>SP: getTreeItem
    SP-->>TV: placeholder stats item
    SP->>AE: enrichFiles cancel previous
    AE-->>AE: background analysis
    AE-->>SP: onDidUpdateStats per file
    SP->>SP: patch stats into cache
    SP-->>TV: onDidChangeTreeData
    TV-->>User: tree updates with token counts
```

The diagram shows one add moving from a command handler to the tree view. The non-obvious part is the split between optimistic UI patching and background token analysis. The tree updates twice: once immediately with placeholder stats, then once again per file as analysis completes.

This shape was chosen so the tree never blocks on token counting, which is the slow step. The alternative, holding the first render until analysis finished, would have made every add feel as slow as the largest file in it. The `requestSave` call returns immediately, and the actual write happens on the 500ms debounce edge, gated by a fingerprint hash so identical state never writes twice. Open `src/providers/stack-provider.ts` for the patch decision and `src/services/persistence-service.ts` for the debounce and fingerprint. See `.claude/context/persistence.md` for the fingerprint rules and `.claude/context/stats-and-analysis.md` for the cancellation contract on `enrichFiles`.
