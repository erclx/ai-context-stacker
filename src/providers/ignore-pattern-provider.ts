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

export class IgnorePatternProvider {
  private _cachedPatterns: string | undefined
  private _watcher: vscode.FileSystemWatcher | undefined

  // Pre-calculate defaults once
  private readonly DEFAULT_EXCLUDES: string = `{${FALLBACK_EXCLUDE_PATTERNS.join(',')}}`

  constructor() {
    this.initWatcher()
  }

  // KEPT PUBLIC: Preserving original API contract
  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri)
  }

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
   * Logic is delegated to `generatePatternString`.
   */
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
   * Pure Logic: parses content and merges with defaults.
   * Isolated for testability and readability.
   */
  private generatePatternString(content: string): string {
    const userPatterns = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
      .map((line) => {
        const cleanLine = line.replace(/^\//, '').replace(/\/$/, '')
        return `**/${cleanLine}`
      })

    // Filter out defaults that are already covered by user patterns to avoid duplicates
    const defaultsToAdd = FALLBACK_EXCLUDE_PATTERNS.filter((p) => !userPatterns.includes(p))
    const combinedPatterns = [...userPatterns, ...defaultsToAdd]

    return `{${combinedPatterns.join(',')}}`
  }

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
