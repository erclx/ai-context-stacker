import * as vscode from 'vscode'

import { type StagedFile } from '@/models'
import { ContextStackProvider } from '@/providers'

export function registerRemoveFileCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.removeFile', (file: StagedFile) => {
    provider.removeFile(file)
    vscode.window.showInformationMessage('Removed file from context stack')
  })

  context.subscriptions.push(command)
}
