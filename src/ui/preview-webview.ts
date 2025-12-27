import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ClipboardOps, ContentFormatter, Logger } from '../utils'
import { WebviewFactory } from './webview-factory'

interface IWebviewMessage {
  command: string
  text: string
}

export class PreviewWebview {
  public static currentPanel: PreviewWebview | undefined
  public static readonly viewType = 'aiContextStacker.preview'
  private static readonly DEBOUNCE_MS = 250

  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []
  private _updateTimeout: NodeJS.Timeout | undefined

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

    const panel = WebviewFactory.create(PreviewWebview.viewType, 'AI Context Preview', extensionUri)
    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  public static revive(panel: vscode.WebviewPanel, extUri: vscode.Uri, provider: StackProvider): void {
    PreviewWebview.currentPanel = new PreviewWebview(panel, extUri, provider)
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

    this._panel.webview.onDidReceiveMessage((m: IWebviewMessage) => this.handleMsg(m), null, this._disposables)

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('aiContextStacker')) this.scheduleUpdate()
      },
      null,
      this._disposables,
    )

    this._panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          this.scheduleUpdate()
        }
      },
      null,
      this._disposables,
    )
  }

  private scheduleUpdate(): void {
    if (this._updateTimeout) clearTimeout(this._updateTimeout)
    this._updateTimeout = setTimeout(() => void this.update(), PreviewWebview.DEBOUNCE_MS)
  }

  private async update(): Promise<void> {
    if (!this._panel.visible) return

    try {
      const files = this._provider.getFiles()
      let content = ''

      if (files.length > 0) {
        content = await ContentFormatter.format(files)
      }

      const html = await WebviewFactory.generateHtml(this._panel.webview, this._extensionUri, content)
      this._panel.webview.html = html
    } catch (error) {
      Logger.error('Failed to update preview webview', error)
      void vscode.window.showErrorMessage('Preview update failed.')
    }
  }

  private handleMsg(message: IWebviewMessage): void {
    if (message.command === 'copy') {
      void ClipboardOps.copyText(message.text, 'Preview Content')
    }
  }
}

export class PreviewWebviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: StackProvider,
  ) {}

  public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: unknown): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    }
    PreviewWebview.revive(webviewPanel, this._extensionUri, this._provider)
  }
}
