---
title: Development
description: Local setup, dev loop, test commands, and release workflow
---

# Development

## Overview

How to set up, run, test, and release the extension locally. Doesn't cover the CI workflow itself, which lives in [[ci]].

## Layout

- `src/test/suite/` owns the test suite
- `scripts/` owns the release and snapshot automation

## Setup

```plaintext
npm install
```

Requires Node.js and VS Code. No other dependencies.

## Running locally

Open the repo in VS Code and press `F5`. This launches the Extension Development Host with the extension loaded. Changes to source require restarting the host. Use `Ctrl+Shift+F5` to relaunch the host.

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

## Release

`npm run release` runs `scripts/release.sh`. It prompts for a bump type, creates a release branch, updates `package.json` and `CHANGELOG.md`, opens a PR, polls until the PR merges, then pushes the version tag that triggers CI to publish.

Snapshots for testing pre-release builds:

```plaintext
npm run snapshot
```
