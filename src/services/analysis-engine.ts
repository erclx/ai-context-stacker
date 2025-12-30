import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { TrackManager } from '../providers'
import { Logger } from '../utils'
import { StatsProcessor } from './stats-processor'

export class AnalysisEngine implements vscode.Disposable {
  private _onDidUpdateStats = new vscode.EventEmitter<void>()
  public readonly onDidUpdateStats = this._onDidUpdateStats.event

  private _onDidStatusChange = new vscode.EventEmitter<void>()
  public readonly onDidStatusChange = this._onDidStatusChange.event

  private statsProcessor: StatsProcessor
  private _isWarmingUp = true
  private _activeEnrichmentCount = 0
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []

  private readonly HIGH_PRIORITY_DEBOUNCE_MS = 400
  private readonly LOW_PRIORITY_DEBOUNCE_MS = 2000
  private currentDebounceMs = this.HIGH_PRIORITY_DEBOUNCE_MS

  private lastUiUpdate = 0
  private readonly UI_THROTTLE_MS = 100

  constructor(
    private context: vscode.ExtensionContext,
    private trackManager: TrackManager,
  ) {
    this.statsProcessor = new StatsProcessor(context)
    this.registerListeners()
  }

  public get isWarmingUp(): boolean {
    return this._isWarmingUp
  }

  public get isAnalyzing(): boolean {
    return this._activeEnrichmentCount > 0
  }

  public dispose(): void {
    this._onDidUpdateStats.dispose()
    this._onDidStatusChange.dispose()
    this.statsProcessor.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.clearAllPendingTimers()
  }

  public setExecutionPriority(isHighPriority: boolean): void {
    this.currentDebounceMs = isHighPriority ? this.HIGH_PRIORITY_DEBOUNCE_MS : this.LOW_PRIORITY_DEBOUNCE_MS
  }

  public notifyFilesAdded(): void {
    this._onDidUpdateStats.fire()
  }

  public async enrichActiveTrack(token?: vscode.CancellationToken): Promise<void> {
    if (token?.isCancellationRequested) return

    this._activeEnrichmentCount++
    this._onDidStatusChange.fire()
    this._onDidUpdateStats.fire()

    try {
      const files = this.trackManager.getActiveTrack().files
      if (files.length === 0) {
        this._isWarmingUp = false
        this._onDidUpdateStats.fire()
        return
      }

      await this.statsProcessor.enrichFileStatsProgressive(
        files,
        () => {
          const now = Date.now()
          if (now - this.lastUiUpdate > this.UI_THROTTLE_MS) {
            this._onDidUpdateStats.fire()
            this.lastUiUpdate = now
          }
        },
        token,
      )
    } catch (error) {
      Logger.error('Stats enrichment failed', error as Error)
    } finally {
      this._activeEnrichmentCount = Math.max(0, this._activeEnrichmentCount - 1)

      if (this._isWarmingUp && this._activeEnrichmentCount === 0) {
        this._isWarmingUp = false
      }

      this._onDidStatusChange.fire()
      this._onDidUpdateStats.fire()
    }
  }

  private registerListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),

      vscode.window.onDidChangeWindowState((state) => {
        if (!state.focused) {
          this.clearAllPendingTimers()
        }
      }),
    )
  }

  private handleDocChange(doc: vscode.TextDocument): void {
    const files = this.trackManager.getActiveTrack().files
    const target = files.find((f) => f.uri.toString() === doc.uri.toString())
    if (target) this.scheduleStatsUpdate(doc, target)
  }

  private scheduleStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    const key = doc.uri.toString()
    if (this.pendingUpdates.has(key)) clearTimeout(this.pendingUpdates.get(key)!)

    const timer = setTimeout(() => this.performStatsUpdate(doc, file), this.currentDebounceMs)
    this.pendingUpdates.set(key, timer)
  }

  private performStatsUpdate(doc: vscode.TextDocument, file: StagedFile): void {
    file.stats = this.statsProcessor.measure(doc.getText())
    this._onDidUpdateStats.fire()
    this.pendingUpdates.delete(doc.uri.toString())
  }

  private clearAllPendingTimers(): void {
    this.pendingUpdates.forEach(clearTimeout)
    this.pendingUpdates.clear()
  }
}
