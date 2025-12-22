import * as vscode from 'vscode'

import { IgnoreManager, StackProvider, TrackManager } from '../providers'
import { TrackProvider } from '../providers/track-provider'
import { FileWatcherService } from './file-watcher'

/**
 * Service Hub: Orchestrates the instantiation and lifecycle of core business services.
 * Acts as a Dependency Injection container for the extension.
 */
export class ServiceRegistry implements vscode.Disposable {
  public readonly trackManager: TrackManager
  public readonly ignoreManager: IgnoreManager
  public readonly stackProvider: StackProvider
  public readonly trackProvider: TrackProvider
  public readonly fileWatcher: FileWatcherService

  private _disposables: vscode.Disposable[] = []

  constructor(private context: vscode.ExtensionContext) {
    this.ignoreManager = new IgnoreManager()
    this.trackManager = new TrackManager(context)

    this.stackProvider = new StackProvider(context, this.ignoreManager, this.trackManager)
    this.trackProvider = new TrackProvider(this.trackManager)

    // Wire up live token stats
    this.trackProvider.setStackProvider(this.stackProvider)

    this.fileWatcher = new FileWatcherService(this.trackManager)

    this._disposables.push(
      this.ignoreManager,
      this.trackManager,
      this.stackProvider,
      this.trackProvider,
      this.fileWatcher,
    )
  }

  /**
   * Registers all managed services to the extension context subscription list.
   */
  public register(subscriptions: vscode.Disposable[]) {
    subscriptions.push(...this._disposables)
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose())
  }
}
