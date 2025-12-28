import * as vscode from 'vscode'

import { ContextTrack } from '../models'
import { TrackManager } from '../providers'
import { Logger } from '../utils'

export class FileWatcherService implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined

  private watcherDisposables: vscode.Disposable[] = []

  private readonly disposables: vscode.Disposable[] = []

  constructor(private readonly trackManager: TrackManager) {
    this.registerHighLevelListeners()
    this.registerTrackListeners()

    this.rebuildWatcher(trackManager.getActiveTrack())
  }

  public dispose(): void {
    this.disposeWatcher()
    this.disposables.forEach((d) => d.dispose())
    Logger.info('FileWatcherService: Fully terminated.')
  }

  private registerHighLevelListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidRenameFiles((e) => {
        for (const { oldUri, newUri } of e.files) {
          this.trackManager.replaceUri(oldUri, newUri)
        }
      }),

      vscode.workspace.onDidDeleteFiles((e) => {
        for (const uri of e.files) {
          this.trackManager.removeUriEverywhere(uri)
        }
      }),
    )
  }

  private registerTrackListeners(): void {
    this.disposables.push(this.trackManager.onDidChangeTrack((track) => this.rebuildWatcher(track)))
  }

  private rebuildWatcher(track: ContextTrack): void {
    this.disposeWatcher()

    const paths = track.files.map((f) => f.uri.fsPath)
    if (paths.length === 0) return

    const globPattern = this.generateScopedGlob(paths)
    this.createScopedWatcher(globPattern)
  }

  private createScopedWatcher(pattern: string): void {
    try {
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern, true, true, false)

      const deleteListener = this.watcher.onDidDelete((uri) => {
        this.trackManager.removeUriEverywhere(uri)
        Logger.info(`External delete detected: ${uri.fsPath}`)
      })

      this.watcherDisposables.push(deleteListener)
      Logger.info('FileWatcherService: External delete guard active.')
    } catch (err) {
      Logger.error('Failed to create scoped watcher', err as Error)
    }
  }

  private disposeWatcher(): void {
    this.watcherDisposables.forEach((d) => d.dispose())
    this.watcherDisposables = []

    this.watcher?.dispose()
    this.watcher = undefined
  }

  private generateScopedGlob(paths: string[]): string {
    const sanitized = paths.map((p) => p.replace(/\\/g, '/'))
    return sanitized.length === 1 ? sanitized[0] : `{${sanitized.join(',')}}`
  }
}
