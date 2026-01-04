import * as vscode from 'vscode'

import { IgnoreManager, StackProvider, TrackManager, TrackProvider } from '../providers'
import { Logger, LogLevel } from '../utils'
import { AnalysisEngine } from './analysis-engine'
import { ContextKeyService } from './context-key-service'
import { FileLifecycleService } from './file-lifecycle-service'
import { HydrationService } from './hydration-service'
import { PersistenceService } from './persistence-service'
import { TokenAggregatorService } from './token-aggregator'
import { TreeBuilder } from './tree-builder'
import { UriIndex } from './uri-index'

export class ServiceRegistry implements vscode.Disposable {
  private static _instance: ServiceRegistry | undefined

  public readonly persistenceService: PersistenceService
  public readonly hydrationService: HydrationService
  public readonly trackManager: TrackManager
  public readonly ignoreManager: IgnoreManager
  public readonly stackProvider: StackProvider
  public readonly trackProvider: TrackProvider
  public readonly fileLifecycleService: FileLifecycleService
  public readonly analysisEngine: AnalysisEngine
  public readonly tokenAggregator: TokenAggregatorService
  public readonly contextKeyService: ContextKeyService
  public readonly uriIndex: UriIndex
  public readonly treeBuilder: TreeBuilder

  private _disposables: vscode.Disposable[] = []
  private _isDisposed = false

  constructor(private context: vscode.ExtensionContext) {
    ServiceRegistry._instance = this

    this.initializeLogger()

    this.persistenceService = new PersistenceService(context)
    this.hydrationService = new HydrationService(this.persistenceService)
    this.ignoreManager = new IgnoreManager()
    this.contextKeyService = new ContextKeyService()
    this.uriIndex = new UriIndex()
    this.treeBuilder = new TreeBuilder()

    this.trackManager = new TrackManager(context, this.persistenceService, this.hydrationService, this.uriIndex)
    this.analysisEngine = new AnalysisEngine(context, this.trackManager)
    this.tokenAggregator = new TokenAggregatorService(this.trackManager, this.analysisEngine)

    this.stackProvider = new StackProvider(
      context,
      this.ignoreManager,
      this.trackManager,
      this.treeBuilder,
      this.analysisEngine,
      this.tokenAggregator,
      this.contextKeyService,
    )

    this.trackProvider = new TrackProvider(this.trackManager, this.tokenAggregator)
    this.fileLifecycleService = new FileLifecycleService(this.trackManager)

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
    this.context.subscriptions.push(this)
  }

  public dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true

    while (this._disposables.length) {
      const item = this._disposables.pop()
      if (item) {
        try {
          item.dispose()
        } catch (error) {
          Logger.error('Error disposing service', error as Error)
        }
      }
    }
    ServiceRegistry._instance = undefined
  }

  private registerInternalDisposables(): void {
    const tier1: vscode.Disposable[] = [
      this.persistenceService,
      this.ignoreManager,
      this.contextKeyService,
      this.uriIndex,
      vscode.workspace.onDidChangeConfiguration((e) => this.handleConfigChange(e)),
    ]

    const tier2: vscode.Disposable[] = [this.trackManager, this.analysisEngine, this.tokenAggregator]

    const tier3: vscode.Disposable[] = [this.stackProvider, this.trackProvider, this.fileLifecycleService]

    this._disposables.push(...tier1, ...tier2, ...tier3)
  }

  private initializeLogger(): void {
    const config = vscode.workspace.getConfiguration('aiContextStacker')
    const level = config.get<LogLevel>('logLevel') || 'INFO'
    Logger.configure('AI Context Stacker', level)
  }

  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    if (this._isDisposed) return

    if (e.affectsConfiguration('aiContextStacker.logLevel')) {
      const config = vscode.workspace.getConfiguration('aiContextStacker')
      const level = config.get<LogLevel>('logLevel') || 'INFO'
      Logger.setLevel(level)
    }
  }
}
