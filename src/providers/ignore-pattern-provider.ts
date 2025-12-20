import * as vscode from 'vscode'

import { IgnoreParser } from '../services'
import { Logger } from '../utils'

/**
 * Manages file exclusion patterns by reading .gitignore and merging with defaults.
 * Caches results and watches for .gitignore changes.
 */
export class IgnorePatternProvider implements vscode.Disposable {
  private _cachedPatterns: string | undefined
  private _watcher: vscode.FileSystemWatcher | undefined

  constructor() {
    this.initWatcher()
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
        return IgnoreParser.DEFAULT_EXCLUDES
      }

      const uri = files[0]
      const uint8Array = await vscode.workspace.fs.readFile(uri)
      const content = Buffer.from(uint8Array).toString('utf-8')

      const finalPatterns = IgnoreParser.generatePatternString(content)

      Logger.info('.gitignore parsed; exclusion patterns generated.')
      return finalPatterns
    } catch (error) {
      Logger.error('Error reading/parsing .gitignore. Reverting to fallback excludes.', error)
      return IgnoreParser.DEFAULT_EXCLUDES
    }
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
