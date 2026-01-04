import * as vscode from 'vscode'

import { ContextTrack, SerializedState } from '../models'
import { Logger } from '../utils'
import { StateMapper } from './state-mapper'

export class PersistenceService implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private static readonly STORAGE_LIMIT_BYTES = 100_000
  private static readonly DEBOUNCE_MS = 500

  private _saveTimer: NodeJS.Timeout | undefined
  private _pendingSave: (() => Promise<void>) | undefined
  private _lastFingerprint: string | undefined

  constructor(private context: vscode.ExtensionContext) {}

  public async load(): Promise<SerializedState | undefined> {
    const start = Date.now()
    const raw = this.context.workspaceState.get<SerializedState>(PersistenceService.STORAGE_KEY)
    if (raw) {
      Logger.debug(`Storage read in ${Date.now() - start}ms`)
      this._lastFingerprint = this.generateFingerprintRaw(raw)
    }
    return raw
  }

  public requestSave(tracks: Map<string, ContextTrack>, activeId: string, order: string[]): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
    }

    this._pendingSave = async () => {
      await this.performSave(tracks, activeId, order)
      this._pendingSave = undefined
      this._saveTimer = undefined
    }

    this._saveTimer = setTimeout(() => {
      if (this._pendingSave) {
        void this._pendingSave()
      }
    }, PersistenceService.DEBOUNCE_MS)
  }

  public async saveImmediate(tracks: Map<string, ContextTrack>, activeId: string, order: string[]): Promise<void> {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = undefined
    }
    await this.performSave(tracks, activeId, order)
    this._pendingSave = undefined
  }

  public async clear(): Promise<void> {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = undefined
    }
    this._lastFingerprint = undefined
    await this.context.workspaceState.update(PersistenceService.STORAGE_KEY, undefined)
  }

  public dispose(): void {
    if (this._saveTimer && this._pendingSave) {
      Logger.info('Flushing pending save on dispose')
      clearTimeout(this._saveTimer)
      void this._pendingSave()
    }
  }

  private async performSave(tracks: Map<string, ContextTrack>, activeId: string, order: string[]): Promise<void> {
    try {
      const newFingerprint = this.generateFingerprint(tracks, activeId, order)
      if (newFingerprint === this._lastFingerprint) {
        return
      }

      const state = StateMapper.toSerialized(tracks, activeId, order)
      const json = JSON.stringify(state)
      const size = json.length

      if (size > PersistenceService.STORAGE_LIMIT_BYTES) {
        Logger.warn(
          `State size ${size} bytes exceeds limit of ${PersistenceService.STORAGE_LIMIT_BYTES}. Aborting save.`,
        )
        vscode.window.showWarningMessage('AI Context Stacker: State is too large to save. Please remove some files.')
        return
      }

      await new Promise((resolve) => setImmediate(resolve))

      await this.context.workspaceState.update(PersistenceService.STORAGE_KEY, state)
      this._lastFingerprint = newFingerprint
    } catch (error) {
      Logger.error('Failed to save state', error as Error)
    }
  }

  private generateFingerprint(tracks: Map<string, ContextTrack>, activeId: string, order: string[]): string {
    let hash = `${activeId}:${order.join(',')}`
    for (const track of tracks.values()) {
      hash += `:${track.id}:${track.files.length}`
    }
    return hash
  }

  private generateFingerprintRaw(state: SerializedState): string {
    const keys = Object.keys(state.tracks || {}).sort()
    let hash = `${state.activeTrackId}:${(state.trackOrder || []).join(',')}`
    for (const key of keys) {
      const t = state.tracks[key]
      hash += `:${t.id}:${t.items.length}`
    }
    return hash
  }
}
