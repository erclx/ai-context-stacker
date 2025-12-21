import * as vscode from 'vscode'

import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger } from '../utils'

/**
 * Registers the 'Copy Context Map' command.
 * Copies only the ASCII tree structure to the clipboard.
 */
export function registerCopyTreeCommand(context: vscode.ExtensionContext, stackProvider: ContextStackProvider) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aiContextStacker.copyTree', async () => {
      try {
        const files = stackProvider.getFiles()

        if (files.length === 0) {
          vscode.window.showInformationMessage('No files in stack to map.')
          return
        }

        const tree = ContentFormatter.generateAsciiTree(files)
        const output = `# Context Map\n\`\`\`\n${tree}\`\`\``

        await vscode.env.clipboard.writeText(output)
        vscode.window.showInformationMessage('Context Map copied to clipboard!')
      } catch (error) {
        Logger.error('Failed to copy context map', error)
        vscode.window.showErrorMessage('Failed to generate context map.')
      }
    }),
  )
}
