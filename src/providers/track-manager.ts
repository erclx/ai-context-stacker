import * as vscode from 'vscode'

import { ContextTrack, StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId } from '../utils'

/**
 * Manages the lifecycle of Context Tracks (groups of staged files).
 * Responsibilities:
 * - State persistence via VS Code WorkspaceState.
 * - maintaining a high-performance O(1) lookup index for file existence checks.
 * - Handling track switching, creation, and deletion logic.
 */
export class TrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'

  /** Global cache of all URIs across all tracks for fast existence checks. */
  private UriIndex = new Set<string>()

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.loadState()
  }

  /**
   * Returns the currently selected track.
   * Creates a default track if the state is corrupted or empty.
   */
  getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.createDefaultTrack()
  }

  get allTracks(): ContextTrack[] {
    return Array.from(this.tracks.values())
  }

  /**
   * Switches the active context context.
   * Persists state immediately but skips index rebuilding since files haven't changed.
   * @param id - The ID of the track to switch to.
   */
  async switchToTrack(id: string): Promise<void> {
    if (!this.tracks.has(id)) return
    this.activeTrackId = id
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  /**
   * Creates a new empty track and switches to it.
   * @param name - Display name for the new track.
   * @returns The generated unique ID of the new track.
   */
  createTrack(name: string): string {
    const id = generateId('track')
    const newTrack: ContextTrack = { id, name, files: [] }

    this.tracks.set(id, newTrack)
    this.switchToTrack(id)
    return id
  }

  /**
   * Renames a track without modifying its contents.
   */
  renameTrack(id: string, newName: string): void {
    const track = this.tracks.get(id)
    if (track) {
      track.name = newName
      this.persistState(false)
      this._onDidChangeTrack.fire(track)
    }
  }

  /**
   * Deletes a track by ID.
   * Prevents deletion if it is the last remaining track.
   * If the active track is deleted, switches to the next available track.
   */
  deleteTrack(id: string): void {
    if (this.tracks.size <= 1) {
      vscode.window.showWarningMessage('Cannot delete the last remaining track.')
      return
    }

    const wasActive = this.activeTrackId === id
    this.tracks.delete(id)
    this.rebuildIndex()

    if (wasActive) {
      const nextId = this.tracks.keys().next().value
      if (nextId) this.switchToTrack(nextId)
      else this.createDefaultTrack()
    } else {
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Toggles the pinned state of specific files.
   * Pinned files survive the "Clear Active" command.
   */
  toggleFilesPin(files: StagedFile[]): void {
    if (!files || files.length === 0) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  /**
   * O(1) check if a URI exists in ANY track.
   */
  hasUri(uri: vscode.Uri): boolean {
    return this.UriIndex.has(uri.toString())
  }

  /**
   * Removes a file from all tracks globally.
   * Used when a file is deleted from the disk or strictly excluded.
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
      this.rebuildIndex()
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Updates a file's URI across all tracks.
   * Essential for handling file rename events from VS Code.
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
      this.rebuildIndex()
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Adds new files to the currently active track.
   * Automatically deduplicates files that are already present.
   */
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

    if (newFiles.length > 0) {
      track.files.push(...newFiles)
      this.rebuildIndex()
      this.persistState(false)
    }

    return newFiles
  }

  /**
   * Removes specific files from the active track.
   */
  removeFilesFromActive(filesToRemove: StagedFile[]): void {
    const track = this.getActiveTrack()
    const idsToRemove = new Set(filesToRemove.map((f) => f.uri.fsPath))
    const oldLength = track.files.length

    track.files = track.files.filter((f) => !idsToRemove.has(f.uri.fsPath))

    if (track.files.length !== oldLength) {
      this.rebuildIndex()
      this.persistState(false)
    }
  }

  /**
   * Removes all non-pinned files from the active track.
   */
  clearActive(): void {
    const track = this.getActiveTrack()
    const oldLength = track.files.length

    track.files = track.files.filter((f) => f.isPinned)

    if (track.files.length !== oldLength) {
      this.rebuildIndex()
      this.persistState(false)
    }
  }

  private createDefaultTrack(): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }
    this.tracks.set(def.id, def)
    this.activeTrackId = def.id
    return def
  }

  /**
   * Saves the current state to workspace storage.
   * @param rebuildIndexBeforeSave - If true, regenerates the global lookup index before saving.
   * Set to false if the index was already updated by the caller.
   */
  private persistState(rebuildIndexBeforeSave = true): void {
    if (rebuildIndexBeforeSave) {
      this.rebuildIndex()
    }

    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId)
    this.extensionContext.workspaceState.update(TrackManager.STORAGE_KEY, state)
  }

  private loadState(): void {
    const rawState = this.extensionContext.workspaceState.get<any>(TrackManager.STORAGE_KEY)
    const { tracks, activeTrackId } = StateMapper.fromSerialized(rawState)

    this.tracks = tracks
    this.activeTrackId = activeTrackId

    if (this.tracks.size === 0) {
      this.createDefaultTrack()
    } else if (!this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this.tracks.keys().next().value || 'default'
    }

    this.rebuildIndex()
  }

  /**
   * Rebuilds the global set of URIs from all tracks.
   * This allows `hasUri()` to remain O(1) regardless of track size.
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
