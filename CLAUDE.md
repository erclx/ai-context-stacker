# Project

VS Code extension for staging files into named tracks and copying combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Before making changes

- Check `.claude/tasks/` for current scope and status
- Check `.claude/ARCHITECTURE.md` for decisions already made
- Check `.claude/wireframes/` for intended UI layout and behavior
- Check `.claude/DESIGN.md` for tokens, typography, spacing, and component rules
- Check `.claude/REQUIREMENTS.md` for feature scope and non-goals
- Check `.claude/rules/` for coding standards before writing or editing any code

## Rules

- When editing any doc, read surrounding content first and match its depth, length, and tone
- After implementing changes, run `npm run format && npm run lint && npm run test`

## Context

The project uses a three-tier context model. Know which tier holds what before reading or writing:

- Always loaded: root `CLAUDE.md`, `.claude/REQUIREMENTS.md`, `.claude/ARCHITECTURE.md`, and `.claude/context/index.md`. Project-wide invariants, product scope, and the discovery anchor for domain context.
- Path-scoped lazy: `.claude/rules/*.md` with `paths:` frontmatter. Coding standards that load only when files matching the glob are touched. Always-on rules apply every session.
- On-demand lookup: `.claude/context/<domain>.md` entries. Per-domain narrative (how a domain is structured, decisions made, gotchas). Use the always-loaded `.claude/context/index.md` to pick which entries to read. Entries are populated by `claude-docs` at ship time.

@.claude/context/index.md

## Key paths

- `commands/`: thin handlers, one file per command
- `models/`: pure data shapes, no VS Code imports
- `providers/`: bridge between services and VS Code. `TrackManager` owns mutations, `StackProvider` owns the tree view
- `services/`: persistence, hydration, token analysis, tree building, file watching
- `ui/`: tree rendering, status bar, drag and drop, webview preview
- `utils/`: stateless helpers for clipboard, formatting, file scanning, token estimation
- `.claude/`: planning docs (requirements, architecture, wireframes, design, tasks)
- `.claude/review/`: gitignored scratch for review and UI-test output, overwritten on each run
