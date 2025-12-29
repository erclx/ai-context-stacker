import * as vscode from 'vscode'

import { StagedFile } from '../models'
import { TrackManager } from '../providers'
import { AnalysisEngine } from './analysis-engine'

export class TokenAggregatorService implements vscode.Disposable {
  private _onDidChange = new vscode.EventEmitter<number>()
  public readonly onDidChange = this._onDidChange.event

  private _totalTokens = 0
  private _disposables: vscode.Disposable[] = []

  constructor(
    private trackManager: TrackManager,
    private analysisEngine: AnalysisEngine,
  ) {
    this.registerListeners()
    this.recalculate()
  }

  public get totalTokens(): number {
    return this._totalTokens
  }

  public format(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  public dispose(): void {
    this._disposables.forEach((d) => d.dispose())
    this._onDidChange.dispose()
  }

  private registerListeners(): void {
    this._disposables.push(this.trackManager.onDidChangeTrack(() => this.recalculate()))

    this._disposables.push(this.analysisEngine.onDidUpdateStats(() => this.recalculate()))
  }

  private recalculate(): void {
    const activeTrack = this.trackManager.getActiveTrack()

    if (activeTrack.id === 'ghost') {
      if (this._totalTokens !== 0) {
        this._totalTokens = 0
        this._onDidChange.fire(0)
      }
      return
    }

    const files = activeTrack.files
    const newTotal = this.sumTokens(files)

    if (newTotal !== this._totalTokens) {
      this._totalTokens = newTotal
      this._onDidChange.fire(this._totalTokens)
    }
  }

  private sumTokens(files: StagedFile[]): number {
    return files.reduce((sum, file) => sum + (file.stats?.tokenCount ?? 0), 0)
  }
}
