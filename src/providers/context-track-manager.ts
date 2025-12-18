import * as vscode from 'vscode'

import { type ContextTrack, type SerializedState, type StagedFile } from '../models'

/**
 * Manages multiple context tracks, handles persistence, and controls the active state.
 */
export class ContextTrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private context: vscode.ExtensionContext) {
    this.loadState()
  }

  getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.createDefaultTrack()
  }

  get allTracks(): ContextTrack[] {
    return Array.from(this.tracks.values())
  }

  /**
   * Switches the active context track.
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
    this.switchToTrack(id) // Auto-switch to new track
    return id
  }

  renameTrack(id: string, newName: string): void {
    const track = this.tracks.get(id)
    if (track) {
      track.name = newName
      this.persistState()
      this._onDidChangeTrack.fire(track) // Trigger refresh to update UI labels
    }
  }

  deleteTrack(id: string): void {
    // 1. Prevent deleting the last track
    if (this.tracks.size <= 1) {
      vscode.window.showWarningMessage('Cannot delete the last remaining track.')
      return
    }

    this.tracks.delete(id)

    // 2. If we deleted the active track, switch to the first available one
    if (this.activeTrackId === id) {
      const nextId = this.tracks.keys().next().value

      // FIX: Explicit check to satisfy TypeScript strictness
      if (nextId) {
        this.switchToTrack(nextId)
      } else {
        // Fallback (should be unreachable due to check #1)
        this.createDefaultTrack()
      }
    } else {
      this.persistState()
    }
  }

  /**
   * Checks if a URI exists in ANY track.
   * Used by the file watcher to determine if an event is relevant.
   */
  hasUri(uri: vscode.Uri): boolean {
    for (const track of this.tracks.values()) {
      if (track.files.some((f) => f.uri.toString() === uri.toString())) {
        return true
      }
    }
    return false
  }

  /**
   * Removes a file from ALL tracks (e.g., on deletion).
   */
  removeUriEverywhere(uri: vscode.Uri): void {
    let changed = false
    const uriStr = uri.toString()

    for (const track of this.tracks.values()) {
      const initialLength = track.files.length
      track.files = track.files.filter((f) => f.uri.toString() !== uriStr)

      if (track.files.length !== initialLength) {
        changed = true
      }
    }

    if (changed) {
      this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Updates a file's URI in ALL tracks (e.g., on rename).
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
        // We do NOT clear stats here; content is likely identical (rename/move)
        changed = true
      }
    }

    if (changed) {
      this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Delegates file addition to the active track.
   * Returns the newly created StagedFile objects for the provider to enrich.
   */
  addFilesToActive(uris: vscode.Uri[]): StagedFile[] {
    const track = this.getActiveTrack()
    const existing = new Set(track.files.map((f) => f.uri.toString()))

    const newFiles: StagedFile[] = uris
      .filter((u) => !existing.has(u.toString()))
      .map((uri) => ({
        uri,
        label: uri.path.split('/').pop() || 'unknown',
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

  clearActive(): void {
    const track = this.getActiveTrack()
    track.files = []
    this.persistState()
  }

  private createDefaultTrack(): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }
    this.tracks.set(def.id, def)
    this.activeTrackId = def.id
    return def
  }

  private persistState(): void {
    const state: SerializedState = {
      activeTrackId: this.activeTrackId,
      tracks: {},
    }

    this.tracks.forEach((t) => {
      state.tracks[t.id] = {
        id: t.id,
        name: t.name,
        uris: t.files.map((f) => f.uri.toString()),
      }
    })

    this.context.workspaceState.update(ContextTrackManager.STORAGE_KEY, state)
  }

  private loadState(): void {
    const state = this.context.workspaceState.get<SerializedState>(ContextTrackManager.STORAGE_KEY)

    if (!state || !state.tracks) {
      this.createDefaultTrack()
      return
    }

    Object.values(state.tracks).forEach((t) => {
      this.tracks.set(t.id, {
        id: t.id,
        name: t.name,
        files: t.uris.map((u) => ({
          uri: vscode.Uri.parse(u),
          label: vscode.Uri.parse(u).path.split('/').pop() || 'unknown',
        })),
      })
    })

    this.activeTrackId = state.activeTrackId || 'default'

    // Fallback if active ID is corrupt
    if (!this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this.tracks.keys().next().value || 'default'
    }
  }

  dispose() {
    this._onDidChangeTrack.dispose()
  }
}
