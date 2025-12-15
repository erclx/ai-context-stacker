import * as vscode from 'vscode'

import { ContextStackProvider, IgnorePatternProvider } from '@/providers'

export function registerAddFilePickerCommand(
  context: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  ignorePatternProvider: IgnorePatternProvider,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFilePicker', async () => {
    const excludePatterns = await ignorePatternProvider.getExcludePatterns()
    const files = await vscode.workspace.findFiles('**/*', excludePatterns)

    const items = files.map((uri) => ({
      label: vscode.workspace.asRelativePath(uri),
      uri: uri,
    }))

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
