import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger } from '../utils'

/**
 * Manages the "Rich Preview" webview panel.
 * Displays a live, read-only rendering of the final AI context payload.
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

    // Lifecycle listeners
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Live Updates: Refresh content when the stack changes
    this._provider.onDidChangeTreeData(() => this.update(), null, this._disposables)

    // Handle messages from the webview (e.g., "Copy" button)
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'copy':
            vscode.env.clipboard.writeText(message.text)
            vscode.window.showInformationMessage('Context copied to clipboard!')
            return
        }
      },
      null,
      this._disposables,
    )

    // Initial render
    this.update()
  }

  /**
   * Creates a new panel or reveals the existing one.
   */
  public static createOrShow(extensionUri: vscode.Uri, provider: ContextStackProvider) {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : undefined

    if (PreviewWebview.currentPanel) {
      PreviewWebview.currentPanel._panel.reveal(column)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewWebview.viewType,
      'AI Context Preview',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    )

    PreviewWebview.currentPanel = new PreviewWebview(panel, extensionUri, provider)
  }

  /**
   * Revives a webview panel that has been restored by VS Code (e.g., after reload).
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
      this._panel.webview.html = this.getHtmlForWebview(content)
    } catch (error) {
      Logger.error('Failed to update preview webview', error)
    }
  }

  private getHtmlForWebview(content: string): string {
    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Context Preview</title>
    <style>
        body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            padding: 0;
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px 14px 24px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        h2 {
            margin: 0;
            font-weight: 600;
            font-size: 1.3em;
            color: var(--vscode-foreground);
            letter-spacing: -0.01em;
            line-height: 1.2;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 7px 14px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.9em;
            border-radius: 2px;
            font-weight: 500;
            line-height: 1.2;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .content-wrapper {
            padding: 16px 24px 24px 24px;
            max-width: 800px;
            margin: 0 auto;
        }
        pre {
            background-color: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-textBlockQuote-border);
            padding: 15px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: var(--vscode-editor-font-family);
            margin: 0;
        }
    </style>
</head>
<body>
        <div class="header">
            <h2>Context Payload Preview</h2>
        <button onclick="copyContent()">Copy to Clipboard</button>
        </div>
    <div class="content-wrapper">
        <pre id="content">${escapedContent}</pre>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function copyContent() {
            const text = document.getElementById('content').innerText;
            vscode.postMessage({ command: 'copy', text: text });
        }
    </script>
</body>
</html>`
  }
}

/**
 * Handles the deserialization of the webview when VS Code restarts.
 */
export class PreviewWebviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: ContextStackProvider,
  ) {}

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
    // Reset options to ensure scripts are enabled
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    }

    // Revive the panel using the existing instance
    PreviewWebview.revive(webviewPanel, this._extensionUri, this._provider)
  }
}
