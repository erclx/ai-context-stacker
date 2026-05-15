# Diagrams

Two diagrams covering Stackr's layered architecture and the event-driven flow when a user adds a file. Drawn from `.claude/ARCHITECTURE.md`, `.claude/REQUIREMENTS.md`, and the per-domain entries under `.claude/context/`.

## How the layers fit together

Layered components with the dependency direction `models → services → providers → commands + ui`. Each layer only depends on layers above it.

```mermaid
flowchart TB
    subgraph Models["Models"]
        Mdl["TrackedFile, Track,<br/>StackTreeItem"]
    end

    subgraph Services["Services"]
        TM["TrackManager"]
        PS["PersistenceService"]
        AE["AnalysisEngine"]
        TB["TreeBuilder"]
        IM["IgnoreManager"]
    end

    subgraph Providers["Providers"]
        SP["StackProvider"]
        TP["TrackProvider"]
    end

    subgraph Entry["Commands + UI"]
        CMD["Command handlers"]
        REN["StackItemRenderer"]
        SB["StackerStatusBar"]
        WV["WebviewFactory"]
    end

    Mdl --> TM
    Mdl --> SP
    TM --> PS
    SP --> TM
    SP --> AE
    SP --> TB
    SP --> IM
    TP --> TM
    CMD --> SP
    CMD --> TP
    REN --> SP
    SB --> SP
    WV --> SP
```

`TrackManager` is the single mutation owner. Every state change funnels through it, which is what makes the optimistic-patch decision in `StackProvider` safe. `PersistenceService` is the only service that touches `workspaceState`. Detail on each service lives in its matching `.claude/context/<domain>.md` entry.

## What happens when a user adds a file

The non-obvious part of this flow is the split between optimistic UI patching and background token analysis. The tree updates twice: once immediately with placeholder stats, once again per file as analysis completes.

```mermaid
sequenceDiagram
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

The `requestSave` call returns immediately. The actual write happens on the 500ms debounce edge, gated by a fingerprint hash so identical state never writes twice. See `.claude/context/persistence.md` for the fingerprint rules and `.claude/context/stats-and-analysis.md` for the cancellation contract on `enrichFiles`.
