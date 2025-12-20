import * as vscode from 'vscode'

import { StackTreeItem } from '../models'
import { ContextStackProvider } from '../providers'
import { ClipboardOps, Logger, SelectionResolver } from '../utils'

export function registerCopyFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StackTreeItem, nodes?: StackTreeItem[]) => {
      try {
        await executeCopy(item, nodes, filesView, contextStackProvider)
      } catch (error) {
        Logger.error('Copy failed', error, true)
      }
    },
  )

  extensionContext.subscriptions.push(command)
}

async function executeCopy(
  item: StackTreeItem | undefined,
  nodes: StackTreeItem[] | undefined,
  filesView: vscode.TreeView<StackTreeItem>,
  contextStackProvider: ContextStackProvider,
): Promise<void> {
  const files = SelectionResolver.resolve(item, nodes, filesView, contextStackProvider)

  if (files.length === 0) {
    vscode.window.showInformationMessage('Context stack is empty.')
    return
  }

  const label = SelectionResolver.getFeedbackLabel(files, contextStackProvider.getFiles().length)

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Copying files...' },
    async () => await ClipboardOps.copy(files, label),
  )

  checkImplicitSelection(item, nodes, filesView)
}

function checkImplicitSelection(
  item: StackTreeItem | undefined,
  nodes: StackTreeItem[] | undefined,
  view: vscode.TreeView<StackTreeItem>,
): void {
  // If no specific item selected, we defaulted to "Copy All" behavior
  const isImplicit = !item && (!nodes || nodes.length === 0) && view.selection.length === 0

  if (isImplicit) {
    vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
  }
}
