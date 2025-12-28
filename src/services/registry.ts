import * as vscode from 'vscode'

import { IgnoreManager, StackProvider, TrackManager, TrackProvider } from '../providers'
import { Logger } from '../utils'
import { FileWatcherService } from './file-watcher'

export class ServiceRegistry implements vscode.Disposable {
  private static _instance: ServiceRegistry | undefined

  public readonly trackManager: TrackManager
  public readonly ignoreManager: IgnoreManager
  public readonly stackProvider: StackProvider
  public readonly trackProvider: TrackProvider
  public readonly fileWatcher: FileWatcherService

  private _disposables: vscode.Disposable[] = []

  constructor(private context: vscode.ExtensionContext) {
    ServiceRegistry._instance = this

    this.ignoreManager = new IgnoreManager()
    this.trackManager = new TrackManager(context)
    this.stackProvider = new StackProvider(context, this.ignoreManager, this.trackManager)
    this.trackProvider = new TrackProvider(this.trackManager)
    this.fileWatcher = new FileWatcherService(this.trackManager)

    this.wireDependencies()
    this.registerInternalDisposables()
  }

  public static disposeExisting(): void {
    if (!ServiceRegistry._instance) return
    try {
      ServiceRegistry._instance.dispose()
    } catch (error) {
      Logger.error('Failed to kill zombie registry', error as Error)
    } finally {
      ServiceRegistry._instance = undefined
    }
  }

  public register(): void {
    this.context.subscriptions.push(...this._disposables)
  }

  public dispose(): void {
    this._disposables.forEach((d) => d.dispose())
    ServiceRegistry._instance = undefined
  }

  private wireDependencies(): void {
    this.trackProvider.setStackProvider(this.stackProvider)
  }

  private registerInternalDisposables(): void {
    this._disposables.push(
      this.ignoreManager,
      this.trackManager,
      this.stackProvider,
      this.trackProvider,
      this.fileWatcher,
    )
  }
}
