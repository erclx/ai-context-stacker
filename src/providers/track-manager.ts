import * as path from 'path'
import * as vscode from 'vscode'

import { ContextTrack, refreshFileLabel, StagedFile } from '../models'
import { HydrationService, PersistenceService } from '../services'
import { generateId, Logger } from '../utils'
import { isChildOf } from '../utils/file-scanner'

export class TrackManager implements vscode.Disposable {
  private tracks = new Map<string, ContextTrack>()
  private activeTrackId = 'default'
  private _trackOrder: string[] = ['default']

  private _isInitialized = false
  private _isDisposed = false
  private _hydrationTimer: NodeJS.Timeout | undefined

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  readonly onDidChangeTrack = this._onDidChangeTrack.event

  constructor(
    private context: vscode.ExtensionContext,
    private persistence: PersistenceService,
    private hydrationService: HydrationService,
  ) {
    this.createDefaultTrack(false)
    this.scheduleAsyncHydration()
  }

  public get isInitialized(): boolean {
    return this._isInitialized
  }

  public get allTracks(): ContextTrack[] {
    return this._trackOrder.map((id) => this.tracks.get(id)).filter((t): t is ContextTrack => t !== undefined)
  }

  public getActiveTrack(): ContextTrack {
    const track = this.tracks.get(this.activeTrackId)
    if (!track) {
      return this.createDefaultTrack(true)
    }
    return track
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

    if (!this._isDisposed) {
      await this.persistence.clear()
    }

    this.createDefaultTrack(true)
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
    track.files.forEach((f) => (f.isPinned = false))
    this.requestSave()
    this.fireChange(track)
  }

  public hasUri(uri: vscode.Uri): boolean {
    const uriStr = uri.toString()
    for (const track of this.tracks.values()) {
      if (track.files.some((f) => f.uri.toString() === uriStr)) {
        return true
      }
    }
    return false
  }

  public async processBatchDeletions(uris: vscode.Uri[]): Promise<void> {
    if (this._isDisposed || uris.length === 0) return

    const deletedSet = new Set(uris.map((u) => u.toString()))
    let changed = false

    let lastYield = Date.now()
    const YIELD_MS = 16

    for (const track of this.tracks.values()) {
      if (track.files.length === 0) continue

      const toRemoveIds = new Set<string>()

      for (const file of track.files) {
        if (Date.now() - lastYield > YIELD_MS) {
          await new Promise((resolve) => setImmediate(resolve))
          if (this._isDisposed) return
          lastYield = Date.now()
        }

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
          toRemoveIds.add(file.uri.toString())
        }
      }

      if (toRemoveIds.size > 0) {
        track.files = track.files.filter((f) => !toRemoveIds.has(f.uri.toString()))
        changed = true
      }
    }

    if (changed) {
      this.finalizeChange()
      Logger.info(`Processed batch deletion of ${uris.length} roots.`)
    }
  }

  public removeUriEverywhere(uri: vscode.Uri): void {
    const uriStr = uri.toString()
    let changed = false

    for (const track of this.tracks.values()) {
      const prevLen = track.files.length
      track.files = track.files.filter((f) => f.uri.toString() !== uriStr)
      if (track.files.length !== prevLen) {
        changed = true
      }
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

  public async replaceUriPrefix(oldRoot: vscode.Uri, newRoot: vscode.Uri): Promise<void> {
    let changed = false
    let lastYield = Date.now()
    const YIELD_MS = 15

    for (const track of this.tracks.values()) {
      if (track.files.length === 0) continue

      for (const file of track.files) {
        if (Date.now() - lastYield > YIELD_MS) {
          await new Promise((resolve) => setImmediate(resolve))
          if (this._isDisposed) return
          lastYield = Date.now()
        }

        if (isChildOf(oldRoot, file.uri)) {
          const relativePath = path.relative(oldRoot.fsPath, file.uri.fsPath)

          if (relativePath && !relativePath.startsWith('..')) {
            const newUri = vscode.Uri.joinPath(newRoot, relativePath)
            this.updateFileUri(file, newUri)
            changed = true
          }
        }
      }
    }

    if (changed) {
      this.finalizeChange()
      Logger.info(`Processed folder rename: ${oldRoot.fsPath} -> ${newRoot.fsPath}`)
    }
  }

  public addFilesToActive(uris: vscode.Uri[]): StagedFile[] {
    const track = this.ensureActiveTrack()
    const newFiles = this.filterNewFiles(track, uris)

    if (newFiles.length > 0) {
      track.files.push(...newFiles)
      this.finalizeChange()
    }
    return newFiles
  }

  public removeFilesFromActive(files: StagedFile[]): void {
    const track = this.getActiveTrack()
    const targets = new Set(files.map((f) => f.uri.toString()))
    track.files = track.files.filter((f) => !targets.has(f.uri.toString()))
    this.finalizeChange()
  }

  public clearActive(): void {
    const track = this.getActiveTrack()
    track.files = track.files.filter((f) => f.isPinned)
    this.finalizeChange()
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

    try {
      const result = await this.hydrationService.hydrate()

      if (this._isDisposed) return

      if (result) {
        this.tracks = result.tracks
        this.activeTrackId = result.activeTrackId
        this._trackOrder = result.trackOrder
      } else {
        Logger.info('No previous state found, using default track')
        if (this.tracks.size === 0) this.createDefaultTrack(true)
      }

      this.validateStateIntegrity()
      this._isInitialized = true
      this.updateContextKeys()
      this.fireChange()
    } catch (error) {
      Logger.error('Hydration failed catastrophically', error as Error)
      this.createDefaultTrack(true)
      this._isInitialized = true
      this.fireChange()
    }
  }

  private fireChange(track?: ContextTrack): void {
    if (!this._isDisposed) {
      this._onDidChangeTrack.fire(track || this.getActiveTrack())
    }
  }

  private finalizeChange(): void {
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

  private createDefaultTrack(forceReset: boolean): ContextTrack {
    const def: ContextTrack = { id: 'default', name: 'Main', files: [] }

    if (forceReset || !this.tracks.has(def.id)) {
      this.tracks.set(def.id, def)
    }

    if (forceReset || this._trackOrder.length === 0) {
      this._trackOrder = [def.id]
      this.activeTrackId = def.id
    }

    return this.tracks.get(def.id) || def
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
    refreshFileLabel(file)
  }

  private ensureActiveTrack(): ContextTrack {
    let track = this.tracks.get(this.activeTrackId)
    if (!track) track = this.createDefaultTrack(true)
    return track
  }

  private validateStateIntegrity(): void {
    if (this.tracks.size > 0 && !this.tracks.has(this.activeTrackId)) {
      this.activeTrackId = this._trackOrder[0] || 'default'
    }
    if (this.tracks.size === 0) {
      this.createDefaultTrack(true)
    }
  }

  private handleTrackDeletion(deletedId: string): void {
    if (this.activeTrackId === deletedId) {
      const nextId = this._trackOrder[0] || 'default'
      if (!this.tracks.has(nextId)) this.createDefaultTrack(true)
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
