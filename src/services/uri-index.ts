import * as vscode from 'vscode'

import { ContextTrack } from '../models'

export class UriIndex implements vscode.Disposable {
  private index = new Map<string, number>()
  private _isDisposed = false

  public dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true
    this.index.clear()
  }

  public has(uri: vscode.Uri): boolean {
    if (this._isDisposed) return false
    return (this.index.get(uri.toString()) ?? 0) > 0
  }

  public increment(uri: vscode.Uri): void {
    if (this._isDisposed) return
    const key = uri.toString()
    this.index.set(key, (this.index.get(key) ?? 0) + 1)
  }

  public decrement(uri: vscode.Uri): void {
    if (this._isDisposed) return
    const key = uri.toString()
    const count = this.index.get(key)
    if (count && count > 1) {
      this.index.set(key, count - 1)
    } else {
      this.index.delete(key)
    }
  }

  public incrementMany(uris: vscode.Uri[]): void {
    if (this._isDisposed) return
    uris.forEach((u) => this.increment(u))
  }

  public decrementMany(uris: vscode.Uri[]): void {
    if (this._isDisposed) return
    uris.forEach((u) => this.decrement(u))
  }

  public rebuild(tracks: ContextTrack[]): void {
    if (this._isDisposed) return
    this.index.clear()
    for (const track of tracks) {
      for (const file of track.files) {
        this.increment(file.uri)
      }
    }
  }

  public clear(): void {
    if (this._isDisposed) return
    this.index.clear()
  }
}
