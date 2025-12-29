import * as vscode from 'vscode'

import { StackTreeItem } from '../models'
import { StackProvider } from '../providers/stack-provider'
import { Logger } from '../utils'
import { Command, CommandDependencies } from './types'

export function getRevealInViewCommands(deps: CommandDependencies): Command[] {
  return [
    {
      id: 'aiContextStacker.revealInView',
      execute: (uri?: vscode.Uri) => {
        void handleReveal(uri, deps.services.stackProvider, deps.views.filesView)
      },
    },
  ]
}

async function handleReveal(
  uri: vscode.Uri | undefined,
  provider: StackProvider,
  view: vscode.TreeView<StackTreeItem>,
): Promise<void> {
  try {
    const targetUri = resolveTargetUri(uri)
    if (!targetUri) return

    const item = await findOrPrompt(targetUri, provider)
    if (!item) return

    await executeReveal(view, item)
  } catch (error) {
    Logger.error('Failed to reveal item in view', error as Error)
  }
}

function resolveTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri instanceof vscode.Uri) return uri
  return vscode.window.activeTextEditor?.document.uri
}

async function findOrPrompt(uri: vscode.Uri, provider: StackProvider): Promise<StackTreeItem | undefined> {
  const item = provider.getStackItem(uri)

  if (item) return item

  if (provider.hasTrackedPath(uri) && provider.hasActiveFilters) {
    void promptToUnfiltered(provider)
    return undefined
  }

  void vscode.window.showInformationMessage('Item is not in the current AI stack.')
  return undefined
}

async function promptToUnfiltered(provider: StackProvider): Promise<void> {
  const action = 'Disable Filter'
  const selection = await vscode.window.showWarningMessage(
    'Item is staged but hidden by the "Pinned Only" filter.',
    action,
  )

  if (selection === action) {
    provider.togglePinnedOnly()
    void vscode.window.showInformationMessage('Filter disabled. Try revealing again.')
  }
}

async function executeReveal(view: vscode.TreeView<StackTreeItem>, item: StackTreeItem): Promise<void> {
  await view.reveal(item, {
    select: true,
    focus: true,
    expand: 3,
  })
}
