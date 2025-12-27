import { randomBytes } from 'crypto'
import { TextDecoder } from 'util'
import * as vscode from 'vscode'

export class WebviewFactory {
  private static _templateCache: string | undefined

  public static create(viewType: string, title: string, extensionUri: vscode.Uri): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      retainContextWhenHidden: true,
    })
  }

  public static async generateHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    content: string,
  ): Promise<string> {
    const templateString = await this.getTemplate(extensionUri)
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'preview.css'))
    const nonce = this.getNonce()
    const cspSource = webview.cspSource

    const filledTemplate = templateString
      .replace(/{{cspSource}}/g, cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cssUri}}/g, cssUri.toString())

    const parts = filledTemplate.split('{{content}}')
    const head = parts[0]
    const tail = parts[1] ?? ''

    const escapedContent = this.escapeHtmlFast(content)

    return head + escapedContent + tail
  }

  private static async getTemplate(extensionUri: vscode.Uri): Promise<string> {
    if (this._templateCache) {
      return this._templateCache
    }

    const templateUri = vscode.Uri.joinPath(extensionUri, 'media', 'preview.html')
    const templateData = await vscode.workspace.fs.readFile(templateUri)
    this._templateCache = new TextDecoder().decode(templateData)

    return this._templateCache
  }

  private static getNonce(): string {
    return randomBytes(16).toString('base64')
  }

  private static escapeHtmlFast(unsafe: string): string {
    if (!unsafe) return ''

    return unsafe.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case '&':
          return '&amp;'
        case '<':
          return '&lt;'
        case '>':
          return '&gt;'
        case '"':
          return '&quot;'
        case "'":
          return '&#039;'
        default:
          return match
      }
    })
  }
}
