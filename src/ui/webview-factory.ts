import { TextDecoder } from 'util'
import * as vscode from 'vscode'

/**
 * Factory for creating and configuring Webview panels.
 * Handles CSP generation, asset path resolution, and template interpolation.
 */
export class WebviewFactory {
  public static create(viewType: string, title: string, extensionUri: vscode.Uri): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
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

    const templateData = await vscode.workspace.fs.readFile(templateUri)
    const templateString = new TextDecoder().decode(templateData)

    const nonce = this.getNonce()
    const cspSource = webview.cspSource

    return templateString
      .replace(/{{cspSource}}/g, cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cssUri}}/g, cssUri.toString())
      .replace(/{{content}}/g, this.escapeHtml(content))
  }

  private static getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
