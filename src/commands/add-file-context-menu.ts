import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '@/providers'
import { Logger } from '@/utils'

export function registerAddFileContextMenuCommand(
  context: vscode.ExtensionContext,
  provider: ContextStackProvider,
  ignoreProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFileToStack', async (uri?: vscode.Uri) => {
    let targetUri = uri
    if (!targetUri) {
      const activeEditor = vscode.window.activeTextEditor
      if (!activeEditor) {
        vscode.window.showWarningMessage('No selection found.')
        return
      }
      targetUri = activeEditor.document.uri
    }

    try {
      const stat = await vscode.workspace.fs.stat(targetUri)

      if (stat.type === vscode.FileType.File) {
        provider.addFile(targetUri)
        vscode.window.setStatusBarMessage(`Added ${targetUri.path.split('/').pop()}`, 2000)
      } else if (stat.type === vscode.FileType.Directory) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning folder...',
            cancellable: true,
          },
          async (_, token) => {
            const excludes = await ignoreProvider.getExcludePatterns()

            const searchPattern = new vscode.RelativePattern(targetUri!, '**/*')

            const files = await vscode.workspace.findFiles(searchPattern, excludes, undefined, token)

            if (token.isCancellationRequested) return

            if (files.length === 0) {
              vscode.window.showInformationMessage('No valid text files found in folder.')
              return
            }

            provider.addFiles(files)
            Logger.info(`Added ${files.length} files from folder: ${targetUri!.fsPath}`)
            vscode.window.showInformationMessage(`Added ${files.length} files from folder!`)
          },
        )
      }
    } catch (error) {
      Logger.error('Failed to add file/folder', error)
      vscode.window.showErrorMessage('Failed to read selection.')
    }
  })

  context.subscriptions.push(command)
}
