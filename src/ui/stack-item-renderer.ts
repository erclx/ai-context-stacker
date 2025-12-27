import * as vscode from 'vscode'

import { isStagedFolder, StackTreeItem, StagedFile, StagedFolder } from '../models'

export class StackItemRenderer {
  private readonly EMPTY_URI_SCHEME = 'ai-stack'
  private readonly EMPTY_ID = 'emptyState'

  public render(element: StackTreeItem): vscode.TreeItem {
    if (isStagedFolder(element)) {
      return this.renderFolder(element)
    }

    if (element.uri.scheme === this.EMPTY_URI_SCHEME) {
      return this.renderEmptyState(element)
    }

    return this.renderFile(element)
  }

  public createPlaceholderItem(): StagedFile {
    return {
      type: 'file',
      uri: vscode.Uri.from({ scheme: this.EMPTY_URI_SCHEME, path: 'empty-drop-target' }),
      label: 'Drag or click here to add files...',
    }
  }

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

    item.iconPath = new vscode.ThemeIcon('library')
    item.contextValue = this.EMPTY_ID
    item.command = {
      command: 'aiContextStacker.addFilePicker',
      title: 'Add Files',
    }

    return item
  }

  private applyContextualDecorations(item: vscode.TreeItem, file: StagedFile): void {
    if (file.isBinary) {
      this.applyBinaryDecorations(item)
      return
    }

    const threshold = this.getThreshold()
    const tokens = file.stats?.tokenCount ?? 0

    item.iconPath = this.resolveFileIcon(file, tokens, threshold)
    item.tooltip = this.resolveTooltip(file, tokens, threshold)
    item.description = this.buildFileDescription(file)
  }

  private applyBinaryDecorations(item: vscode.TreeItem): void {
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'))
    item.description = 'Binary'
    item.tooltip = 'Binary file detected; content cannot be parsed for tokens.'
  }

  private resolveFileIcon(file: StagedFile, tokens: number, threshold: number): vscode.ThemeIcon {
    const isCritical = tokens >= threshold * 2
    const isWarning = tokens >= threshold

    let iconId = 'file'
    let color: vscode.ThemeColor | undefined

    if (file.isPinned) iconId = 'pin'
    else if (isCritical) iconId = 'warning'

    if (isCritical) color = new vscode.ThemeColor('charts.red')
    else if (isWarning) color = new vscode.ThemeColor('charts.orange')

    return new vscode.ThemeIcon(iconId, color)
  }

  private resolveTooltip(file: StagedFile, tokens: number, threshold: number): string {
    const base = file.uri.fsPath
    if (tokens >= threshold * 2) {
      return `${base}\n\nCritical: Exceeds ${this.formatTokenCount(threshold * 2)} tokens`
    }
    if (tokens >= threshold) {
      return `${base}\n\nHeavy: Exceeds ${this.formatTokenCount(threshold)} tokens`
    }
    return base
  }

  private getThreshold(): number {
    return vscode.workspace.getConfiguration('aiContextStacker').get<number>('largeFileThreshold', 5000)
  }

  private buildFileDescription(file: StagedFile): string {
    const tokenDisplay = file.stats ? this.formatTokenCount(file.stats.tokenCount) : '...'

    const parts: string[] = [tokenDisplay]
    if (file.isPinned) parts.push('(Pinned)')

    return parts.join(' • ')
  }
}
