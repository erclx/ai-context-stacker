import * as vscode from 'vscode'

import { type ContextTrack, type SerializedState, type SerializedTrack, type StagedFile } from '../models'

/**
 * Manages multiple context tracks, handles persistence, and controls the active state.
 */
export class ContextTrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.loadState()
  }

  getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.createDefaultTrack()
  }

  get allTracks(): ContextTrack[] {
    return Array.from(this.tracks.values())
  }

  /**
   * Switches active track and triggers persistence + UI update.
   */
  async switchToTrack(id: string): Promise<void> {
    if (!this.tracks.has(id)) return
    this.activeTrackId = id
    this.persistState()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  createTrack(name: string): string {
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const newTrack: ContextTrack = { id, name, files: [] }

    this.tracks.set(id, newTrack)
    this.switchToTrack(id)
    return id
  }

  renameTrack(id: string, newName: string): void {
    const track = this.tracks.get(id)
    if (track) {
      track.name = newName
      this.persistState()
      this._onDidChangeTrack.fire(track)
    }
  }

  /**
   * Deletes track with safeguard to prevent removing last track.
   * Auto-switches to next available track if deleting active one.
   */
  deleteTrack(id: string): void {
    if (this.tracks.size <= 1) {
      vscode.window.showWarningMessage('Cannot delete the last remaining track.')
      return
    }

    const wasActive = this.activeTrackId === id
    this.tracks.delete(id)

    if (wasActive) {
      const nextId = this.tracks.keys().next().value
      if (nextId) this.switchToTrack(nextId)
      else this.createDefaultTrack()
    } else {
      this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Toggles the pinned state for one or more files.
   * Persists state only once after all toggles to avoid write thrashing.
   */
  toggleFilesPin(files: StagedFile[]): void {
    if (!files || files.length === 0) return

    files.forEach((f) => {
      f.isPinned = !f.isPinned
    })

    this.persistState()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  hasUri(uri: vscode.Uri): boolean {
    for (const track of this.tracks.values()) {
      if (track.files.some((f) => f.uri.toString() === uri.toString())) {
        return true
      }
    }
    return false
  }

  /**
   * Removes URI from all tracks (used by FileWatcher on delete events).
   */
  removeUriEverywhere(uri: vscode.Uri): void {
    let changed = false
    const uriStr = uri.toString()

    for (const track of this.tracks.values()) {
      const initialLength = track.files.length
      track.files = track.files.filter((f) => f.uri.toString() !== uriStr)
      if (track.files.length !== initialLength) changed = true
    }

    if (changed) {
      this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Updates URI references across all tracks (used by FileWatcher for renames).
   */
  replaceUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    let changed = false
    const oldStr = oldUri.toString()
    const newLabel = newUri.path.split('/').pop() || 'unknown'

    for (const track of this.tracks.values()) {
      const file = track.files.find((f) => f.uri.toString() === oldStr)
      if (file) {
        file.uri = newUri
        file.label = newLabel
        changed = true
      }
    }

    if (changed) {
      this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  addFilesToActive(uris: vscode.Uri[]): StagedFile[] {
    const track = this.getActiveTrack()
    const existing = new Set(track.files.map((f) => f.uri.toString()))

    const newFiles: StagedFile[] = uris
      .filter((u) => !existing.has(u.toString()))
      .map((uri) => ({
        type: 'file',
        uri,
        label: uri.path.split('/').pop() || 'unknown',
        isPinned: false,
      }))

    track.files.push(...newFiles)
    this.persistState()
    return newFiles
  }

  removeFilesFromActive(filesToRemove: StagedFile[]): void {
    const track = this.getActiveTrack()
    const idsToRemove = new Set(filesToRemove.map((f) => f.uri.fsPath))
    track.files = track.files.filter((f) => !idsToRemove.has(f.uri.fsPath))
    this.persistState()
  }

  /**
   * Clears non-pinned files from active track.
   */
  clearActive(): void {
    const track = this.getActiveTrack()
    track.files = track.files.filter((f) => f.isPinned)
    this.persistState()
  }

  private createDefaultTrack(): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }
    this.tracks.set(def.id, def)
    this.activeTrackId = def.id
    return def
  }

  /**
   * Persists current state to workspace storage.
   * Uses workspaceState (not globalState) to keep tracks workspace-specific.
   */
  private persistState(): void {
    const state: SerializedState = {
      activeTrackId: this.activeTrackId,
      tracks: {},
    }

    this.tracks.forEach((t) => {
      state.tracks[t.id] = {
        id: t.id,
        name: t.name,
        items: t.files.map((f) => ({
          uri: f.uri.toString(),
          isPinned: !!f.isPinned,
        })),
      }
    })

    this.extensionContext.workspaceState.update(ContextTrackManager.STORAGE_KEY, state)
  }

  /**
   * Loads persisted state from workspace storage on extension activation.
   */
  private loadState(): void {
    const state = this.extensionContext.workspaceState.get<SerializedState>(ContextTrackManager.STORAGE_KEY)

    if (!state || !state.tracks) {
      this.createDefaultTrack()
      return
    }

    Object.values(state.tracks).forEach((t) => {
      this.tracks.set(t.id, {
        id: t.id,
        name: t.name,
        files: this.deserializeFiles(t),
      })
    })

    this.activeTrackId = state.activeTrackId || 'default'
    if (!this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this.tracks.keys().next().value || 'default'
    }
  }

  /**
   * Deserializes files from storage.
   */
  private deserializeFiles(trackData: SerializedTrack): StagedFile[] {
    if (trackData.items) {
      return trackData.items.map((item) => ({
        type: 'file',
        uri: vscode.Uri.parse(item.uri),
        label: vscode.Uri.parse(item.uri).path.split('/').pop() || 'unknown',
        isPinned: item.isPinned,
      }))
    }

    return []
  }

  dispose() {
    this._onDidChangeTrack.dispose()
  }
}
