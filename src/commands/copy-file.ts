import * as vscode from 'vscode'

import { StackTreeItem } from '../models'
import { StackProvider } from '../providers'
import { ClipboardOps, Logger, SelectionResolver } from '../utils'
import { Command, CommandDependencies } from './types'

export function getCopyFileCommands(deps: CommandDependencies): Command[] {
  const { stackProvider } = deps.services
  const { filesView } = deps.views
  return [
    {
      id: 'aiContextStacker.copyFile',
      execute: async (item?: StackTreeItem, nodes?: StackTreeItem[]) => {
        try {
          await executeCopy(item, nodes, stackProvider, filesView)
        } catch (error) {
          Logger.error('Copy failed', error, true)
        }
      },
    },
  ]
}

async function executeCopy(
  item: StackTreeItem | undefined,
  nodes: StackTreeItem[] | undefined,
  provider: StackProvider,
  view: vscode.TreeView<StackTreeItem>,
): Promise<void> {
  const files = SelectionResolver.resolve(item, nodes, view, provider)

  if (files.length === 0) {
    vscode.window.showInformationMessage('Context stack is empty.')
    return
  }

  const label = SelectionResolver.getFeedbackLabel(files, provider.getFiles().length)

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Copying files...' },
    async () => await ClipboardOps.copy(files, label),
  )

  checkImplicitSelection(item, nodes, view)
}

function checkImplicitSelection(
  item: StackTreeItem | undefined,
  nodes: StackTreeItem[] | undefined,
  view: vscode.TreeView<StackTreeItem>,
): void {
  const isImplicit = !item && (!nodes || nodes.length === 0) && view.selection.length === 0

  if (isImplicit) {
    vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
  }
}
