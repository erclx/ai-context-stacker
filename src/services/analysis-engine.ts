import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { TrackManager } from '../providers/track-manager'
import { Logger } from '../utils'
import { StatsProcessor } from './stats-processor'

export class AnalysisEngine implements vscode.Disposable {
  private _onDidUpdateStats = new vscode.EventEmitter<void>()
  public readonly onDidUpdateStats = this._onDidUpdateStats.event

  private _onDidStatusChange = new vscode.EventEmitter<void>()
  public readonly onDidStatusChange = this._onDidStatusChange.event

  private statsProcessor: StatsProcessor
  private _isWarmingUp = true
  private _enrichmentInProgress = false
  private pendingUpdates = new Map<string, NodeJS.Timeout>()
  private disposables: vscode.Disposable[] = []
  private readonly DEBOUNCE_MS = 400
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
    return this._enrichmentInProgress
  }

  public dispose(): void {
    this._onDidUpdateStats.dispose()
    this._onDidStatusChange.dispose()
    this.statsProcessor.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.clearAllPendingTimers()
  }

  public notifyFilesAdded(): void {
    void this.enrichActiveTrack()
  }

  public async enrichActiveTrack(): Promise<void> {
    if (this._enrichmentInProgress) return
    this._enrichmentInProgress = true

    this._onDidStatusChange.fire()
    this._onDidUpdateStats.fire()

    try {
      const files = this.trackManager.getActiveTrack().files
      if (files.length === 0) {
        this._isWarmingUp = false
        this._onDidUpdateStats.fire()
        return
      }

      await this.statsProcessor.enrichFileStatsProgressive(files, () => {
        const now = Date.now()
        if (now - this.lastUiUpdate > this.UI_THROTTLE_MS) {
          this._onDidUpdateStats.fire()
          this.lastUiUpdate = now
        }
      })
    } catch (error) {
      Logger.error('Stats enrichment failed', error as Error)
    } finally {
      if (this._isWarmingUp) {
        this._isWarmingUp = false
      }
      this._enrichmentInProgress = false

      this._onDidStatusChange.fire()
      this._onDidUpdateStats.fire()
    }
  }

  private registerListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.handleDocChange(e.document)),
      this.trackManager.onDidChangeTrack(() => {
        void this.enrichActiveTrack()
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

    const timer = setTimeout(() => this.performStatsUpdate(doc, file), this.DEBOUNCE_MS)
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
