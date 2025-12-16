import * as vscode from 'vscode'

import { type StagedFile } from '../models'
import { Logger } from './logger'

/**
 * Manages reading files and formatting them into a single, structured
 * string suitable for use as AI context (e.g., Markdown file blocks).
 */
export class ContentFormatter {
  /**
   * Wrapper around VS Code's file system API to read raw bytes.
   *
   * @param uri The URI of the file to read.
   * @returns A promise resolving to the file content as Uint8Array.
   */
  public static async readFileFromDisk(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri)
  }

  /**
   * Reads the content of multiple staged files, formats each one with
   * a header and Markdown code block, and combines them into one string.
   * Files that are unreadable or appear to be binary are skipped.
   *
   * @param files An array of StagedFile objects to format.
   * @returns A promise resolving to the concatenated, formatted string.
   */
  public static async format(files: StagedFile[]): Promise<string> {
    const parts: string[] = []

    for (const file of files) {
      try {
        const content = await this.readFileContent(file.uri)

        if (content === null) {
          Logger.warn(`Skipping binary or unreadable file: ${file.uri.fsPath}`)
          continue
        }

        const relativePath = vscode.workspace.asRelativePath(file.uri)
        // Extract the file extension to be used as the Markdown code block language hint
        const extension = file.uri.path.split('.').pop() || ''

        parts.push(`File: ${relativePath}`)
        parts.push('```' + extension)
        parts.push(content)
        parts.push('```')
        parts.push('')
      } catch (err) {
        Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
        // Add an inline error marker to the final context string for visibility
        parts.push(`> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`)
      }
    }

    return parts.join('\n')
  }

  /**
   * Reads a file's content and performs a heuristic check for binary content.
   *
   * @param uri The URI of the file to read.
   * @returns The file content as a string, or `null` if the file is detected as binary.
   * @throws Rethrows errors from disk I/O.
   */
  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const uint8Array = await this.readFileFromDisk(uri)

      // Check a small snippet for null bytes (0x00) as a simple binary file heuristic
      const snippet = uint8Array.slice(0, 512)
      const isBinary = snippet.some((byte) => byte === 0)

      if (isBinary) {
        return null
      }

      // Convert the raw bytes to a UTF-8 string
      return Buffer.from(uint8Array).toString('utf-8')
    } catch (error) {
      // Re-throw to be caught by the calling `format` function, which handles logging
      throw error
    }
  }
}
