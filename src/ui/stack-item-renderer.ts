import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

/**
 * Orchestrates the transformation of internal Stack models into VS Code TreeItems.
 * Handles conditional formatting, icon attribution, and token-count visualization.
 */
export class StackItemRenderer {
  private readonly EMPTY_URI_SCHEME = 'ai-stack'
  private readonly EMPTY_ID = 'emptyState'
  private readonly HIGH_TOKEN_THRESHOLD = 5000

  /**
   * Primary entry point for the TreeDataProvider to resolve UI elements.
   * @param element The model element to be rendered.
   */
  public render(element: StackTreeItem): vscode.TreeItem {
    if (isStagedFolder(element)) {
      return this.renderFolder(element)
    }

    if (element.uri.scheme === this.EMPTY_URI_SCHEME) {
      return this.renderEmptyState(element)
    }

    return this.renderFile(element)
  }

  /**
   * Creates a virtual item used to guide users when the stack is empty.
   */
  public createPlaceholderItem(): StagedFile {
    return {
      type: 'file',
      uri: vscode.Uri.from({ scheme: this.EMPTY_URI_SCHEME, path: 'empty-drop-target' }),
      label: 'Drag files here to start...',
    }
  }

  /**
   * Converts raw token numbers into a human-readable shorthand (e.g., 1.2k).
   */
  public formatTokenCount(count: number): string {
    if (count < 0 || isNaN(count)) return '~0'
    return count >= 1000 ? `~${(count / 1000).toFixed(1)}k` : `~${count}`
  }

  private renderFolder(folder: StagedFolder): vscode.TreeItem {
    const item = new vscode.TreeItem(folder.label, vscode.TreeItemCollapsibleState.Expanded)

    item.contextValue = 'stagedFolder'
    item.iconPath = vscode.ThemeIcon.Folder
    item.resourceUri = folder.resourceUri

    const totalTokens = this.sumFolderTokens(folder)
    item.description = this.formatTokenCount(totalTokens)
    item.tooltip = `${folder.containedFiles.length} files inside`

    return item
  }

  /**
   * Aggregates tokens from children.
   * Extracted to allow future memoization if folder depth increases.
   */
  private sumFolderTokens(folder: StagedFolder): number {
    return folder.containedFiles.reduce((sum, file) => {
      return sum + (file.stats?.tokenCount ?? 0)
    }, 0)
  }

  private renderFile(file: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(file.label)

    item.resourceUri = file.uri
    item.contextValue = file.isPinned ? 'stagedFile:pinned' : 'stagedFile'
    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [file.uri],
    }

    this.applyContextualDecorations(item, file)

    return item
  }

  private renderEmptyState(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)

    item.iconPath = new vscode.ThemeIcon('cloud-upload')
    item.contextValue = this.EMPTY_ID
    item.command = {
      command: 'aiContextStacker.addFilePicker',
      title: 'Add Files',
    }

    return item
  }

  /**
   * Branches decoration logic based on file characteristics.
   */
  private applyContextualDecorations(item: vscode.TreeItem, file: StagedFile): void {
    if (file.isBinary) {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
      item.description = 'Binary'
      item.tooltip = 'Binary file detected; content cannot be parsed for tokens.'
      return
    }

    item.iconPath = this.resolveFileIcon(file)
    item.description = this.buildFileDescription(file)
  }

  /**
   * Logic to visually warn users if a file is unusually large.
   */
  private resolveFileIcon(file: StagedFile): vscode.ThemeIcon {
    if (file.isPinned) return new vscode.ThemeIcon('pin')

    const tokenCount = file.stats?.tokenCount ?? 0

    // Warn user via color if the file consumes a significant portion of context
    const iconColor = tokenCount > this.HIGH_TOKEN_THRESHOLD ? new vscode.ThemeColor('charts.orange') : undefined

    return new vscode.ThemeIcon('file', iconColor)
  }

  private buildFileDescription(file: StagedFile): string {
    const tokenDisplay = file.stats ? this.formatTokenCount(file.stats.tokenCount) : '...'

    const parts: string[] = [tokenDisplay]
    if (file.isPinned) parts.push('(Pinned)')

    return parts.join(' • ')
  }
}
