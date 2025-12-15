import * as vscode from 'vscode'

import { type StagedFile } from '@/models/staged-file'
import { Logger } from '@/utils/logger'

export class ContentFormatter {
  /**
   * Reads all staged files and returns a single formatted string.
   */
  public static async format(files: StagedFile[]): Promise<string> {
    const parts: string[] = []

    for (const file of files) {
      try {
        const content = await this.readFileContent(file.uri)

        // If content is null, it means it was binary or unreadable
        if (content === null) {
          Logger.warn(`Skipping binary or unreadable file: ${file.uri.fsPath}`)
          continue
        }

        // Use VS Code API to get a clean relative path (e.g., "src/utils/formatter.ts")
        const relativePath = vscode.workspace.asRelativePath(file.uri)

        // Simple extension extraction for markdown syntax highlighting
        const extension = file.uri.path.split('.').pop() || ''

        // The Prompt Format
        parts.push(`File: ${relativePath}`)
        parts.push('```' + extension)
        parts.push(content)
        parts.push('```')
        parts.push('') // Empty line spacing
      } catch (err) {
        Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
        parts.push(`> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`)
      }
    }

    return parts.join('\n')
  }

  /**
   * Reads a file and returns string content, or null if it appears to be binary.
   */
  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const uint8Array = await vscode.workspace.fs.readFile(uri)

      // Binary Check: Check first 512 bytes for null characters
      const snippet = uint8Array.slice(0, 512)
      const isBinary = snippet.some((byte) => byte === 0)

      if (isBinary) {
        return null
      }

      return Buffer.from(uint8Array).toString('utf-8')
    } catch (error) {
      throw error
    }
  }
}
