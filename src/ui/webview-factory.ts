import { randomBytes } from 'crypto'
import { TextDecoder } from 'util'
import * as vscode from 'vscode'

/**
 * Factory for creating and configuring Webview panels.
 * Optimized for rendering speed and security.
 */
export class WebviewFactory {
  // Cache the template in memory to prevent repetitive disk I/O
  private static _templateCache: string | undefined

  public static create(viewType: string, title: string, extensionUri: vscode.Uri): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.Beside, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      retainContextWhenHidden: true, // Performance: Prevents re-rendering when switching tabs
    })
  }

  /**
   * Loads the HTML template and injects content using optimized string manipulation.
   * Avoids global Regex on the content body to prevent Event Loop Blocking.
   */
  public static async generateHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    content: string,
  ): Promise<string> {
    const templateString = await this.getTemplate(extensionUri)
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'preview.css'))
    const nonce = this.getNonce()
    const cspSource = webview.cspSource

    // Optimization: Split template once instead of using Regex replace on potentially huge content
    // This avoids the CPU overhead of scanning 10MB+ strings for a placeholder
    const parts = templateString.split('{{content}}')
    const head = parts[0]
    const tail = parts[1] ?? ''

    // Inject headers (Fast - small strings)
    const filledHead = head
      .replace(/{{cspSource}}/g, cspSource)
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cssUri}}/g, cssUri.toString())

    // Optimization: Single-pass escaping
    const escapedContent = this.escapeHtmlFast(content)

    // Fast concatenation
    return filledHead + escapedContent + tail
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

  /**
   * High-Performance Escaper.
   * Uses a single Regex pass with a replacer function.
   * Prevents the O(5N) cost of chaining .replace() calls on large inputs.
   */
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
