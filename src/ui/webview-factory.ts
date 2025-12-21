import { randomBytes } from 'crypto'
import { TextDecoder } from 'util'
import * as vscode from 'vscode'

// Static RegExp definitions to prevent recompilation on every render
const RX_CSP = /{{cspSource}}/g
const RX_NONCE = /{{nonce}}/g
const RX_CSS = /{{cssUri}}/g
const RX_CONTENT = /{{content}}/g
const RX_AMP = /&/g
const RX_LT = /</g
const RX_GT = />/g
const RX_QUOT = /"/g
const RX_APOS = /'/g

/**
 * Factory for creating and configuring Webview panels.
 * Optimized for rendering speed and security.
 */
export class WebviewFactory {
  public static create(viewType: string, title: string, extensionUri: vscode.Uri): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      retainContextWhenHidden: true, // Performance: Prevents re-rendering when switching tabs
    })
  }

  /**
   * Loads the HTML template from disk and injects content/security tokens.
   */
  public static async generateHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    content: string,
  ): Promise<string> {
    const templateUri = vscode.Uri.joinPath(extensionUri, 'media', 'preview.html')
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'preview.css'))

    // Async file read - standard
    const templateData = await vscode.workspace.fs.readFile(templateUri)
    const templateString = new TextDecoder().decode(templateData)

    const nonce = this.getNonce()
    const cspSource = webview.cspSource
    const escapedContent = this.escapeHtml(content)

    // Efficient chaining
    return templateString
      .replace(RX_CSP, cspSource)
      .replace(RX_NONCE, nonce)
      .replace(RX_CSS, cssUri.toString())
      .replace(RX_CONTENT, escapedContent)
  }

  private static getNonce(): string {
    return randomBytes(16).toString('base64')
  }

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(RX_AMP, '&amp;')
      .replace(RX_LT, '&lt;')
      .replace(RX_GT, '&gt;')
      .replace(RX_QUOT, '&quot;')
      .replace(RX_APOS, '&#039;')
  }
}
