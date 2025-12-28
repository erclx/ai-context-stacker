import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { StateMapper } from '../services'
import { generateId, Logger } from '../utils'

export class TrackManager implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'aiContextStacker.tracks.v1'
  private static readonly STORAGE_LIMIT_BYTES = 100_000
  private readonly GHOST_TRACK: ContextTrack = { id: 'ghost', name: 'No Active Track', files: [] }

  private tracks = new Map<string, ContextTrack>()
  private activeTrackId = 'default'
  private _trackOrder: string[] = []
  private uriRefCount = new Map<string, number>()
  private _isInitialized = false

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(private context: vscode.ExtensionContext) {
    this.scheduleAsyncHydration()
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
    await this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public createTrack(name: string): string {
    const id = generateId('track')
    this.tracks.set(id, { id, name, files: [] })
    this._trackOrder.push(id)
    void this.switchToTrack(id)
    return id
  }

  public renameTrack(id: string, newName: string): void {
    const track = this.tracks.get(id)
    if (!track) return
    track.name = newName
    void this.persistState(false)
    this._onDidChangeTrack.fire(track)
  }

  public deleteTrack(id: string): void {
    if (this.tracks.size <= 1) return

    this.decrementIndex(this.tracks.get(id)?.files || [])
    this.tracks.delete(id)
    this._trackOrder = this._trackOrder.filter((tid) => tid !== id)
    this.handleTrackDeletion(id)
  }

  public deleteAllTracks(): void {
    void this.hardReset()
  }

  public async hardReset(): Promise<void> {
    Logger.warn('Hard Reset initiated.')

    this.tracks.clear()
    this._trackOrder = []
    this.uriRefCount.clear()

    await this.context.workspaceState.update(TrackManager.STORAGE_KEY, undefined)

    this.createDefaultTrack()
    await this.persistState(true)

    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public moveTrackRelative(id: string, direction: 'up' | 'down'): void {
    const index = this._trackOrder.indexOf(id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= this._trackOrder.length) return

    this.swapTracks(index, newIndex)
  }

  public reorderTracks(sourceId: string, targetId: string | undefined): void {
    const fromIndex = this._trackOrder.indexOf(sourceId)
    if (fromIndex === -1) return

    this._trackOrder.splice(fromIndex, 1)
    this.insertTrackAtTarget(sourceId, targetId)

    void this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public toggleFilesPin(files: StagedFile[]): void {
    if (!files?.length) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    void this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  public unpinAllInActive(): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    track.files.forEach((f) => (f.isPinned = false))
    void this.persistState(false)
    this._onDidChangeTrack.fire(track)
  }

  public hasUri(uri: vscode.Uri): boolean {
    return (this.uriRefCount.get(uri.toString()) ?? 0) > 0
  }

  public removeUriEverywhere(uri: vscode.Uri): void {
    const uriStr = uri.toString()
    let changed = false

    for (const track of this.tracks.values()) {
      const prevLen = track.files.length
      track.files = track.files.filter((f) => f.uri.toString() !== uriStr)
      if (track.files.length !== prevLen) changed = true
    }

    if (changed) this.finalizeChange()
  }

  public replaceUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldStr = oldUri.toString()
    let changed = false

    for (const track of this.tracks.values()) {
      const file = track.files.find((f) => f.uri.toString() === oldStr)
      if (file) {
        this.updateFileUri(file, newUri)
        changed = true
      }
    }

    if (changed) this.finalizeChange()
  }

  public addFilesToActive(uris: vscode.Uri[]): StagedFile[] {
    const track = this.ensureActiveTrack()
    const newFiles = this.filterNewFiles(track, uris)

    if (newFiles.length > 0) {
      track.files.push(...newFiles)
      this.incrementIndex(newFiles)
      void this.persistState()
    }
    return newFiles
  }

  public removeFilesFromActive(files: StagedFile[]): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    this.decrementIndex(files)
    const targets = new Set(files.map((f) => f.uri.toString()))
    track.files = track.files.filter((f) => !targets.has(f.uri.toString()))

    void this.persistState()
  }

  public clearActive(): void {
    const track = this.getActiveTrack()
    if (track === this.GHOST_TRACK) return

    const removed = track.files.filter((f) => !f.isPinned)
    this.decrementIndex(removed)
    track.files = track.files.filter((f) => f.isPinned)

    void this.persistState()
  }

  public dispose(): void {
    this._onDidChangeTrack.dispose()
  }

  private scheduleAsyncHydration(): void {
    setTimeout(() => void this.performHydration(), 10)
  }

  private async performHydration(): Promise<void> {
    const raw = this.context.workspaceState.get<SerializedState>(TrackManager.STORAGE_KEY)

    if (raw) this.restoreState(raw)
    else this.createDefaultTrack()

    this.rebuildFullIndex()
    this._isInitialized = true
    this.updateContextKeys()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  private restoreState(rawState: SerializedState): void {
    const { tracks, activeTrackId, trackOrder } = StateMapper.fromSerialized(rawState)
    this.tracks = tracks
    this.activeTrackId = activeTrackId
    this._trackOrder = trackOrder
    this.validateStateIntegrity()
  }

  private async persistState(rebuildIndex = true): Promise<void> {
    if (rebuildIndex) this.rebuildFullIndex()
    this.updateContextKeys()

    const state = StateMapper.toSerialized(this.tracks, this.activeTrackId, this._trackOrder)

    if (this.isStateTooLarge(state)) {
      Logger.warn('State exceeds 100KB limit. Aborting save to prevent UI deadlock.')
      return
    }

    await this.context.workspaceState.update(TrackManager.STORAGE_KEY, state)
  }

  private isStateTooLarge(state: SerializedState): boolean {
    const size = JSON.stringify(state).length
    return size > TrackManager.STORAGE_LIMIT_BYTES
  }

  private rebuildFullIndex(): void {
    this.uriRefCount.clear()
    for (const track of this.tracks.values()) {
      this.incrementIndex(track.files)
    }
  }

  private incrementIndex(files: StagedFile[]): void {
    for (const f of files) {
      const key = f.uri.toString()
      this.uriRefCount.set(key, (this.uriRefCount.get(key) || 0) + 1)
    }
  }

  private decrementIndex(files: StagedFile[]): void {
    for (const f of files) {
      const key = f.uri.toString()
      const current = this.uriRefCount.get(key) || 0
      if (current > 1) this.uriRefCount.set(key, current - 1)
      else this.uriRefCount.delete(key)
    }
  }

  private finalizeChange(): void {
    this.rebuildFullIndex()
    void this.persistState()
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  private updateContextKeys(): void {
    const hasTracks = this.tracks.size > 0
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.hasTracks', hasTracks)
    void vscode.commands.executeCommand('setContext', 'aiContextStacker.canReset', this.calculateCanReset())
  }

  private calculateCanReset(): boolean {
    if (this.tracks.size > 1) return true

    const track = this.tracks.values().next().value
    if (!track) return false

    return track.files.length > 0 || track.name !== 'Main'
  }

  private createDefaultTrack(): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }
    this.tracks.set(def.id, def)
    this._trackOrder = [def.id]
    this.activeTrackId = def.id
    return def
  }

  private swapTracks(idxA: number, idxB: number): void {
    const temp = this._trackOrder[idxB]
    this._trackOrder[idxB] = this._trackOrder[idxA]
    this._trackOrder[idxA] = temp
    void this.persistState(false)
    this._onDidChangeTrack.fire(this.getActiveTrack())
  }

  private insertTrackAtTarget(sourceId: string, targetId: string | undefined): void {
    if (!targetId) {
      this._trackOrder.push(sourceId)
      return
    }
    const toIndex = this._trackOrder.indexOf(targetId)
    this._trackOrder.splice(toIndex === -1 ? 0 : toIndex, 0, sourceId)
  }

  private updateFileUri(file: StagedFile, newUri: vscode.Uri): void {
    file.uri = newUri
    file.label = newUri.path.split('/').pop() || 'unknown'
  }

  private ensureActiveTrack(): ContextTrack {
    let track = this.tracks.get(this.activeTrackId)
    if (!track) track = this.createDefaultTrack()
    return track
  }

  private validateStateIntegrity(): void {
    if (this.tracks.size > 0 && !this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this._trackOrder[0] || 'default'
    }
  }

  private handleTrackDeletion(deletedId: string): void {
    if (this.activeTrackId === deletedId) {
      const nextId = this._trackOrder[0] || 'default'
      if (!this.tracks.has(nextId)) this.createDefaultTrack()
      void this.switchToTrack(nextId)
    } else {
      void this.persistState()
      this._onDidChangeTrack.fire(this.getActiveTrack())
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
}
