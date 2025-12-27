import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { IgnoreParser } from '../services'
import { Logger } from '../utils'

export class IgnoreManager implements vscode.Disposable {
  private _cachedPatterns: string | undefined
  private _fsWatcher: vscode.FileSystemWatcher | undefined
  private _configListener: vscode.Disposable | undefined

  constructor() {
    this.initWatchers()
  }

  public async getExcludePatterns(): Promise<string> {
    if (this._cachedPatterns) {
      Logger.info('Ignore patterns cache hit.')
      return this._cachedPatterns
    }

    Logger.info('Ignore patterns cache miss. Regenerating...')
    await this.refreshPatterns()
    return this._cachedPatterns ?? IgnoreParser.DEFAULT_EXCLUDES
  }

  public dispose(): void {
    this._fsWatcher?.dispose()
    this._configListener?.dispose()
    Logger.info('IgnoreManager disposed.')
  }

  private async refreshPatterns(): Promise<void> {
    try {
      const gitIgnoreContent = await this.readGitIgnoreContent()
      const userSettings = this.getUserSettings()

      this._cachedPatterns = IgnoreParser.generatePatternString(gitIgnoreContent, userSettings)
      Logger.info('Exclusion patterns generated successfully.')
    } catch (error) {
      Logger.error('Error generating patterns. Reverting to defaults.', error)
      this._cachedPatterns = IgnoreParser.DEFAULT_EXCLUDES
    }
  }

  private async readGitIgnoreContent(): Promise<string> {
    try {
      const files = await vscode.workspace.findFiles('.gitignore', null, 1)
      if (!files || files.length === 0) {
        return ''
      }

      const uint8Array = await vscode.workspace.fs.readFile(files[0])
      return new TextDecoder('utf-8').decode(uint8Array)
    } catch (error) {
      Logger.error('Failed to read .gitignore file', error)
      return ''
    }
  }

  private getUserSettings(): string[] {
    const config = vscode.workspace.getConfiguration('aiContextStacker')
    return config.get<string[]>('excludes', [])
  }

  private initWatchers(): void {
    this._fsWatcher = vscode.workspace.createFileSystemWatcher('**/.gitignore')
    const invalidate = () => (this._cachedPatterns = undefined)

    this._fsWatcher.onDidCreate(invalidate)
    this._fsWatcher.onDidChange(invalidate)
    this._fsWatcher.onDidDelete(invalidate)

    this._configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aiContextStacker.excludes')) {
        Logger.info('User settings changed. Invalidating cache.')
        this._cachedPatterns = undefined
      }
    })
  }
}
