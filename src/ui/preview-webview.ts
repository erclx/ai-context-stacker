import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger } from '../utils'
import { WebviewFactory } from './webview-factory'

/**
 * Manages the preview webview panel showing formatted AI context.
 * Singleton pattern ensures only one preview exists at a time.
 */
export class PreviewWebview {
  public static currentPanel: PreviewWebview | undefined
  public static readonly viewType = 'aiContextStacker.preview'

  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: ContextStackProvider,
  ) {
    this._panel = panel

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Live updates when stack changes
    this._provider.onDidChangeTreeData(() => this.update(), null, this._disposables)

    this._panel.webview.onDidReceiveMessage((message) => this.handleMessage(message), null, this._disposables)

    this.update()
  }

  public static createOrShow(extensionUri: vscode.Uri, provider: ContextStackProvider) {
    if (PreviewWebview.currentPanel) {
      PreviewWebview.currentPanel._panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    const panel = WebviewFactory.create(PreviewWebview.viewType, 'AI Context Preview', extensionUri)

    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  /**
   * Revives webview after VS Code restart.
   * Called by VS Code serialization framework.
   */
  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, provider: ContextStackProvider) {
    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  public dispose() {
    PreviewWebview.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) x.dispose()
    }
  }

  private async update() {
    try {
      const files = this._provider.getFiles()
      const content = await ContentFormatter.format(files)

      this._panel.webview.html = await WebviewFactory.generateHtml(this._panel.webview, this._extensionUri, content)
    } catch (error) {
      Logger.error('Failed to update preview webview', error)
    }
  }

  private handleMessage(message: any) {
    switch (message.command) {
      case 'copy':
        vscode.env.clipboard.writeText(message.text)
        vscode.window.showInformationMessage('Context copied to clipboard!')
        return
    }
  }
}

/**
 * Handles webview deserialization after VS Code restart.
 */
export class PreviewWebviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: ContextStackProvider,
  ) {}

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
    // Reset options to ensure security settings (localResourceRoots) are applied
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    }

    PreviewWebview.revive(webviewPanel, this._extensionUri, this._provider)
  }
}
