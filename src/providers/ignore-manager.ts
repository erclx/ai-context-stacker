import { TextDecoder } from 'util'
import * as vscode from 'vscode'

import { IgnoreParser } from '../services'
import { Logger } from '../utils'

export class IgnoreManager implements vscode.Disposable {
  private _cachedPatterns: string | undefined
  private _disposables: vscode.Disposable[] = []

  constructor() {
    this.initSafeWatchers()
  }

  public async getExcludePatterns(): Promise<string> {
    if (this._cachedPatterns) {
      return this._cachedPatterns
    }

    await this.refreshPatterns()
    return this._cachedPatterns ?? IgnoreParser.DEFAULT_EXCLUDES
  }

  public dispose(): void {
    this._disposables.forEach((d) => d.dispose())
    this._disposables = []
  }

  private async refreshPatterns(): Promise<void> {
    try {
      const [gitIgnoreContent, userSettings] = await Promise.all([
        this.readGitIgnoreContent(),
        Promise.resolve(this.getUserSettings()),
      ])

      this._cachedPatterns = IgnoreParser.generatePatternString(gitIgnoreContent, userSettings)
    } catch (error) {
      Logger.error('IgnoreManager: Failed to generate patterns', error as Error)
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
      return ''
    }
  }

  private getUserSettings(): string[] {
    const config = vscode.workspace.getConfiguration('aiContextStacker')
    return config.get<string[]>('excludes', [])
  }

  private initSafeWatchers(): void {
    this.watchConfigurationChanges()
    this.watchFileLifecycleEvents()
    this.watchDocumentSaves()
  }

  private watchConfigurationChanges(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aiContextStacker.excludes')) {
        this.invalidateCache()
      }
    })
    this._disposables.push(disposable)
  }

  private watchFileLifecycleEvents(): void {
    const onCreate = vscode.workspace.onDidCreateFiles((e) => this.handleFileEvent(e.files))
    const onDelete = vscode.workspace.onDidDeleteFiles((e) => this.handleFileEvent(e.files))

    this._disposables.push(onCreate, onDelete)
  }

  private watchDocumentSaves(): void {
    const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.gitignore')) {
        this.invalidateCache()
      }
    })
    this._disposables.push(onSave)
  }

  private handleFileEvent(files: readonly vscode.Uri[]): void {
    const affectsGitIgnore = files.some((uri) => uri.path.endsWith('.gitignore'))
    if (affectsGitIgnore) {
      this.invalidateCache()
    }
  }

  private invalidateCache(): void {
    this._cachedPatterns = undefined
  }
}
