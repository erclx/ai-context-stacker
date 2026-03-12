# Development

## Setup

```plaintext
npm install
```

Requires Node.js and VS Code. No other dependencies.

## Running locally

Open the repo in VS Code and press `F5`. This launches the Extension Development Host with the extension loaded. Changes to source require restarting the host; use `Ctrl+Shift+F5` to relaunch quickly.

For continuous compilation during development:

```plaintext
npm run watch
```

## Tests

```plaintext
npm run test
```

Tests run inside a VS Code extension host via `@vscode/test-cli`. The suite lives in `src/test/suite/`. Each file tests a single service or utility in isolation using sinon stubs for VS Code APIs. `extension.test.ts` is the only smoke test that exercises the full activation path.

To compile tests without running them:

```plaintext
npm run compile-tests
```

## Commits

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org) spec, enforced by commitlint. The format is:

```plaintext
type(scope): description

feat(stack): add optimistic patch on file removal
fix(hydration): prune dead URIs before tree render
chore(build): update esbuild to 0.27
```

Common types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.

## Release

Two scripts handle releasing:

- `npm run release` — runs `scripts/prepare-release.sh`, bumps the version and prepares the changelog
- `npm run publish` — runs `scripts/trigger-release.sh`, triggers the publish pipeline

Snapshots for testing pre-release builds:

```plaintext
npm run snapshot
```
