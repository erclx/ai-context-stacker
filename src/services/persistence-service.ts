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
  private _lastFingerprint: number = 0

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
    this._lastFingerprint = 0
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

  private generateFingerprint(tracks: Map<string, ContextTrack>, activeId: string, order: string[]): number {
    let hash = 5381

    hash = this.updateHash(hash, activeId)
    for (const id of order) {
      hash = this.updateHash(hash, id)
    }

    for (const track of tracks.values()) {
      hash = this.updateHash(hash, track.id)
      for (const file of track.files) {
        hash = this.updateHash(hash, file.uri.toString())
      }
    }

    return hash >>> 0
  }

  private generateFingerprintRaw(state: SerializedState): number {
    let hash = 5381
    const order = state.trackOrder || []

    hash = this.updateHash(hash, state.activeTrackId || 'default')
    for (const id of order) {
      hash = this.updateHash(hash, id)
    }

    const tracks = state.tracks || {}
    const trackKeys = Object.keys(tracks).sort()

    for (const key of trackKeys) {
      const t = tracks[key]
      hash = this.updateHash(hash, t.id)
      if (t.items && Array.isArray(t.items)) {
        for (const item of t.items) {
          hash = this.updateHash(hash, item.uri)
        }
      }
    }

    return hash >>> 0
  }

  private updateHash(hash: number, str: string): number {
    let i = str.length
    while (i) {
      hash = (hash * 33) ^ str.charCodeAt(--i)
    }
    return hash
  }
}
