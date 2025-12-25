import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId } from '../utils'

/**
 * Manages the lifecycle of Context Tracks (groups of staged files).
 */
export class TrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'

  private tracks: Map<string, ContextTrack> = new Map()
  private activeTrackId = 'default'
  private _trackOrder: string[] = []

  /** Global cache of all URIs across all tracks for fast existence checks. */
  private uriIndex = new Set<string>()
  private _isInitialized = false

  // Ghost object for UI safety when no tracks exist
  private readonly GHOST_TRACK: ContextTrack = { id: 'ghost', name: 'No Active Track', files: [] }

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.init()
  }

  public get isInitialized(): boolean {
    return this._isInitialized
  }

  public getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.GHOST_TRACK
  }

  public get allTracks(): ContextTrack[] {
    return this._trackOrder.map((id) => this.tracks.get(id)).filter((t): t is ContextTrack => t !== undefined)
  }

  public async switchToTrack(id: string): Promise<void> {
    if (!this.tracks.has(id)) return
    this.activeTrackId = id
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public moveTrackRelative(id: string, direction: 'up' | 'down'): void {
    const index = this._trackOrder.indexOf(id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= this._trackOrder.length) return

    const temp = this._trackOrder[newIndex]
    this._trackOrder[newIndex] = id
    this._trackOrder[index] = temp

    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public reorderTracks(sourceId: string, targetId: string | undefined): void {
    const fromIndex = this._trackOrder.indexOf(sourceId)
    if (fromIndex === -1) return

    this._trackOrder.splice(fromIndex, 1)

    if (!targetId) {
      this._trackOrder.push(sourceId)
    } else {
      this.insertTrackAtTarget(sourceId, targetId)
    }

    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public createTrack(name: string): string {
    const id = generateId('track')
    const newTrack: ContextTrack = { id, name, files: [] }

    this.tracks.set(id, newTrack)
    this._trackOrder.push(id)
    this.switchToTrack(id)
    return id
  }

  public renameTrack(id: string, newName: string): void {
    const track = this.tracks.get(id)
    if (!track) return

    track.name = newName
    this.persistState(false)
    this._onDidChangeTrack.fire(track)
  }

  public deleteTrack(id: string): void {
    if (this.tracks.size <= 1) {
      void vscode.window.showWarningMessage('Cannot delete the last remaining track. Use "Delete All" to reset.')
      return
    }

    const wasActive = this.activeTrackId === id
    this.performDeletion(id)

    if (wasActive) {
      this.handleActiveTrackDeletion()
    } else {
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  /**
   * Nuke Option: Deletes ALL tracks and resets to a clean default state.
   */
  public deleteAllTracks(): void {
    this.tracks.clear()
    this._trackOrder = []
    this.uriIndex.clear()
    this.activeTrackId = ''

    this.persistState(true)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public toggleFilesPin(files: StagedFile[]): void {
    if (!files || files.length === 0) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public hasUri(uri: vscode.Uri): boolean {
    return this.uriIndex.has(uri.toString())
  }

  public removeUriEverywhere(uri: vscode.Uri): void {
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

  public replaceUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
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

  public addFilesToActive(uris: vscode.Uri[]): StagedFile[] {
    const track = this.ensureActiveTrack()
    const newFiles = this.filterNewFiles(track, uris)

    if (newFiles.length > 0) {
      track.files.push(...newFiles)
      this.rebuildIndex()
      this.persistState(false)
    }

    return newFiles
  }

  public removeFilesFromActive(filesToRemove: StagedFile[]): void {
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

  public clearActive(): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    const oldLength = track.files.length
    track.files = track.files.filter((f) => f.isPinned)

    if (track.files.length !== oldLength) {
      this.rebuildIndex()
      this.persistState(false)
    }
  }

  public dispose(): void {
    this._onDidChangeTrack.dispose()
  }

  // --- Internal Implementation ---

  private init(): void {
    const rawState = this.extensionContext.workspaceState.get<SerializedState>(TrackManager.STORAGE_KEY)

    if (rawState) {
      this.restoreState(rawState)
    } else {
      this.createDefaultTrack()
    }

    this.rebuildIndex()
    this._isInitialized = true
    this.updateContextKeys()
  }

  private restoreState(rawState: SerializedState): void {
    const { tracks, activeTrackId, trackOrder } = StateMapper.fromSerialized(rawState)
    this.tracks = tracks
    this.activeTrackId = activeTrackId
    this._trackOrder = trackOrder

    this.syncOrderIntegrity()
    this.ensureActiveTrackValidity()
  }

  private ensureActiveTrackValidity(): void {
    if (this.tracks.size > 0 && !this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this._trackOrder[0] || 'default'
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

  private ensureActiveTrack(): ContextTrack {
    let track = this.tracks.get(this.activeTrackId)
    if (!track) {
      track = this.createDefaultTrack()
    }
    return track
  }

  private insertTrackAtTarget(sourceId: string, targetId: string): void {
    const toIndex = this._trackOrder.indexOf(targetId)
    if (toIndex === -1) {
      this._trackOrder.push(sourceId)
    } else {
      this._trackOrder.splice(toIndex, 0, sourceId)
    }
  }

  private performDeletion(id: string): void {
    this.tracks.delete(id)
    this._trackOrder = this._trackOrder.filter((tid) => tid !== id)
    this.rebuildIndex()
  }

  private handleActiveTrackDeletion(): void {
    const nextId = this._trackOrder[0] || this.tracks.keys().next().value
    if (nextId) {
      this.switchToTrack(nextId)
    } else {
      this.createDefaultTrack()
    }
  }

  private filterNewFiles(track: ContextTrack, uris: vscode.Uri[]): StagedFile[] {
    const existing = new Set(track.files.map((f) => f.uri.toString()))
    return uris
      .filter((u) => !existing.has(u.toString()))
      .map((uri) => ({
        type: 'file',
        uri,
        label: uri.path.split('/').pop() || 'unknown',
        isPinned: false,
      }))
  }

  private persistState(rebuildIndexBeforeSave = true): void {
    if (rebuildIndexBeforeSave) {
      this.rebuildIndex()
    }

    this.updateContextKeys()
    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId, this._trackOrder)
    this.extensionContext.workspaceState.update(TrackManager.STORAGE_KEY, state)
  }

  private syncOrderIntegrity(): void {
    const trackIds = new Set(this.tracks.keys())
    const orderedIds = new Set(this._trackOrder)

    // Remove deleted IDs and add missing ones
    this._trackOrder = this._trackOrder.filter((id) => trackIds.has(id))
    for (const id of trackIds) {
      if (!orderedIds.has(id)) {
        this._trackOrder.push(id)
      }
    }
  }

  private updateContextKeys(): void {
    const hasTracks = this.tracks.size > 0
    const showWelcome = this._isInitialized && !hasTracks

    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasTracks', hasTracks)
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.showWelcome', showWelcome)
  }

  private rebuildIndex(): void {
    this.uriIndex.clear()
    for (const track of this.tracks.values()) {
      for (const file of track.files) {
        this.uriIndex.add(file.uri.toString())
      }
    }
  }
}
