import * as vscode from 'vscode'

import { type StagedFile } from '@/models/staged-file'

export class ContextStackProvider implements vscode.TreeDataProvider<StagedFile> {
  private files: StagedFile[] = []

  private _onDidChangeTreeData = new vscode.EventEmitter<StagedFile | undefined | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  getChildren(element?: StagedFile): StagedFile[] {
    if (!element) {
      return this.files
    }
    return []
  }

  getTreeItem(element: StagedFile): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label)
    item.resourceUri = element.uri
    item.tooltip = element.uri.fsPath
    item.contextValue = 'stagedFile'
    return item
  }

  addFile(uri: vscode.Uri): void {
    const label = uri.path.split('/').pop() || 'unknown'
    this.files.push({ uri, label })
    this._onDidChangeTreeData.fire()
  }

  removeFile(file: StagedFile): void {
    this.files = this.files.filter((f) => f.uri.fsPath !== file.uri.fsPath)
    this._onDidChangeTreeData.fire()
  }

  clear(): void {
    this.files = []
    this._onDidChangeTreeData.fire()
  }

  getFiles(): StagedFile[] {
    return this.files
  }
}
