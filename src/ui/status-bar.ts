import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'

/**
 * Manages the custom Status Bar Item that displays the count of staged files
 * and serves as a shortcut for the 'Copy All' command.
 */
export class StackerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem
  private provider: ContextStackProvider
  private _disposables: vscode.Disposable[] = []

  constructor(context: vscode.ExtensionContext, provider: ContextStackProvider) {
    this.provider = provider

    // Position the item on the right with a priority of 100
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy All Staged Files to Clipboard'

    // Subscribe to changes in the data provider to update the status bar count
    const changeListener = provider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item)
    this._disposables.push(changeListener)
    // The item must also be pushed to the extension context for VS Code to manage its lifecycle
    context.subscriptions.push(this.item)

    this.update()
  }

  /**
   * Updates the text and visibility of the status bar item based on the stack count.
   */
  private update() {
    const files = this.provider.getFiles()
    const count = files.length

    if (count === 0) {
      this.item.hide()
    } else {
      // Use VS Code's built-in icon for a better visual representation
      this.item.text = `$(layers) ${count} Staged`
      this.item.show()
    }
  }

  /**
   * Cleans up all disposable resources owned by the status bar.
   */
  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
