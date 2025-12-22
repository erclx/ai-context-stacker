import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ContentFormatter, Logger } from '../utils'
import { WebviewFactory } from './webview-factory'

interface IWebviewMessage {
  command: string
  text: string
}

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
    private readonly _provider: StackProvider,
  ) {
    this._panel = panel

    // Apply custom branding to the webview tab
    const iconUri = vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png')
    this._panel.iconPath = iconUri

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._provider.onDidChangeTreeData(() => this.update(), null, this._disposables)
    this._panel.webview.onDidReceiveMessage((msg: IWebviewMessage) => this.handleMessage(msg), null, this._disposables)

    this.update()
  }

  public static createOrShow(extensionUri: vscode.Uri, provider: StackProvider): void {
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
  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, provider: StackProvider): void {
    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  public dispose(): void {
    PreviewWebview.currentPanel = undefined
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  private async update(): Promise<void> {
    try {
      const files = this._provider.getFiles()
      const content = await ContentFormatter.format(files)
      const html = await WebviewFactory.generateHtml(this._panel.webview, this._extensionUri, content)

      this._panel.webview.html = html
    } catch (error) {
      Logger.error('Failed to update preview webview', error)
    }
  }

  private handleMessage(message: IWebviewMessage): void {
    if (message.command !== 'copy') {
      return
    }

    vscode.env.clipboard.writeText(message.text)
    vscode.window.showInformationMessage('Context copied to clipboard!')
  }
}

/**
 * Handles webview deserialization after VS Code restart.
 */
export class PreviewWebviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: StackProvider,
  ) {}

  public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: unknown): Promise<void> {
    // Reset options to ensure security settings (localResourceRoots) are applied
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    }

    PreviewWebview.revive(webviewPanel, this._extensionUri, this._provider)
  }
}
