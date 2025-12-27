import * as vscode from 'vscode'

import { StackTreeItem } from '../models'
import { IgnoreManager, StackProvider } from '../providers'
import { categorizeTargets, handleFolderScanning, Logger } from '../utils'
import { extractUrisFromTransfer } from '../utils/drag-drop'

export class StackDragDropController implements vscode.TreeDragAndDropController<StackTreeItem>, vscode.Disposable {
  public readonly dragMimeTypes: readonly string[] = ['text/uri-list']
  public readonly dropMimeTypes: readonly string[] = ['text/uri-list']

  constructor(
    private readonly provider: StackProvider,
    private readonly ignoreProvider: IgnoreManager,
  ) {}

  public async handleDrop(
    target: StackTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    try {
      const uris = await extractUrisFromTransfer(dataTransfer)

      if (!this.validateDroppedUris(uris, dataTransfer)) return
      if (token.isCancellationRequested) return

      const { validUris, rejectedCount } = this.filterWorkspaceUris(uris)

      if (rejectedCount > 0) {
        void vscode.window.showInformationMessage(`Ignored ${rejectedCount} file(s) outside workspace.`)
      }

      if (validUris.length > 0) {
        await this.processDroppedFiles(validUris, token)
      }
    } catch (error) {
      Logger.error('Failed to handle drop event', error as Error)
      void vscode.window.showErrorMessage('Failed to process dropped files.')
    }
  }

  private validateDroppedUris(uris: vscode.Uri[], dataTransfer: vscode.DataTransfer): boolean {
    if (uris.length > 0) return true

    if (dataTransfer.get('text/plain')) {
      void vscode.window.showWarningMessage('Drop ignored: No valid files detected.')
    }
    return false
  }

  private filterWorkspaceUris(uris: vscode.Uri[]): {
    validUris: vscode.Uri[]
    rejectedCount: number
  } {
    const validUris = uris.filter((uri) => vscode.workspace.getWorkspaceFolder(uri))
    const rejectedCount = uris.length - validUris.length

    if (validUris.length === 0 && rejectedCount > 0) {
      void vscode.window.showWarningMessage('Drop ignored: Files must be within the current workspace.')
    }

    return { validUris, rejectedCount }
  }

  private async processDroppedFiles(uris: vscode.Uri[], token: vscode.CancellationToken): Promise<void> {
    const { files, folders } = await categorizeTargets(uris)

    if (token.isCancellationRequested) return

    if (files.length > 0) {
      this.provider.addFiles(files)
    }

    if (folders.length > 0) {
      await handleFolderScanning(folders, this.provider, this.ignoreProvider)
    }
  }

  dispose() {}
}
