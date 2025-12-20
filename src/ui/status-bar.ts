import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

/**
 * Manages the Status Bar Item.
 * Primary Action: Copy All to Clipboard.
 */
export class StackerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem
  private provider: ContextStackProvider
  private _disposables: vscode.Disposable[] = []

  constructor(extensionContext: vscode.ExtensionContext, contextStackProvider: ContextStackProvider) {
    this.provider = contextStackProvider

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy Stack to Clipboard'

    const changeListener = contextStackProvider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item, changeListener)
    extensionContext.subscriptions.push(this.item)

    this.update()
  }

  /**
   * Updates the status bar text with the current track and token count.
   *
   * Update triggers:
   * - File added/removed from stack
   * - Track switched
   * - Token count recalculated (debounced edits or save)
   *
   * Icon state logic:
   * - Hidden when stack is empty (no visual clutter)
   * - Shows copy icon when stack has content (indicates primary action)
   */
  private update() {
    const files = this.provider.getFiles()

    if (files.length === 0) {
      this.item.hide()
      return
    }

    const totalTokens = this.provider.getTotalTokens()
    const formattedTokens = this.provider.formatTokenCount(totalTokens)
    const trackName = this.provider.getActiveTrackName()

    this.item.text = `$(copy) ${trackName} (${formattedTokens})`

    this.item.tooltip = new vscode.MarkdownString(
      `**Active Track:** ${trackName}\n\n` +
        `**Files:** ${files.length} staged\n` +
        `**Tokens:** ${formattedTokens}\n\n` +
        `$(copy) Click to Copy All\n` +
        `$(list-flat) Use View Title icons to Switch Track`,
    )
    this.item.tooltip.isTrusted = true

    this.item.show()
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
