---
title: Components
description: The layered structure inside the boundary and the direction dependencies run, drawn from .claude/ARCHITECTURE.md
category: Components
verified: 'TODO: never verified'
---

# Components

```mermaid
flowchart TB
    accTitle: How Stackr's layers fit together
    accDescr: Four stacked layers, models at the top feeding services, services feeding providers, and providers feeding the command and UI entry points at the bottom.

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

The diagram shows the dependency direction `models → services → providers → commands + ui`. Each layer depends only on the layers above it, so a change to a command handler cannot reach into a model without passing through a provider first.

`TrackManager` is the single mutation owner. Every state change funnels through it, which is what makes the optimistic-patch decision in `StackProvider` safe: the provider can trust that no other writer moved the state underneath its cache. `PersistenceService` is the only service that touches `workspaceState`, so storage concerns never leak upward. Open `src/providers/track-manager.ts` for the mutation surface and `src/services/persistence-service.ts` for the write path. Detail on each service lives in its matching `.claude/context/<domain>.md` entry.
