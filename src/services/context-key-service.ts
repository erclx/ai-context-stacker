import * as vscode from 'vscode'

import { StagedFile } from '../models'

export class ContextKeyService implements vscode.Disposable {
  private pending = new Map<string, unknown>()
  private timer: NodeJS.Timeout | undefined

  public updateStackState(files: StagedFile[]): void {
    const hasFiles = files.length > 0
    const hasPinned = files.some((f) => f.isPinned)

    this.set('aiContextStacker.hasFiles', hasFiles)
    this.set('aiContextStacker.hasPinnedFiles', hasPinned)

    if (!hasFiles) {
      this.set('aiContextStacker.hasFolders', false)
    }
  }

  public updatePinnedFilter(active: boolean): void {
    this.set('aiContextStacker.pinnedOnly', active)
  }

  public updateFolderState(hasFolders: boolean): void {
    this.set('aiContextStacker.hasFolders', hasFolders)
  }

  public updateEditorState(): void {
    const isActive = !!vscode.window.activeTextEditor
    this.set('aiContextStacker.isTextEditorActive', isActive)
  }

  public updateEditorContext(uri: vscode.Uri | undefined, isStaged: boolean): void {
    this.set('aiContextStacker.isCurrentFileInStack', isStaged)
  }

  public updateUnstagedFilesState(hasUnstaged: boolean): void {
    this.set('aiContextStacker.hasUnstagedOpenFiles', hasUnstaged)
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.pending.clear()
  }

  private set(key: string, value: unknown): void {
    this.pending.set(key, value)
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.timer) {
      return
    }
    this.timer = setTimeout(() => this.flush(), 50)
  }

  private flush(): void {
    this.timer = undefined
    this.pending.forEach((val, key) => {
      void vscode.commands.executeCommand('setContext', key, val)
    })
    this.pending.clear()
  }
}
