import * as path from 'path'
import * as vscode from 'vscode'

import { StackTreeItem, StagedFile } from '../models'
import { StackProvider } from '../providers'
import { ClipboardOps, Logger, SelectionResolver } from '../utils'
import { resolveTargets } from './add-file-context-menu'
import { Command, CommandDependencies } from './types'

export function getCopyFileCommands(deps: CommandDependencies): Command[] {
  const { stackProvider } = deps.services
  const { filesView } = deps.views
  return [
    {
      id: 'aiContextStacker.copyFile',
      execute: async (item?: StackTreeItem, nodes?: StackTreeItem[]) => {
        try {
          await executeStackCopy(item, nodes, stackProvider, filesView)
        } catch (error) {
          Logger.error('Copy failed', error, true)
        }
      },
    },
    {
      id: 'aiContextStacker.copyExplorerContent',
      execute: async (clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
        try {
          await executeExplorerCopy(clickedUri, selectedUris)
        } catch (error) {
          Logger.error('Explorer copy failed', error, true)
        }
      },
    },
  ]
}

async function executeStackCopy(
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

async function executeExplorerCopy(clickedUri?: vscode.Uri, selectedUris?: vscode.Uri[]): Promise<void> {
  const targets = resolveTargets(clickedUri, selectedUris)
  if (targets.length === 0) {
    vscode.window.showWarningMessage('No selection found.')
    return
  }

  const config = vscode.workspace.getConfiguration('aiContextStacker')
  const userExcludes = config.get<string[]>('excludes') || []
  const defaultExcludes = config.get<string[]>('defaultExcludes') || []
  const excludePattern = [...userExcludes, ...defaultExcludes].join(',')

  const isMultiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Gathering files...',
      cancellable: true,
    },
    async (progress, token) => {
      const collectedFiles: StagedFile[] = []
      let processedCount = 0

      for (const target of targets) {
        if (token.isCancellationRequested) return

        if (processedCount % 5 === 0) {
          await new Promise((resolve) => setImmediate(resolve))
        }

        try {
          const stat = await vscode.workspace.fs.stat(target)

          if (stat.type === vscode.FileType.Directory) {
            progress.report({ message: `Scanning ${path.basename(target.fsPath)}...` })
            const folderFiles = await findFilesInFolder(target, excludePattern, token)

            for (const uri of folderFiles) {
              collectedFiles.push(createStagedFile(uri, isMultiRoot))
            }
          } else {
            collectedFiles.push(createStagedFile(target, isMultiRoot))
          }
        } catch (error) {
          Logger.warn(`Failed to access ${target.fsPath}: ${error}`)
        }

        processedCount++
      }

      if (collectedFiles.length === 0) {
        vscode.window.showWarningMessage('No files found to copy.')
        return
      }

      progress.report({ message: `Formatting ${collectedFiles.length} files...` })

      await ClipboardOps.copy(collectedFiles, `${collectedFiles.length} files from Explorer`)
    },
  )
}

function createStagedFile(uri: vscode.Uri, isMultiRoot: boolean): StagedFile {
  const relativePath = vscode.workspace.asRelativePath(uri, isMultiRoot)
  const segments = relativePath.split(/[/\\]/)

  return {
    type: 'file',
    uri: uri,
    label: path.basename(uri.fsPath),
    pathSegments: segments,
    isBinary: false,
    isPinned: false,
  }
}

async function findFilesInFolder(
  folder: vscode.Uri,
  excludePattern: string,
  token: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  const pattern = new vscode.RelativePattern(folder, '**/*')
  return await vscode.workspace.findFiles(pattern, `{${excludePattern}}`, undefined, token)
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
