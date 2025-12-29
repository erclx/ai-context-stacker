import * as vscode from 'vscode'

import { IgnoreManager, StackProvider, TrackManager, TrackProvider } from '../providers'
import { Logger, LogLevel } from '../utils'
import { AnalysisEngine } from './analysis-engine'
import { ContextKeyService } from './context-key-service'
import { FileWatcherService } from './file-watcher'
import { PersistenceService } from './persistence-service'
import { TokenAggregatorService } from './token-aggregator'

export class ServiceRegistry implements vscode.Disposable {
  private static _instance: ServiceRegistry | undefined

  public readonly persistenceService: PersistenceService
  public readonly trackManager: TrackManager
  public readonly ignoreManager: IgnoreManager
  public readonly stackProvider: StackProvider
  public readonly trackProvider: TrackProvider
  public readonly fileWatcher: FileWatcherService
  public readonly analysisEngine: AnalysisEngine
  public readonly tokenAggregator: TokenAggregatorService
  public readonly contextKeyService: ContextKeyService

  private _disposables: vscode.Disposable[] = []

  constructor(private context: vscode.ExtensionContext) {
    ServiceRegistry._instance = this

    this.initializeLogger()

    this.persistenceService = new PersistenceService(context)
    this.ignoreManager = new IgnoreManager()
    this.contextKeyService = new ContextKeyService()

    this.trackManager = new TrackManager(context, this.persistenceService)

    this.analysisEngine = new AnalysisEngine(context, this.trackManager)
    this.tokenAggregator = new TokenAggregatorService(this.trackManager, this.analysisEngine)

    this.stackProvider = new StackProvider(
      context,
      this.ignoreManager,
      this.trackManager,
      this.analysisEngine,
      this.tokenAggregator,
      this.contextKeyService,
    )

    this.trackProvider = new TrackProvider(this.trackManager, this.tokenAggregator)

    this.fileWatcher = new FileWatcherService(this.trackManager)

    this.registerInternalDisposables()
  }

  public static disposeExisting(): void {
    if (!ServiceRegistry._instance) {
      return
    }
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

  private registerInternalDisposables(): void {
    this._disposables.push(
      this.persistenceService,
      this.ignoreManager,
      this.contextKeyService,
      this.trackManager,
      this.analysisEngine,
      this.tokenAggregator,
      this.stackProvider,
      this.trackProvider,
      this.fileWatcher,
      vscode.workspace.onDidChangeConfiguration((e) => this.handleConfigChange(e)),
    )
  }

  private initializeLogger(): void {
    const config = vscode.workspace.getConfiguration('aiContextStacker')
    const level = config.get<LogLevel>('logLevel') || 'INFO'
    Logger.configure('AI Context Stacker', level)
  }

  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (e.affectsConfiguration('aiContextStacker.logLevel')) {
      const config = vscode.workspace.getConfiguration('aiContextStacker')
      const level = config.get<LogLevel>('logLevel') || 'INFO'
      Logger.setLevel(level)
    }
  }
}
