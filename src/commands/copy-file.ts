import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, type StagedFile } from '../models'
import { ContextStackProvider } from '../providers'
import { ContentFormatter, Logger, TokenEstimator } from '../utils'

/**
 * Registers the command to copy selected (or all) staged files.
 */
export function registerCopyFileCommand(
  extensionContext: vscode.ExtensionContext,
  contextStackProvider: ContextStackProvider,
  filesView: vscode.TreeView<StackTreeItem>,
): void {
  const command = vscode.commands.registerCommand(
    'aiContextStacker.copyFile',
    async (item?: StackTreeItem, selectedItems?: StackTreeItem[]) => {
      const filesToCopy = resolveTargetFiles(item, selectedItems, filesView, contextStackProvider)

      if (filesToCopy.length === 0) {
        vscode.window.showInformationMessage('Context stack is empty.')
        return
      }

      try {
        const formattedContent = await ContentFormatter.format(filesToCopy)

        if (!formattedContent) {
          vscode.window.showWarningMessage('Selected content is empty or binary.')
          return
        }

        await vscode.env.clipboard.writeText(formattedContent)

        const stats = TokenEstimator.measure(formattedContent)
        const label = getFeedbackLabel(filesToCopy, contextStackProvider.getFiles().length)

        Logger.info(`Copied: ${label}`)
        vscode.window.showInformationMessage(`Copied ${label}! (${TokenEstimator.format(stats)})`)

        // Feedback when implicitly copying everything
        if (!item && (!selectedItems || selectedItems.length === 0) && filesView.selection.length === 0) {
          vscode.window.setStatusBarMessage('Nothing selected. Copied entire stack.', 3000)
        }
      } catch (error) {
        Logger.error('Copy failed', error)
        vscode.window.showErrorMessage('Failed to copy files.')
      }
    },
  )

  extensionContext.subscriptions.push(command)
}

/**
 * Resolves selection logic, unpacking Folders into their leaf StagedFiles.
 */
function resolveTargetFiles(
  clickedItem: StackTreeItem | undefined,
  multiSelect: StackTreeItem[] | undefined,
  treeView: vscode.TreeView<StackTreeItem>,
  provider: ContextStackProvider,
): StagedFile[] {
  let rawSelection: StackTreeItem[] = []

  if (multiSelect && multiSelect.length > 0) {
    rawSelection = multiSelect
  } else if (clickedItem) {
    rawSelection = [clickedItem]
  } else if (treeView.selection.length > 0) {
    rawSelection = [...treeView.selection]
  } else {
    // No selection = All files
    return provider.getFiles()
  }

  // Flatten recursive structure
  const distinctFiles = new Map<string, StagedFile>()

  const collect = (item: StackTreeItem) => {
    if (isStagedFolder(item)) {
      item.containedFiles.forEach((f) => distinctFiles.set(f.uri.toString(), f))
    } else {
      distinctFiles.set(item.uri.toString(), item)
    }
  }

  rawSelection.forEach(collect)
  return Array.from(distinctFiles.values())
}

function getFeedbackLabel(files: StagedFile[], totalStagedCount: number): string {
  if (files.length === totalStagedCount && files.length > 1) {
    return 'All Staged Files'
  }
  if (files.length === 1) {
    return files[0].label
  }
  return `${files.length} Files`
}
