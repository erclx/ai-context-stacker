## Stackr

VS Code extension for staging files into named tracks and copying combined content to the clipboard for use with AI tools. State persists per workspace across sessions.

## Mental model

A track is a named group of files. The stack is whichever track is currently active. Staged files carry pin state, folder scan origin, and token count.

Dependencies flow in one direction: `models → services → providers → commands / ui`

- `commands/` — thin handlers, one file per command
- `models/` — pure data shapes, no VS Code imports
- `providers/` — bridge between services and VS Code; `TrackManager` owns mutations, `StackProvider` owns the tree view
- `services/` — core logic: persistence, hydration, token analysis, tree building, file watching
- `ui/` — tree rendering, status bar, drag and drop, webview preview; owns no state
- `utils/` — stateless helpers: clipboard, formatting, file scanning, token estimation
- `constants.ts` — shared constants: file size limits, exclude patterns, known extensions
- `extension.ts` — activation entry point, wires `ServiceRegistry` and registers commands

## Build and test

```plaintext
npm install       # install dependencies
npm run compile   # type check, lint, bundle
npm run watch     # parallel watch for esbuild and tsc
npm run test      # compile tests then run suite
```

Press `F5` in VS Code to launch the Extension Development Host.

## Standards

- Commits follow Conventional Commits: `type(scope): description`
- Common types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`
- Prose follows `standards/prose.md` — active voice, no buzzwords, no vague qualifiers
- Changelog entries follow `standards/changelog.md` — `component: fragment` format, no bold, no periods
