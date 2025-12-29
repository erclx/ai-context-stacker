import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { PersistenceService } from '../services'
import { generateId, Logger } from '../utils'
import { isChildOf } from '../utils/file-scanner'

export class TrackManager implements vscode.Disposable {
  private readonly NULL_TRACK: ContextTrack = { id: 'ghost', name: 'No Active Track', files: [] }

  private tracks = new Map<string, ContextTrack>()
  private activeTrackId = 'default'
  private _trackOrder: string[] = []
  private uriRefCount = new Map<string, number>()

  private _isInitialized = false
  private _isDisposed = false
  private _hydrationTimer: NodeJS.Timeout | undefined

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(
    private context: vscode.ExtensionContext,
    private persistence: PersistenceService,
  ) {
    this.scheduleAsyncHydration()
  }

  public get isInitialized(): boolean {
    return this._isInitialized
  }

  public get allTracks(): ContextTrack[] {
    return this._trackOrder.map((id) => this.tracks.get(id)).filter((t): t is ContextTrack => t !== undefined)
  }

  public getActiveTrack(): ContextTrack {
    return this.tracks.get(this.activeTrackId) || this.NULL_TRACK
  }

  public dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true

    if (this._hydrationTimer) {
      clearTimeout(this._hydrationTimer)
      this._hydrationTimer = undefined
    }

    this._onDidChangeTrack.dispose()
    Logger.debug('TrackManager disposed.')
  }

  public async switchToTrack(id: string): Promise<void> {
    if (this._isDisposed || !this.tracks.has(id)) return
    this.activeTrackId = id
    await this.persistence.saveImmediate(this.tracks, this.activeTrackId, this._trackOrder)
    this.fireChange()
  }

  public createTrack(baseName: string): string {
    const id = generateId('track')
    const uniqueName = this.ensureUniqueName(baseName)

    this.tracks.set(id, { id, name: uniqueName, files: [] })
    this._trackOrder.push(id)
    void this.switchToTrack(id)
    return id
  }

  public renameTrack(id: string, newName: string): boolean {
    const track = this.tracks.get(id)
    if (!track) return false

    if (track.name === newName) return true

    if (this.isNameTaken(newName)) {
      return false
    }

    track.name = newName
    this.requestSave()
    this.fireChange(track)
    return true
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

    if (!this._isDisposed) {
      await this.persistence.clear()
    }

    this.createDefaultTrack()
    await this.persistence.saveImmediate(this.tracks, this.activeTrackId, this._trackOrder)
    this.fireChange()
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

    this.requestSave()
    this.fireChange()
  }

  public toggleFilesPin(files: StagedFile[]): void {
    if (!files?.length) return
    files.forEach((f) => (f.isPinned = !f.isPinned))
    this.requestSave()
    this.fireChange()
  }

  public unpinAllInActive(): void {
    const track = this.getActiveTrack()
    if (track === this.NULL_TRACK) return

    track.files.forEach((f) => (f.isPinned = false))
    this.requestSave()
    this.fireChange(track)
  }

  public hasUri(uri: vscode.Uri): boolean {
    return (this.uriRefCount.get(uri.toString()) ?? 0) > 0
  }

  public async processDeletions(uris: vscode.Uri[]): Promise<void> {
    if (this._isDisposed || uris.length === 0) return

    const deletedSet = new Set(uris.map((u) => u.toString()))
    let changed = false

    for (const track of this.tracks.values()) {
      const initialCount = track.files.length
      if (initialCount === 0) continue

      const toRemove: StagedFile[] = []
      const toKeep: StagedFile[] = []

      if (initialCount * uris.length > 2000) {
        await this.yieldToEventLoop()
      }

      for (const file of track.files) {
        let shouldRemove = deletedSet.has(file.uri.toString())

        if (!shouldRemove) {
          for (const deletedUri of uris) {
            if (isChildOf(deletedUri, file.uri)) {
              shouldRemove = true
              break
            }
          }
        }

        if (shouldRemove) {
          toRemove.push(file)
        } else {
          toKeep.push(file)
        }
      }

      if (toRemove.length > 0) {
        track.files = toKeep
        this.decrementIndex(toRemove)
        changed = true
      }
    }

    if (changed) {
      this.finalizeChange()
      Logger.info(`Processed ${uris.length} deletion(s). Tracks updated.`)
    }
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
      this.requestSave()
    }
    return newFiles
  }

  public removeFilesFromActive(files: StagedFile[]): void {
    const track = this.getActiveTrack()
    if (track === this.NULL_TRACK) return

    this.decrementIndex(files)
    const targets = new Set(files.map((f) => f.uri.toString()))
    track.files = track.files.filter((f) => !targets.has(f.uri.toString()))

    this.requestSave()
  }

  public clearActive(): void {
    const track = this.getActiveTrack()
    if (track === this.NULL_TRACK) return

    const removed = track.files.filter((f) => !f.isPinned)
    this.decrementIndex(removed)
    track.files = track.files.filter((f) => f.isPinned)

    this.requestSave()
  }

  public isNameTaken(name: string): boolean {
    for (const track of this.tracks.values()) {
      if (track.name === name) return true
    }
    return false
  }

  private ensureUniqueName(baseName: string): string {
    if (!this.isNameTaken(baseName)) return baseName

    let counter = 2
    while (true) {
      const candidate = `${baseName} (${counter})`
      if (!this.isNameTaken(candidate)) return candidate
      counter++
    }
  }

  private requestSave(): void {
    this.persistence.requestSave(this.tracks, this.activeTrackId, this._trackOrder)
  }

  private scheduleAsyncHydration(): void {
    this._hydrationTimer = setTimeout(() => {
      if (this._isDisposed) return
      void this.performHydration()
      this._hydrationTimer = undefined
    }, 10)
  }

  private async performHydration(): Promise<void> {
    if (this._isDisposed) return

    const startTime = Date.now()

    try {
      const raw = await this.persistence.load()

      if (raw) {
        await this.restoreStateInChunks(raw)
      } else {
        Logger.info('No previous state found, creating default track')
        this.createDefaultTrack()
      }

      this.rebuildFullIndex()
      this._isInitialized = true
      this.updateContextKeys()
      this.fireChange()

      Logger.debug(`Total hydration completed in ${Date.now() - startTime}ms`)
    } catch (error) {
      Logger.error('Hydration failed catastrophically', error as Error)
      this.createDefaultTrack()
      this._isInitialized = true
      this.fireChange()
    }
  }

  private async restoreStateInChunks(rawState: SerializedState): Promise<void> {
    this.activeTrackId = rawState.activeTrackId || 'default'
    this._trackOrder = rawState.trackOrder || []

    const trackEntries = Object.entries(rawState.tracks || {})
    const CHUNK_SIZE = 5

    for (let i = 0; i < trackEntries.length; i += CHUNK_SIZE) {
      await this.yieldToEventLoop()

      const chunk = trackEntries.slice(i, i + CHUNK_SIZE)

      for (const [id, serializedTrack] of chunk) {
        try {
          const track = this.deserializeTrackOptimized(serializedTrack)
          this.tracks.set(id, track)
        } catch (error) {
          Logger.error(`Failed to deserialize track ${id}`, error as Error)
        }
      }
    }

    this.validateStateIntegrity()
  }

  private deserializeTrackOptimized(trackData: any): ContextTrack {
    const files: StagedFile[] = []

    if (trackData.items && Array.isArray(trackData.items)) {
      for (const item of trackData.items) {
        try {
          const uri = vscode.Uri.parse(item.uri)
          files.push({
            type: 'file',
            uri,
            label: this.extractLabel(uri),
            isPinned: !!item.isPinned,
          })
        } catch (error) {
          Logger.warn(`Skipped invalid URI: ${item.uri}`)
        }
      }
    }

    return {
      id: trackData.id,
      name: trackData.name,
      files,
    }
  }

  private extractLabel(uri: vscode.Uri): string {
    const pathParts = uri.path.split('/')
    return pathParts[pathParts.length - 1] || 'unknown'
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
  }

  private fireChange(track?: ContextTrack): void {
    if (!this._isDisposed) {
      this._onDidChangeTrack.fire(track || this.getActiveTrack())
    }
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
      if (current > 1) {
        this.uriRefCount.set(key, current - 1)
      } else {
        this.uriRefCount.delete(key)
      }
    }
  }

  private finalizeChange(): void {
    this.rebuildFullIndex()
    this.requestSave()
    this.fireChange()
  }

  private updateContextKeys(): void {
    if (this._isDisposed) return
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
    this.requestSave()
    this.fireChange()
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
      this.requestSave()
      this.fireChange()
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
