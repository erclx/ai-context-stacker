import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from './logger'

/**
 * Formats staged files into Markdown code blocks for AI context.
 */
export class ContentFormatter {
  /**
   * Reads and formats files in parallel into a single concatenated string.
   */
  public static async format(files: StagedFile[]): Promise<string> {
    const parts = await Promise.all(files.map((f) => this.formatFileBlock(f)))
    return parts.filter((p) => p !== '').join('\n')
  }

  /**
   * Formats a single file into a markdown code block.
   * Handles binary skipping and read errors gracefully.
   */
  private static async formatFileBlock(file: StagedFile): Promise<string> {
    if (file.isBinary) {
      Logger.warn(`Skipping binary file: ${file.uri.fsPath}`)
      return `> Skipped binary file: ${vscode.workspace.asRelativePath(file.uri)}\n`
    }

    try {
      const content = await this.readFileContent(file.uri)

      if (content === null) {
        Logger.warn(`Skipping unreadable/binary file: ${file.uri.fsPath}`)
        return ''
      }

      const relativePath = vscode.workspace.asRelativePath(file.uri)
      const extension = file.uri.path.split('.').pop() || ''

      return [`File: ${relativePath}`, '```' + extension, content, '```\n'].join('\n')
    } catch (err) {
      Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
      return `> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`
    }
  }

  /**
   * Reads file from disk and performs safety check for binary content.
   */
  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const uint8Array = await vscode.workspace.fs.readFile(uri)

      // Safety check: sniff first 512 bytes for nulls
      const isBinary = uint8Array.slice(0, 512).some((byte) => byte === 0)
      if (isBinary) return null

      return Buffer.from(uint8Array).toString('utf-8')
    } catch (error) {
      throw error
    }
  }
}
