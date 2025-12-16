import * as vscode from 'vscode'

import { type StagedFile } from '@/models'

import { Logger } from './logger'

export class ContentFormatter {
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

        const extension = file.uri.path.split('.').pop() || ''

        parts.push(`File: ${relativePath}`)
        parts.push('```' + extension)
        parts.push(content)
        parts.push('```')
        parts.push('')
      } catch (err) {
        Logger.error(`Failed to read file ${file.uri.fsPath}`, err)
        parts.push(`> Error reading file: ${vscode.workspace.asRelativePath(file.uri)}`)
      }
    }

    return parts.join('\n')
  }

  private static async readFileContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const uint8Array = await vscode.workspace.fs.readFile(uri)

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
