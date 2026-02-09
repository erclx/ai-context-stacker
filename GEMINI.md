## AI Context Stacker

AI Context Stacker is a Visual Studio Code extension designed to prepare code context for LLMs like ChatGPT, Claude, and Gemini. The tool collects and formats multiple files and directory structures into a single output for prompt insertion. This project uses TypeScript and Node.js, with `esbuild` for bundling.

## Folder Structure

The project organizes logic into specific directories under `src/`:

- `commands/`: Handles actions like adding files or copying context.
- `models/`: Defines data structures for files and tracks.
- `providers/`: Manages file collections and exclusion patterns.
- `services/`: Contains core logic for tree building, persistence, and token counting.
- `ui/`: Manages webviews, status bars, and drag-and-drop features.
- `utils/`: Includes helpers for clipboard tasks and file scanning.

## Build and Run

The development lifecycle relies on `npm`. Run these commands to get started:

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Compile Development Build**
   ```bash
   npm run compile
   ```
3. **Package for Production**
   ```bash
   npm run package
   ```
4. **Watch for Changes**
   ```bash
   npm run watch
   ```
5. **Run Tests**
   ```bash
   npm test
   ```

## Development Standards

- **Language**: All source code uses strict TypeScript.
- **Commits**: Compliance with the Conventional Commits spec is required. Use lowercase for all subjects.
- **Formatting**: Prettier and ESLint maintain code cleanliness.
- **Automation**: Husky executes spell checks and formatting on every commit to ensure quality.
- **Reliability**: The `src/test/suite` includes specific tests for persistence, hydration, and tree building.
