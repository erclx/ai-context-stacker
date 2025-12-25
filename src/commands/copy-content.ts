import * as vscode from 'vscode'

import { StackProvider } from '../providers'
import { ContentFormatter, Logger } from '../utils'

export function registerCopyContentCommand(context: vscode.ExtensionContext, stackProvider: StackProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.copyContent', async () => {
      try {
        const files = stackProvider.getFiles()

        if (files.length === 0) {
          vscode.window.showInformationMessage('No files in stack to copy.')
          return
        }

        // Force skipTree: true
        const content = await ContentFormatter.format(files, { skipTree: true })

        await vscode.env.clipboard.writeText(content)
        vscode.window.showInformationMessage('File content copied (Tree omitted).')
      } catch (error) {
        Logger.error('Failed to copy file content', error)
        vscode.window.showErrorMessage('Failed to generate content.')
      }
    }),
  )
}
