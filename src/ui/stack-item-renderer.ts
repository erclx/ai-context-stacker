import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

/**
 * Encapsulates all UI rendering logic for the Context Stack.
 * Responsible for icons, colors, descriptions, and TreeItem construction.
 */
export class StackItemRenderer {
  private readonly EMPTY_URI = vscode.Uri.parse('ai-stack:empty-drop-target')
  private readonly EMPTY_ID = 'emptyState'
  private readonly HIGH_TOKEN_THRESHOLD = 5000

  public render(element: StackTreeItem): vscode.TreeItem {
    if (isStagedFolder(element)) return this.renderFolder(element)
    if (element.uri.scheme === this.EMPTY_URI.scheme) return this.renderEmptyState(element)
    return this.renderFile(element)
  }

  public createPlaceholderItem(): StagedFile {
    return {
      type: 'file',
      uri: this.EMPTY_URI,
      label: 'Drag files here to start...',
    }
  }

  public formatTokenCount(count: number): string {
    return count >= 1000 ? `~${(count / 1000).toFixed(1)}k` : `~${count}`
  }

  private renderFolder(folder: StagedFolder): vscode.TreeItem {
    const item = new vscode.TreeItem(folder.label, vscode.TreeItemCollapsibleState.Expanded)
    item.contextValue = 'stagedFolder'
    item.iconPath = vscode.ThemeIcon.Folder
    item.resourceUri = folder.resourceUri

    const totalTokens = folder.containedFiles.reduce((sum, f) => sum + (f.stats?.tokenCount ?? 0), 0)
    item.description = this.formatTokenCount(totalTokens)
    item.tooltip = `${folder.containedFiles.length} files inside`

    return item
  }

  private renderFile(file: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(file.label)
    item.resourceUri = file.uri
    item.contextValue = file.isPinned ? 'stagedFile:pinned' : 'stagedFile'
    item.command = { command: 'vscode.open', title: 'Open File', arguments: [file.uri] }

    if (file.isBinary) {
      this.applyBinaryDecorations(item)
    } else {
      this.applyFileDecorations(item, file)
    }

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

  private applyBinaryDecorations(item: vscode.TreeItem): void {
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
    item.description = 'Binary'
    item.tooltip = 'Binary file detected.'
  }

  private applyFileDecorations(item: vscode.TreeItem, file: StagedFile): void {
    item.iconPath = this.getFileIcon(file)
    item.description = this.getFileDescription(file)
  }

  private getFileIcon(file: StagedFile): vscode.ThemeIcon {
    if (file.isPinned) {
      return new vscode.ThemeIcon('pin')
    }
    const tokenCount = file.stats?.tokenCount ?? 0
    // Highlight files that might be too large for context window
    const color = tokenCount > this.HIGH_TOKEN_THRESHOLD ? new vscode.ThemeColor('charts.orange') : undefined

    return new vscode.ThemeIcon('file', color)
  }

  private getFileDescription(file: StagedFile): string {
    const tokenPart = file.stats ? this.formatTokenCount(file.stats.tokenCount) : '...'
    const parts = [tokenPart, file.isPinned ? '(Pinned)' : '']
    return parts.filter(Boolean).join(' • ')
  }
}
