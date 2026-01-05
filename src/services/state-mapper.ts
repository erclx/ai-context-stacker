import * as vscode from 'vscode'

import { ContextTrack, SerializedState, SerializedTrack, StagedFile } from '../models'

export class StateMapper {
  public static toSerialized(
    tracks: Map<string, ContextTrack>,
    activeTrackId: string,
    trackOrder: string[],
  ): SerializedState {
    const state: SerializedState = {
      activeTrackId,
      trackOrder,
      tracks: {},
    }

    tracks.forEach((t) => {
      state.tracks[t.id] = {
        id: t.id,
        name: t.name,
        items: t.files.map((f) => ({
          uri: this.compressUri(f.uri),
          isPinned: !!f.isPinned,
        })),
      }
    })

    return state
  }

  public static fromSerialized(state: SerializedState | undefined): {
    tracks: Map<string, ContextTrack>
    activeTrackId: string
    trackOrder: string[]
  } {
    if (!state || !state.tracks) {
      return {
        tracks: new Map(),
        activeTrackId: 'default',
        trackOrder: [],
      }
    }

    const tracks = new Map<string, ContextTrack>()

    Object.values(state.tracks).forEach((t) => {
      tracks.set(t.id, {
        id: t.id,
        name: t.name,
        files: this.deserializeFilesLazy(t),
      })
    })

    const activeTrackId = state.activeTrackId || 'default'
    const trackOrder = state.trackOrder || Array.from(tracks.keys())

    return { tracks, activeTrackId, trackOrder }
  }

  public static async resolveValidUri(pathOrUri: string): Promise<vscode.Uri | null> {
    const candidates = this.expandToCandidates(pathOrUri)

    const results = await Promise.all(
      candidates.map(async (uri) => {
        try {
          await vscode.workspace.fs.stat(uri)
          return uri
        } catch {
          return null
        }
      }),
    )

    return results.find((uri) => uri !== null) || null
  }

  public static extractLabel(uri: vscode.Uri): string {
    const pathParts = uri.path.split('/')
    return pathParts[pathParts.length - 1] || 'unknown'
  }

  private static deserializeFilesLazy(trackData: SerializedTrack): StagedFile[] {
    if (!trackData.items || !Array.isArray(trackData.items)) {
      return []
    }

    return trackData.items.map((item) => {
      const uri = this.expandUri(item.uri)
      return {
        type: 'file',
        uri,
        label: this.extractLabel(uri),
        isPinned: !!item.isPinned,
      }
    })
  }

  private static compressUri(uri: vscode.Uri): string {
    const folders = vscode.workspace.workspaceFolders
    if (folders && folders.length > 1) {
      return uri.toString()
    }

    const relative = vscode.workspace.asRelativePath(uri, false)
    if (relative === uri.fsPath || relative === uri.path) {
      return uri.toString()
    }
    return relative
  }

  private static expandUri(pathOrUri: string): vscode.Uri {
    const candidates = this.expandToCandidates(pathOrUri)
    return candidates[0]
  }

  private static expandToCandidates(pathOrUri: string): vscode.Uri[] {
    if (pathOrUri.includes('://') || pathOrUri.startsWith('/') || /^[a-zA-Z]:\\/.test(pathOrUri)) {
      return [vscode.Uri.parse(pathOrUri)]
    }

    const folders = vscode.workspace.workspaceFolders || []

    if (folders.length === 0) {
      return [vscode.Uri.file(pathOrUri)]
    }

    return folders.map((f) => vscode.Uri.joinPath(f.uri, pathOrUri))
  }
}
