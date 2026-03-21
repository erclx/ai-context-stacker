# Project

VS Code extension for staging files into named tracks and copying combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Key paths

- `commands/`: thin handlers, one file per command
- `models/`: pure data shapes, no VS Code imports
- `providers/`: bridge between services and VS Code; `TrackManager` owns mutations, `StackProvider` owns the tree view
- `services/`: persistence, hydration, token analysis, tree building, file watching
- `ui/`: tree rendering, status bar, drag and drop, webview preview
- `utils/`: stateless helpers for clipboard, formatting, file scanning, token estimation

## Behavior

- For any command that produces a FINAL COMMAND block, always show PREVIEW first. Never run a command without it.
- If the user responds with a short affirmation or clearly signals intent to proceed, execute the FINAL COMMAND immediately without re-explaining or re-previewing.

## Spelling

- Add unknown words to the appropriate dictionary defined in `cspell.json`
- Keep dictionary files sorted alphabetically
