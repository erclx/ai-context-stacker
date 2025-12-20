import * as vscode from 'vscode'

import { Logger } from '../utils'

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
 * Manages file exclusion patterns by reading .gitignore and merging with defaults.
 * Caches results and watches for .gitignore changes.
 */
export class IgnorePatternProvider implements vscode.Disposable {
  private _cachedPatterns: string | undefined
  private _watcher: vscode.FileSystemWatcher | undefined

  private readonly DEFAULT_EXCLUDES: string = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  constructor() {
    this.initWatcher()
  }

  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri)
  }

  /**
   * Returns combined exclusion patterns for vscode.workspace.findFiles.
   * Result is cached and invalidated on .gitignore changes.
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

  private async readGitIgnore(): Promise<string> {
    try {
      const files = await vscode.workspace.findFiles('.gitignore', null, 1)

      if (files.length === 0) {
        Logger.info('.gitignore not found. Using fallback excludes.')
        return this.DEFAULT_EXCLUDES
      }

      const uri = files[0]
      const uint8Array = await this.readFile(uri)
      const content = Buffer.from(uint8Array).toString('utf-8')

      const finalPatterns = this.generatePatternString(content)

      Logger.info('.gitignore parsed; exclusion patterns generated.')
      return finalPatterns
    } catch (error) {
      Logger.error('Error reading/parsing .gitignore. Reverting to fallback excludes.', error)
      return this.DEFAULT_EXCLUDES
    }
  }

  /**
   * Parses .gitignore content and merges with defaults.
   * Filters comments, negations, and converts to VS Code glob syntax.
   */
  private generatePatternString(content: string): string {
    const userPatterns = content
      .split('\n')
      .map((line) => line.trim())
      // VS Code glob doesn't support gitignore comments and negations
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => {
        // Convert to full glob paths with **/ prefix
        const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
        return `**/${cleanLine}`
      })

    // Avoid duplicates between user patterns and defaults
    const defaultsToAdd = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !userPatterns.includes(p))
    const combinedPatterns = [...userPatterns, ...defaultsToAdd]

    return `{${combinedPatterns.join(',')}}`
  }

  /**
   * Watches .gitignore for changes and invalidates cache.
   */
  private initWatcher() {
    this._watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore')

    const invalidate = () => {
      Logger.info('Ignore patterns cache invalidated (due to .gitignore change).')
      this._cachedPatterns = undefined
    }

    this._watcher.onDidCreate(invalidate)
    this._watcher.onDidChange(invalidate)
    this._watcher.onDidDelete(invalidate)
  }

  public dispose() {
    this._watcher?.dispose()
    Logger.info('IgnorePatternProvider disposed: FileSystemWatcher cleaned up.')
  }
}
