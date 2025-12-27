import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId } from '../utils'

export class TrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private readonly GHOST_TRACK: ContextTrack = { id: 'ghost', name: 'No Active Track', files: [] }

  private tracks = new Map<string, ContextTrack>()
  private activeTrackId = 'default'
  private _trackOrder: string[] = []
  private uriIndex = new Set<string>()
  private _isInitialized = false

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.hydrate()
  }

  public get isInitialized(): boolean {
    return this._isInitialized
  }

  public get allTracks(): ContextTrack[] {
    return this._trackOrder.map((id) => this.tracks.get(id)).filter((t): t is ContextTrack => t !== undefined)
  }

  public getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.GHOST_TRACK
  }

  public async switchToTrack(id: string): Promise<void> {
    if (!this.tracks.has(id)) return
    this.activeTrackId = id
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
    if (this.tracks.size <= 1) return
    const wasActive = this.activeTrackId === id
    this.tracks.delete(id)
    this._trackOrder = this._trackOrder.filter((tid) => tid !== id)
    this.rebuildIndex()

    if (wasActive) {
      const nextId = this._trackOrder[0] || 'default'
      if (!this.tracks.has(nextId)) this.createDefaultTrack()
      this.switchToTrack(nextId)
    } else {
      this.persistState(false)
      this._onDidChangeTrack.fire(this.getActiveTrack())
    }
  }

  public deleteAllTracks(): void {
    this.tracks.clear()
    this._trackOrder = []
    this.uriIndex.clear()
    this.createDefaultTrack()
    this.persistState(true)
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
      const toIndex = this._trackOrder.indexOf(targetId)
      if (toIndex === -1) this._trackOrder.push(sourceId)
      else this._trackOrder.splice(toIndex, 0, sourceId)
    }
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public toggleFilesPin(files: StagedFile[]): void {
    if (!files?.length) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public unpinAllInActive(): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return
    track.files.forEach((f) => (f.isPinned = false))
    this.persistState(false)
    this._onDidChangeTrack.fire(track)
  }

  public hasUri(uri: vscode.Uri): boolean {
    return this.uriIndex.has(uri.toString())
  }

  public removeUriEverywhere(uri: vscode.Uri): void {
    let changed = false
    const uriStr = uri.toString()
    for (const track of this.tracks.values()) {
      const len = track.files.length
      track.files = track.files.filter((f) => f.uri.toString() !== uriStr)
      if (track.files.length !== len) changed = true
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
      this.persistState()
    }
    return newFiles
  }

  public removeFilesFromActive(filesToRemove: StagedFile[]): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    const targets = new Set(filesToRemove.map((f) => f.uri.toString()))
    const initialLen = track.files.length

    track.files = track.files.filter((f) => !targets.has(f.uri.toString()))

    if (track.files.length !== initialLen) {
      this.rebuildIndex()
      this.persistState()
    }
  }

  public clearActive(): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    track.files = track.files.filter((f) => f.isPinned)
    this.rebuildIndex()
    this.persistState()
  }

  public dispose(): void {
    this._onDidChangeTrack.dispose()
  }

  private hydrate(): void {
    const raw = this.extensionContext.workspaceState.get<SerializedState>(TrackManager.STORAGE_KEY)
    if (raw) {
      this.restoreState(raw)
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
    this.validateStateIntegrity()
  }

  private validateStateIntegrity(): void {
    if (this.tracks.size > 0 && !this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this._trackOrder[0] || 'default'
    }
    const trackIds = new Set(this.tracks.keys())
    this._trackOrder = this._trackOrder.filter((id) => trackIds.has(id))
    for (const id of trackIds) {
      if (!this._trackOrder.includes(id)) this._trackOrder.push(id)
    }
  }

  private createDefaultTrack(): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }
    this.tracks.set(def.id, def)
    this._trackOrder = [def.id]
    this.activeTrackId = def.id
    return def
  }

  private persistState(rebuildIndex = true): void {
    if (rebuildIndex) this.rebuildIndex()
    this.updateContextKeys()
    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId, this._trackOrder)
    this.extensionContext.workspaceState.update(TrackManager.STORAGE_KEY, state)
  }

  private updateContextKeys(): void {
    const hasTracks = this.tracks.size > 0
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasTracks', hasTracks)
  }

  private rebuildIndex(): void {
    this.uriIndex.clear()
    for (const track of this.tracks.values()) {
      for (const file of track.files) {
        this.uriIndex.add(file.uri.toString())
      }
    }
  }

  private ensureActiveTrack(): ContextTrack {
    let track = this.tracks.get(this.activeTrackId)
    if (!track) track = this.createDefaultTrack()
    return track
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
}
