# CI/CD

## Overview

One workflow file handles everything: `.github/workflows/publish.yml`. It runs on every pull request to `main`, every push to `main`, every `v*` tag push, and on manual dispatch. Concurrent runs for the same PR or ref cancel the in-progress run before starting a new one.

Two jobs run in sequence:

1. `test` — runs on every trigger
2. `publish` — runs only when a `v*` tag is pushed, and only after `test` passes

## Test job

Tests run in a matrix across Ubuntu, macOS, and Windows using Node 22. The VS Code test host requires a display on Linux, so the Linux step wraps `npm test` with `xvfb-run -a`. macOS and Windows run `npm test` directly.

## Publish job

Triggered only on `v*` tag pushes. Requires the `test` job to pass first.

Steps:

1. Package the extension with `npx @vscode/vsce package`, producing a `.vsix` file
2. Publish to the VS Code Marketplace using `VSCE_PAT`
3. Publish to Open VSX using `OVSX_TOKEN`
4. Create a GitHub release with auto-generated release notes and the `.vsix` file attached

Both `VSCE_PAT` and `OVSX_TOKEN` must be set as repository secrets. The workflow needs `contents: write` permission to create the GitHub release.

## Release scripts

### Release script

```plaintext
npm run release
```

`scripts/release.sh` handles the full release in one command:

1. Verifies you are on `main` with no uncommitted changes, then pulls
2. Prompts for bump type: `patch`, `minor`, or `major`
3. Creates a `release/vX.Y.Z` branch
4. Bumps `package.json` with `npm version --no-git-tag-version`
5. Inserts a dated `## [X.Y.Z]` section into `CHANGELOG.md` and updates the comparison links
6. Shows a diff and prompts before committing
7. Commits `package.json`, `package-lock.json`, and `CHANGELOG.md` and pushes the branch
8. Opens a PR via `gh pr create` and polls until it merges
9. Pulls `main`, creates the `vX.Y.Z` tag, and pushes it to GitHub
10. Deletes the local release branch

Pushing the tag triggers the `publish` job in CI.

## Snapshot script

```plaintext
npm run snapshot
```

`scripts/snapshot.sh` writes a file tree of the project to `.claude/.tmp/SNAPSHOT.md`, respecting `.gitignore` patterns. Used for sharing project structure as context.
