import * as vscode from 'vscode'

import { ContextStackProvider, ContextTrackManager, IgnorePatternProvider } from '../providers'
import { TrackListProvider } from '../providers/track-list-provider'
import { FileWatcherService } from './file-watcher'

/**
 * Service Hub: Orchestrates the instantiation and lifecycle of core business services.
 * Acts as a Dependency Injection container for the extension.
 */
export class ServiceRegistry implements vscode.Disposable {
  public readonly contextTrackManager: ContextTrackManager
  public readonly ignorePatternProvider: IgnorePatternProvider
  public readonly contextStackProvider: ContextStackProvider
  public readonly trackListProvider: TrackListProvider
  public readonly fileWatcher: FileWatcherService

  private _disposables: vscode.Disposable[] = []

  constructor(private context: vscode.ExtensionContext) {
    this.ignorePatternProvider = new IgnorePatternProvider()
    this.contextTrackManager = new ContextTrackManager(context)

    this.contextStackProvider = new ContextStackProvider(context, this.ignorePatternProvider, this.contextTrackManager)
    this.trackListProvider = new TrackListProvider(this.contextTrackManager)

    // Wire up live token stats
    this.trackListProvider.setStackProvider(this.contextStackProvider)

    this.fileWatcher = new FileWatcherService(this.contextTrackManager)

    this._disposables.push(
      this.ignorePatternProvider,
      this.contextTrackManager,
      this.contextStackProvider,
      this.trackListProvider,
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
