import * as vscode from 'vscode'

import { TrackManager } from '../providers'
import { Logger } from '../utils'

export class FileLifecycleService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = []

  private deleteQueue = new Set<string>()
  private renameQueue = new Map<string, string>()
  private flushTimer: NodeJS.Timeout | undefined
  private readonly FLUSH_DELAY = 100

  constructor(private trackManager: TrackManager) {
    this.registerListeners()
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }
  }

  private registerListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((e) => {
        e.files.forEach((f) => this.queueDelete(f))
      }),
      vscode.workspace.onDidRenameFiles((e) => {
        e.files.forEach((f) => this.queueRename(f.oldUri, f.newUri))
      }),
    )
  }

  private queueDelete(uri: vscode.Uri): void {
    this.deleteQueue.add(uri.toString())
    this.scheduleFlush()
  }

  private queueRename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    this.renameQueue.set(oldUri.toString(), newUri.toString())
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.flushQueues()
    }, this.FLUSH_DELAY)
  }

  private async flushQueues(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve))

    if (this.deleteQueue.size > 0) {
      try {
        const uris = Array.from(this.deleteQueue).map((s) => vscode.Uri.parse(s))
        this.deleteQueue.clear()

        if (uris.length > 0) {
          await this.trackManager.processBatchDeletions(uris)
        }
      } catch (error) {
        Logger.error('Failed to process deletion batch', error as Error)
      }
    }

    if (this.renameQueue.size > 0) {
      try {
        const entries = Array.from(this.renameQueue.entries())
        this.renameQueue.clear()

        for (const [oldStr, newStr] of entries) {
          const oldUri = vscode.Uri.parse(oldStr)
          const newUri = vscode.Uri.parse(newStr)

          try {
            const stat = await vscode.workspace.fs.stat(newUri)
            if (stat.type === vscode.FileType.Directory) {
              await this.trackManager.replaceUriPrefix(oldUri, newUri)
            } else {
              this.trackManager.replaceUri(oldUri, newUri)
            }
          } catch {
            this.trackManager.replaceUri(oldUri, newUri)
          }
        }
      } catch (error) {
        Logger.error('Failed to process rename batch', error as Error)
      }
    }
  }
}
