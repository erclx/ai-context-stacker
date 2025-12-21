import * as vscode from 'vscode'

import { type ContextTrack, type StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId } from '../utils'

/**
 * Manages multiple context tracks, handles persistence, and controls the active state.
 */
export class ContextTrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'

  private UriIndex = new Set<string>()

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

  async switchToTrack(id: string): Promise<void> {
    if (!this.tracks.has(id)) return
    this.activeTrackId = id
    this.persistState()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  createTrack(name: string): string {
    const id = generateId('track')
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

  toggleFilesPin(files: StagedFile[]): void {
    if (!files || files.length === 0) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    this.persistState()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  /**
   * Fast lookup to check if a URI is tracked in any context.
   * Essential for performance during high-frequency file system events.
   */
  hasUri(uri: vscode.Uri): boolean {
    return this.UriIndex.has(uri.toString())
  }

  /**
   * Removes a file from ALL tracks. Used when a file is deleted from disk.
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

  private persistState(): void {
    // Always rebuild index before saving/notifying to ensure consistency
    this.rebuildIndex()

    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId)
    this.extensionContext.workspaceState.update(ContextTrackManager.STORAGE_KEY, state)
  }

  private loadState(): void {
    const rawState = this.extensionContext.workspaceState.get<any>(ContextTrackManager.STORAGE_KEY)
    const { tracks, activeTrackId } = StateMapper.fromSerialized(rawState)

    this.tracks = tracks
    this.activeTrackId = activeTrackId

    // Ensure valid state
    if (this.tracks.size === 0) {
      this.createDefaultTrack()
    } else if (!this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this.tracks.keys().next().value || 'default'
    }

    this.rebuildIndex()
  }

  /**
   * Called automatically during state mutations.
   */
  private rebuildIndex(): void {
    this.UriIndex.clear()
    for (const track of this.tracks.values()) {
      for (const file of track.files) {
        this.UriIndex.add(file.uri.toString())
      }
    }
  }

  dispose() {
    this._onDidChangeTrack.dispose()
  }
}
