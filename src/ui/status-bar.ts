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

    this.item.command = 'aiContextStacker.switchTrack' // improved: clicking now opens the switcher
    this.item.tooltip = 'Click to Switch Track'

    const changeListener = provider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item, changeListener)
    context.subscriptions.push(this.item)

    this.update()
  }

  /**
   * Updates the status bar text with the current track and token count.
   */
  private update() {
    const files = this.provider.getFiles()

    // Hide if empty, matching existing behavior
    if (files.length === 0) {
      this.item.hide()
      return
    }

    const totalTokens = this.provider.getTotalTokens()
    const formattedTokens = this.provider.formatTokenCount(totalTokens)
    const trackName = this.provider.getActiveTrackName()

    // Displays: $(layers) [TrackName] ~ 4.5k Tokens
    this.item.text = `$(layers) ${trackName} ${formattedTokens} Tokens`

    // Detailed tooltip
    this.item.tooltip = `Active Track: ${trackName}\n${files.length} Staged Files\nClick to Switch Track`

    this.item.show()
  }

  /**
   * Cleans up resources.
   */
  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
