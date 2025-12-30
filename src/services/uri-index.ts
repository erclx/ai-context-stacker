import * as vscode from 'vscode'

import { ContextTrack } from '../models'

export class UriIndex {
  private index = new Map<string, number>()

  public has(uri: vscode.Uri): boolean {
    return (this.index.get(uri.toString()) ?? 0) > 0
  }

  public increment(uri: vscode.Uri): void {
    const key = uri.toString()
    this.index.set(key, (this.index.get(key) ?? 0) + 1)
  }

  public decrement(uri: vscode.Uri): void {
    const key = uri.toString()
    const count = this.index.get(key)
    if (count && count > 1) {
      this.index.set(key, count - 1)
    } else {
      this.index.delete(key)
    }
  }

  public incrementMany(uris: vscode.Uri[]): void {
    uris.forEach((u) => this.increment(u))
  }

  public decrementMany(uris: vscode.Uri[]): void {
    uris.forEach((u) => this.decrement(u))
  }

  public rebuild(tracks: ContextTrack[]): void {
    this.index.clear()
    for (const track of tracks) {
      for (const file of track.files) {
        this.increment(file.uri)
      }
    }
  }

  public clear(): void {
    this.index.clear()
  }
}
