import * as path from 'path'
import * as vscode from 'vscode'

import { IgnoreManager, StackProvider } from '../providers'
import { Logger } from '../utils'

interface FolderQuickPickItem extends vscode.QuickPickItem {
  uri: vscode.Uri
}

export function registerAddFolderPickerCommand(
  context: vscode.ExtensionContext,
  stackProvider: StackProvider,
  ignoreManager: IgnoreManager,
): void {
  const command = vscode.commands.registerCommand('aiContextStacker.addFolderPicker', async () => {
    await executeAddFolderPicker(stackProvider, ignoreManager)
  })

  context.subscriptions.push(command)
}

async function executeAddFolderPicker(stackProvider: StackProvider, ignoreManager: IgnoreManager): Promise<void> {
  try {
    const folders = await findUniqueFolders(ignoreManager)

    if (folders.length === 0) {
      vscode.window.showInformationMessage('No valid folders found in workspace.')
      return
    }

    const selected = await showFolderPicker(folders)
    if (!selected || selected.length === 0) return

    await processSelection(selected, stackProvider, ignoreManager)
  } catch (error) {
    Logger.error('Add Folder Picker failed', error as Error)
    vscode.window.showErrorMessage('Failed to add folders.')
  }
}

async function findUniqueFolders(ignoreManager: IgnoreManager): Promise<vscode.Uri[]> {
  const excludePatterns = await ignoreManager.getExcludePatterns()
  const allFiles = await vscode.workspace.findFiles('**/*', excludePatterns)

  const folderPaths = new Set<string>()
  const folderUris: vscode.Uri[] = []

  for (const file of allFiles) {
    const dirPath = path.dirname(file.fsPath)
    if (!folderPaths.has(dirPath)) {
      folderPaths.add(dirPath)
      folderUris.push(vscode.Uri.file(dirPath))
    }
  }

  return folderUris.sort((a, b) => a.fsPath.localeCompare(b.fsPath))
}

async function showFolderPicker(folders: vscode.Uri[]): Promise<FolderQuickPickItem[] | undefined> {
  const items: FolderQuickPickItem[] = folders.map((uri) => createPickerItem(uri))

  return vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Select folders to add...',
    title: 'Add Folders to Context Stack',
    matchOnDescription: true,
  })
}

function createPickerItem(uri: vscode.Uri): FolderQuickPickItem {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
  const isRoot = workspaceFolder ? uri.fsPath === workspaceFolder.uri.fsPath : false

  const relativePath = vscode.workspace.asRelativePath(uri, false)
  const folderName = path.basename(uri.fsPath)

  if (isRoot) {
    const rootName = workspaceFolder?.name ?? folderName
    return {
      label: `$(root-folder) ${rootName}`,
      description: 'Add all files in workspace',
      uri,
    }
  }

  return {
    label: `$(folder) ${folderName}`,
    description: relativePath === folderName ? undefined : relativePath,
    detail: undefined,
    uri,
  }
}

async function processSelection(
  items: FolderQuickPickItem[],
  stackProvider: StackProvider,
  ignoreManager: IgnoreManager,
): Promise<void> {
  const folders = items.map((i) => i.uri)
  const excludes = await ignoreManager.getExcludePatterns()

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${folders.length} folder(s)...`,
      cancellable: true,
    },
    async (_, token) => {
      const files = await scanFolders(folders, excludes, token)

      if (token.isCancellationRequested) return

      if (files.length > 0) {
        stackProvider.addFiles(files)
        vscode.window.showInformationMessage(`Added ${files.length} files to context stack`)
      } else {
        vscode.window.showInformationMessage('No valid files found in selected folders.')
      }
    },
  )
}

async function scanFolders(
  folders: vscode.Uri[],
  excludes: string,
  token: vscode.CancellationToken,
): Promise<vscode.Uri[]> {
  const results: vscode.Uri[] = []

  for (const folder of folders) {
    if (token.isCancellationRequested) break

    const folderFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'), excludes)
    results.push(...folderFiles)
  }

  return results
}
