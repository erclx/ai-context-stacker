import * as vscode from 'vscode'

export interface ContentStats {
  tokenCount: number
  charCount: number
}

export interface StagedFile {
  type: 'file'
  uri: vscode.Uri
  label: string
  stats?: ContentStats
  isBinary?: boolean
  isPinned?: boolean
}

export interface StagedFolder {
  type: 'folder'
  id: string
  label: string
  resourceUri: vscode.Uri
  children: StackTreeItem[]
  containedFiles: StagedFile[]
  tokenCount?: number
  isPinned?: boolean
}

export type StackTreeItem = StagedFile | StagedFolder

export function isStagedFolder(item: StackTreeItem): item is StagedFolder {
  return item.type === 'folder'
}

export function isStagedFile(item: StackTreeItem): item is StagedFile {
  return item.type === 'file'
}
