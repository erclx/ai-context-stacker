import * as vscode from 'vscode'

import { StackProvider } from '../providers'

export class StackerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem
  private provider: StackProvider
  private _disposables: vscode.Disposable[] = []

  private _throttleTimer: NodeJS.Timeout | undefined
  private readonly UPDATE_THROTTLE_MS = 500

  constructor(extensionContext: vscode.ExtensionContext, contextStackProvider: StackProvider) {
    this.provider = contextStackProvider

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy Stack to Clipboard'

    const treeListener = contextStackProvider.onDidChangeTreeData(() => this.scheduleUpdate())
    const analysisListener = contextStackProvider.analysisEngine.onDidStatusChange(() => this.scheduleUpdate())

    this._disposables.push(this.item, treeListener, analysisListener)
    extensionContext.subscriptions.push(this.item)

    this.update()
  }

  private scheduleUpdate(): void {
    if (this._throttleTimer) return

    this._throttleTimer = setTimeout(() => {
      this._throttleTimer = undefined
      this.update()
    }, this.UPDATE_THROTTLE_MS)
  }

  private update() {
    const files = this.provider.getFiles()

    if (files.length === 0) {
      this.item.hide()
      return
    }

    const totalTokens = this.provider.getTotalTokens()
    const formattedTokens = this.provider.formatTokenCount(totalTokens)
    const trackName = this.provider.getActiveTrackName()
    const isAnalyzing = this.provider.analysisEngine.isAnalyzing

    if (isAnalyzing) {
      this.item.text = `$(sync~spin) Analyzing... ${trackName} (${formattedTokens})`
    } else {
      this.item.text = `$(layers) ${trackName} (${formattedTokens})`
    }

    this.item.tooltip = new vscode.MarkdownString(
      `**Active Track:** ${trackName}\n\n` +
        `**Status:** ${isAnalyzing ? 'Analyzing...' : 'Ready'}\n` +
        `**Files:** ${files.length} staged\n` +
        `**Tokens:** ${formattedTokens}\n\n` +
        `$(copy) Click to Copy All\n` +
        `$(layers) Use View Title icons to Switch Track`,
    )
    this.item.tooltip.supportThemeIcons = true
    this.item.tooltip.isTrusted = true

    this.item.show()
  }

  public dispose() {
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer)
      this._throttleTimer = undefined
    }
    this._disposables.forEach((d) => d.dispose())
  }
}
