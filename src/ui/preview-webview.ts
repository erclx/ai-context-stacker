import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ClipboardOps, ContentFormatter, Logger } from '../utils'
import { WebviewFactory } from './webview-factory'

interface IWebviewMessage {
  command: string
  text: string
}

/**
 * Manages the preview webview panel showing formatted AI context.
 */
export class PreviewWebview {
  public static currentPanel: PreviewWebview | undefined
  public static readonly viewType = 'aiContextStacker.preview'

  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []
  private _updateTimeout: NodeJS.Timeout | undefined
  private readonly DEBOUNCE_MS = 250

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: StackProvider,
  ) {
    this._panel = panel
    this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png')
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    this.registerListeners()
    this.scheduleUpdate()
  }

  public static createOrShow(extensionUri: vscode.Uri, provider: StackProvider): void {
    if (provider.getFiles().length === 0) {
      void vscode.window.showWarningMessage('No files in stack to preview.')
      return
    }

    if (PreviewWebview.currentPanel) {
      PreviewWebview.currentPanel._panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    // Factory handles the initial options (enableScripts: true)
    const panel = WebviewFactory.create(PreviewWebview.viewType, 'AI Context Preview', extensionUri)
    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, provider: StackProvider): void {
    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  public dispose(): void {
    PreviewWebview.currentPanel = undefined
    if (this._updateTimeout) clearTimeout(this._updateTimeout)
    this._panel.dispose()
    while (this._disposables.length) {
      this._disposables.pop()?.dispose()
    }
  }

  private registerListeners(): void {
    this._provider.onDidChangeTreeData(() => this.scheduleUpdate(), null, this._disposables)

    this._panel.webview.onDidReceiveMessage((msg: IWebviewMessage) => this.handleMessage(msg), null, this._disposables)

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('aiContextStacker')) this.scheduleUpdate()
      },
      null,
      this._disposables,
    )
  }

  private scheduleUpdate(): void {
    if (this._updateTimeout) clearTimeout(this._updateTimeout)
    this._updateTimeout = setTimeout(() => void this.update(), this.DEBOUNCE_MS)
  }

  private async update(): Promise<void> {
    if (!this._panel.visible) return

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
    if (message.command !== 'copy') return

    // Delegate to shared clipboard logic
    void ClipboardOps.copyText(message.text, 'Preview Content')
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
    // CRITICAL: Re-apply options during deserialization or scripts will be disabled
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    }

    PreviewWebview.revive(webviewPanel, this._extensionUri, this._provider)
  }
}
