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
  pathSegments?: string[]
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

export function getSortWeight(item: StackTreeItem): number {
  let weight = 0
  if (item.isPinned) {
    weight += 2
  }
  if (isStagedFolder(item)) {
    weight += 1
  }
  return weight
}

export function refreshFileLabel(file: StagedFile): void {
  file.label = file.uri.path.split('/').pop() || 'unknown'
  file.pathSegments = undefined
}
