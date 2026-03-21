# Project

VS Code extension for staging files into named tracks and copying combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Before making changes

- Check `.claude/TASKS.md` for current scope and status
- Check `.claude/ARCHITECTURE.md` for decisions already made
- Check `.claude/WIREFRAMES.md` for intended UI layout and behavior
- Check `.claude/DESIGN.md` for tokens, typography, spacing, and component rules
- Check `.claude/REQUIREMENTS.md` for feature scope and non-goals
- Check `.claude/GOV.md` for coding standards before writing or editing any code

## Rules

- Before editing any doc, re-read `standards/prose.md` and the document's own preamble
- When editing any doc, read surrounding content first and match its depth, length, and tone
- After implementing changes, run `npm run format && npm run lint && npm run test`

## Key paths

- `commands/`: thin handlers, one file per command
- `models/`: pure data shapes, no VS Code imports
- `providers/`: bridge between services and VS Code; `TrackManager` owns mutations, `StackProvider` owns the tree view
- `services/`: persistence, hydration, token analysis, tree building, file watching
- `ui/`: tree rendering, status bar, drag and drop, webview preview
- `utils/`: stateless helpers for clipboard, formatting, file scanning, token estimation
- `.claude/`: planning docs (requirements, architecture, wireframes, design, tasks)

## Spelling

- Add unknown words to the appropriate dictionary defined in `cspell.json`
- Keep dictionary files sorted alphabetically

## Memory

- Write all memory files to `.claude/memory/`, not `~/.claude/projects/`
