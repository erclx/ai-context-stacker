import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '../providers'

export function registerAddFilePickerCommand(
  context: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFilePicker', async () => {
    const stagedFiles = contextStackProvider.getFiles()
    const stagedFileIds = new Set(stagedFiles.map((f) => f.uri.toString()))

    const excludePatterns = await ignorePatternProvider.getExcludePatterns()
    const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

    const newFiles = allFiles.filter((uri) => !stagedFileIds.has(uri.toString()))

    const items = newFiles.map((uri) => ({
      label: vscode.workspace.asRelativePath(uri),
      uri: uri,
    }))

    if (items.length === 0) {
      vscode.window.showInformationMessage('All files in workspace are already staged!')
      return
    }

    const selectedParams = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Search and select files to add...',
      title: 'Add Files to Context Stack',
      matchOnDescription: true,
      matchOnDetail: true,
    })

    if (selectedParams && selectedParams.length > 0) {
      const uris = selectedParams.map((item) => item.uri)
      contextStackProvider.addFiles(uris)
      vscode.window.showInformationMessage(`Added ${uris.length} file(s) to context stack`)
    }
  })

  context.subscriptions.push(command)
}
