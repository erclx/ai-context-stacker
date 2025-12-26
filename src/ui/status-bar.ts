import * as vscode from 'vscode'

import { StackProvider } from '../providers'

/**
 * Manages the Status Bar Item.
 * Primary Action: Copy All to Clipboard.
 */
export class StackerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem
  private provider: StackProvider
  private _disposables: vscode.Disposable[] = []

  constructor(extensionContext: vscode.ExtensionContext, contextStackProvider: StackProvider) {
    this.provider = contextStackProvider

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy Stack to Clipboard'

    const changeListener = contextStackProvider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item, changeListener)
    extensionContext.subscriptions.push(this.item)

    this.update()
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

    this.item.text = `$(layers) ${trackName} (${formattedTokens})`

    this.item.tooltip = new vscode.MarkdownString(
      `**Active Track:** ${trackName}\n\n` +
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
    this._disposables.forEach((d) => d.dispose())
  }
}
