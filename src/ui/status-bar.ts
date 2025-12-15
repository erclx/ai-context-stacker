import * as vscode from 'vscode'

import { ContextStackProvider } from '@/providers'

export class StackerStatusBar {
  private item: vscode.StatusBarItem
  private provider: ContextStackProvider
  private _disposables: vscode.Disposable[] = []

  constructor(context: vscode.ExtensionContext, provider: ContextStackProvider) {
    this.provider = provider

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)

    this.item.command = 'aiContextStacker.copyAll'
    this.item.tooltip = 'Click to Copy All Staged Files to Clipboard'

    const changeListener = provider.onDidChangeTreeData(() => this.update())

    this._disposables.push(this.item)
    this._disposables.push(changeListener)
    context.subscriptions.push(this.item)

    this.update()
  }

  private update() {
    const files = this.provider.getFiles()
    const count = files.length

    if (count === 0) {
      this.item.hide()
    } else {
      this.item.text = `$(layers) ${count} Staged`
      this.item.show()
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
