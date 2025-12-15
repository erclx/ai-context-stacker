import * as vscode from 'vscode'

import { type StagedFile } from '@/models/staged-file'
import { ContextStackProvider } from '@/providers/context-stack-provider'

export function registerRemoveFileCommand(context: vscode.ExtensionContext, provider: ContextStackProvider): void {
  const command = vscode.commands.registerCommand('aiContextStacker.removeFile', (file: StagedFile) => {
    provider.removeFile(file)
    vscode.window.showInformationMessage('Removed file from context stack')
  })

  context.subscriptions.push(command)
}
