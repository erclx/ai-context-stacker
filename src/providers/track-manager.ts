import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId } from '../utils'

/**
 * Manages the lifecycle of Context Tracks (groups of staged files).
 * Responsibilities:
 * - State persistence via VS Code WorkspaceState.
 * - Maintaining a high-performance O(1) lookup index for file existence checks.
 * - Handling track switching, creation, deletion, and reordering.
 */
export class TrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'
  private _trackOrder: string[] = []

  /** Global cache of all URIs across all tracks for fast existence checks. */
  private UriIndex = new Set<string>()
  private _isInitialized = false

  // Ghost object for UI safety when no tracks exist
  private readonly GHOST_TRACK: ContextTrack = { id: 'ghost', name: 'No Active Track', files: [] }

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.loadState()
  }

  get isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * Returns the currently selected track.
   * If state is empty, returns a safe "Ghost" track to prevent UI crashes.
   */
  getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.GHOST_TRACK
  }

  /**
   * Returns all tracks sorted by the user's custom order.
   */
  get allTracks(): ContextTrack[] {
    return this._trackOrder.map((id) => this.tracks.get(id)).filter((t): t is ContextTrack => t !== undefined)
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
   * Shifts a track up or down in the list.
   * Used for Context Menu actions.
   */
  moveTrackRelative(id: string, direction: 'up' | 'down'): void {
    const index = this._trackOrder.indexOf(id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1

    // Guard: Boundary checks
    if (newIndex < 0 || newIndex >= this._trackOrder.length) return

    // Swap positions
    const temp = this._trackOrder[newIndex]
    this._trackOrder[newIndex] = id
    this._trackOrder[index] = temp

    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  /**
   * Moves a track to a new position in the list (Drag and Drop).
   * @param sourceId - The ID of the track being moved.
   * @param targetId - The ID of the track to insert before. If undefined, move to end.
   */
  reorderTracks(sourceId: string, targetId: string | undefined): void {
    const fromIndex = this._trackOrder.indexOf(sourceId)
    if (fromIndex === -1) return

    // Remove from old position
    this._trackOrder.splice(fromIndex, 1)

    if (!targetId) {
      // Move to end
      this._trackOrder.push(sourceId)
    } else {
      // Insert before target
      const toIndex = this._trackOrder.indexOf(targetId)
      if (toIndex === -1) {
        this._trackOrder.push(sourceId)
      } else {
        this._trackOrder.splice(toIndex, 0, sourceId)
      }
    }

    this.persistState(false)
    // Fire event to trigger UI refresh (active track might not change, but tree does)
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
    this._trackOrder.push(id)
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
      void vscode.window.showWarningMessage('Cannot delete the last remaining track. Use "Delete All" to reset.')
      return
    }

    const wasActive = this.activeTrackId === id
    this.tracks.delete(id)
    this._trackOrder = this._trackOrder.filter((tid) => tid !== id)
    this.rebuildIndex()

    if (wasActive) {
      const nextId = this._trackOrder[0] || this.tracks.keys().next().value
      if (nextId) this.switchToTrack(nextId)
      else this.createDefaultTrack()
    } else {
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Nuke Option: Deletes ALL tracks and resets to a clean default state.
   */
  deleteAllTracks(): void {
    this.tracks.clear()
    this._trackOrder = []
    this.UriIndex.clear()
    this.activeTrackId = '' // No active track state

    // Persist the empty state so reload respects "clean slate"
    this.persistState(true)

    // Notify UI to refresh. Will return GHOST_TRACK.
    this._onDidChangeTrack.fire(this.getActiveTrack())
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
    let track = this.tracks.get(this.activeTrackId)

    // Recovery: If user adds files in "Clean Slate" mode, auto-create a track
    if (!track) {
      track = this.createDefaultTrack()
    }

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
    if (track === this.GHOST_TRACK) return

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
    if (track === this.GHOST_TRACK) return

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
    this._trackOrder = [def.id]
    this.activeTrackId = def.id
    this.updateContextKeys()
    return def
  }

  /**
   * Saves the current state to workspace storage.
   * @param rebuildIndexBeforeSave - If true, regenerates the global lookup index before saving.
   */
  private persistState(rebuildIndexBeforeSave = true): void {
    if (rebuildIndexBeforeSave) {
      this.rebuildIndex()
    }

    this.updateContextKeys()
    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId, this._trackOrder)
    this.extensionContext.workspaceState.update(TrackManager.STORAGE_KEY, state)
  }

  private loadState(): void {
    const rawState = this.extensionContext.workspaceState.get<SerializedState>(TrackManager.STORAGE_KEY)

    // Guard: First run (undefined state) -> Create Default
    if (rawState === undefined) {
      this.createDefaultTrack()
    } else {
      // Existing state (possibly empty) -> Load as-is
      const { tracks, activeTrackId, trackOrder } = StateMapper.fromSerialized(rawState)
      this.tracks = tracks
      this.activeTrackId = activeTrackId
      this._trackOrder = trackOrder

      this.syncOrderIntegrity()

      // Integrity check: If we have tracks but activeId is bad, fix it.
      if (this.tracks.size > 0 && !this.tracks.has(this.activeTrackId)) {
        this.activeTrackId = this._trackOrder[0] || 'default'
      }
    }

    this.rebuildIndex()

    // Mark initialization complete and propagate context keys
    this._isInitialized = true
    this.updateContextKeys()
  }

  private syncOrderIntegrity(): void {
    const trackIds = new Set(this.tracks.keys())
    const orderedIds = new Set(this._trackOrder)

    // Remove deleted IDs
    this._trackOrder = this._trackOrder.filter((id) => trackIds.has(id))

    // Add missing IDs (rare edge case)
    for (const id of trackIds) {
      if (!orderedIds.has(id)) {
        this._trackOrder.push(id)
      }
    }
  }

  /**
   * Updates context keys for UI visibility logic.
   * 'aiContextStacker.hasTracks': controls the visibility of menus/actions.
   * 'aiContextStacker.showWelcome': ATOMIC key for Welcome View visibility to prevent race conditions.
   */
  private updateContextKeys(): void {
    const hasTracks = this.tracks.size > 0
    // Strictly only show welcome if we are initialized AND have 0 tracks.
    // Defaults to false (undefined) during startup, preventing flickering.
    const showWelcome = this._isInitialized && !hasTracks

    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasTracks', hasTracks)
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.showWelcome', showWelcome)
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
