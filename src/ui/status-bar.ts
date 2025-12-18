import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

/**
 * Manages the Status Bar Item displaying the aggregate token count.
 */
export class StackerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem
  private provider: ContextStackProvider
  private _disposables: vscode.Disposable[] = []

  constructor(context: vscode.ExtensionContext, provider: ContextStackProvider) {
    this.provider = provider

    // Priority 100 ensures it stays near the right side
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy All Staged Files to Clipboard'

    const changeListener = provider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item, changeListener)
    context.subscriptions.push(this.item)

    this.update()
  }

  /**
   * Updates the status bar text with the total token count.
   */
  private update() {
    const files = this.provider.getFiles()

    if (files.length === 0) {
      this.item.hide()
      return
    }

    const totalTokens = this.provider.getTotalTokens()
    const formattedTokens = this.provider.formatTokenCount(totalTokens)

    // Displays: $(database) ~4.5k Tokens
    this.item.text = `$(database) ${formattedTokens} Tokens`
    this.item.show()
  }

  /**
   * Cleans up resources.
   */
  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
