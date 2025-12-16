import * as vscode from 'vscode'

import { Logger } from '../utils'

// Default patterns that should always be excluded, even without a .gitignore file.
// This prevents common noise and huge dependency folders from being accidentally added.
const FALLBACK_EXCLUDE_PATTERNS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/build/**',
  '**/dist/**',
  '**/out/**',
  '**/.vscode/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/*.log',
  '**/.DS_Store',
]

/**
 * Service responsible for determining file exclusion patterns for workspace searches.
 * It primarily reads the `.gitignore` file, merges it with hardcoded defaults,
 * and handles caching and file system watching for changes.
 */
export class IgnorePatternProvider implements vscode.Disposable {
  private _cachedPatterns: string | undefined
  private _watcher: vscode.FileSystemWatcher | undefined

  // Pre-calculate defaults once to be used as a fallback. Format is needed for glob syntax.
  private readonly DEFAULT_EXCLUDES: string = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  constructor() {
    this.initWatcher()
  }

  // KEPT PUBLIC: Preserving original API contract. Readability could suggest moving
  // this out, but it keeps I/O logic contained for this specific provider.
  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri)
  }

  /**
   * Gets the combined file exclusion pattern string for use with `vscode.workspace.findFiles`.
   * The result is cached for performance and invalidated upon `.gitignore` changes.
   *
   * @returns A promise resolving to a glob pattern string (e.g., `{pattern1,pattern2}`).
   */
  public async getExcludePatterns(): Promise<string> {
    if (this._cachedPatterns) {
      Logger.info('Ignore patterns cache hit.')
      return this._cachedPatterns
    }

    Logger.info('Ignore patterns cache miss. Generating patterns from disk...')
    this._cachedPatterns = await this.readGitIgnore()
    return this._cachedPatterns
  }

  /**
   * Refactored: Orchestrates I/O operations only.
   * Locates, reads, and converts the `.gitignore` file content.
   *
   * @returns A promise resolving to the final glob exclusion pattern string.
   */
  private async readGitIgnore(): Promise<string> {
    try {
      // Search for the .gitignore file only once at the workspace root
      const files = await vscode.workspace.findFiles('.gitignore', null, 1)

      if (files.length === 0) {
        Logger.info('.gitignore not found. Using fallback excludes.')
        return this.DEFAULT_EXCLUDES
      }

      const uri = files[0]
      const uint8Array = await this.readFile(uri)
      const content = Buffer.from(uint8Array).toString('utf-8')

      // Delegate pure string manipulation to a dedicated helper
      const finalPatterns = this.generatePatternString(content)

      Logger.info('.gitignore parsed; exclusion patterns generated.')
      return finalPatterns
    } catch (error) {
      Logger.error('Error reading/parsing .gitignore. Reverting to fallback excludes.', error)
      return this.DEFAULT_EXCLUDES
    }
  }

  /**
   * Pure Logic: Parses .gitignore content and merges it with defaults.
   * Isolated for testability and readability.
   *
   * @param content The raw string content of the .gitignore file.
   * @returns The final glob pattern string for `findFiles`.
   */
  private generatePatternString(content: string): string {
    const userPatterns = content
      .split('\n')
      .map((line) => line.trim())
      // Filter out comments (#) and negations (!) as VS Code glob doesn't support them the same way
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => {
        // VS Code's findFiles uses full glob paths, so we prepend `**/` and remove leading/trailing slashes
        const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
        return `**/${cleanLine}`
      })

    // Filter out defaults that are already covered by user patterns to avoid duplicates
    const defaultsToAdd = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !userPatterns.includes(p))
    const combinedPatterns = [...userPatterns, ...defaultsToAdd]

    // Wrap the patterns in `{}` for the required glob syntax
    return `{${combinedPatterns.join(',')}}`
  }

  /**
   * Sets up a file system watcher to detect changes to the `.gitignore` file
   * and invalidate the cached patterns, forcing a re-read on the next request.
   */
  private initWatcher() {
    // Watch for the `.gitignore` file anywhere in the workspace
    this._watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore')

    const invalidate = () => {
      Logger.info('Ignore patterns cache invalidated (due to .gitignore change).')
      this._cachedPatterns = undefined
    }

    this._watcher.onDidCreate(invalidate)
    this._watcher.onDidChange(invalidate)
    this._watcher.onDidDelete(invalidate)
  }

  /**
   * Cleans up the FileSystemWatcher resource.
   */
  public dispose() {
    this._watcher?.dispose()
    Logger.info('IgnorePatternProvider disposed: FileSystemWatcher cleaned up.')
  }
}
