import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from './logger'

/**
 * Manages reading files and formatting them into a single, structured
 * string suitable for use as AI context (e.g., Markdown file blocks).
 */
export class ContentFormatter {
  public static async readFileFromDisk(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri)
  }

  /**
   * Reads the content of multiple staged files in parallel, formats each one,
   * and combines them into one string.
   */
  public static async format(files: StagedFile[]): Promise<string> {
    const filePromises = files.map(async (file) => {
      if (file.isBinary) {
        Logger.warn(`Skipping binary file: ${file.uri.fsPath}`)
        return `> Skipped binary file: ${vscode.workspace.asRelativePath(file.uri)}\n`
      }

      try {
        const content = await this.readFileContent(file.uri)

        if (content === null) {
          Logger.warn(`Skipping unreadable/binary file during read: ${file.uri.fsPath}`)
          return ''
        }

        const relativePath = vscode.workspace.asRelativePath(file.uri)
        const extension = file.uri.path.split('.').pop() || ''

        return [`File: ${relativePath}`, '```' + extension, content, '```\n'].join('\n')
      } catch (err) {
        Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
        return `> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`
      }
    })

    const parts = await Promise.all(filePromises)
    return parts.filter((p) => p !== '').join('\n')
  }

  /**
   * Reads a file's content and performs a heuristic check for binary content.
   */
  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const uint8Array = await this.readFileFromDisk(uri)

      // Secondary Check: Ensure we don't accidentally copy binary if the flag was missed
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
