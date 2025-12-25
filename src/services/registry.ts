import * as vscode from 'vscode'

import { IgnoreManager, StackProvider, TrackManager, TrackProvider } from '../providers'
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
    // 1. Instantiate Core Services
    this.ignoreManager = new IgnoreManager()
    this.trackManager = new TrackManager(context)

    // 2. Instantiate Providers with Dependencies
    this.stackProvider = new StackProvider(context, this.ignoreManager, this.trackManager)
    this.trackProvider = new TrackProvider(this.trackManager)
    this.fileWatcher = new FileWatcherService(this.trackManager)

    // 3. Configure Inter-Service Communication
    this.wireDependencies()

    // 4. Track Disposables
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
  public register(): void {
    this.context.subscriptions.push(...this._disposables)
  }

  public dispose(): void {
    this._disposables.forEach((d) => d.dispose())
  }

  private wireDependencies(): void {
    // Inject stack provider into track provider to enable live token stats in the track view
    this.trackProvider.setStackProvider(this.stackProvider)
  }
}
