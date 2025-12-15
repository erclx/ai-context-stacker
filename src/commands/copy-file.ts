import * as vscode from 'vscode'

import { type StagedFile } from '@/models'
import { ContentFormatter, Logger } from '@/utils'

export function registerCopyFileCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('aiContextStacker.copyFile', async (file: StagedFile) => {
    if (!file) {
      return
    }

    try {
      // Reuse the formatter by passing a single-item array
      // This ensures the output format (headers, code ticks) is identical to "Copy All"
      const formattedContent = await ContentFormatter.format([file])

      if (!formattedContent) {
        vscode.window.showWarningMessage('File content is empty or binary.')
        return
      }

      await vscode.env.clipboard.writeText(formattedContent)

      Logger.info(`Copied single file: ${file.label}`)
      vscode.window.showInformationMessage(`Copied ${file.label} to clipboard!`)
    } catch (error) {
      Logger.error(`Failed to copy file: ${file.label}`, error)
      vscode.window.showErrorMessage('Failed to copy file content.')
    }
  })

  context.subscriptions.push(command)
}
