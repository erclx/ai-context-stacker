import * as vscode from 'vscode'

import { ContextTrack, SerializedState, SerializedTrack, StagedFile } from '../models'

/**
 * Handles serialization and deserialization of the context state.
 * Isolates the domain model from the persistence format.
 */
export class StateMapper {
  /**
   * Maps memory Map of tracks to a serializable object for VS Code workspace storage.
   */
  public static toSerialized(tracks: Map<string, ContextTrack>, activeTrackId: string): SerializedState {
    const state: SerializedState = {
      activeTrackId,
      tracks: {},
    }

    tracks.forEach((t) => {
      state.tracks[t.id] = {
        id: t.id,
        name: t.name,
        items: t.files.map((f) => ({
          uri: f.uri.toString(),
          isPinned: !!f.isPinned,
        })),
      }
    })

    return state
  }

  /**
   * Hydrates the domain model from workspace storage data.
   */
  public static fromSerialized(state: SerializedState | undefined): {
    tracks: Map<string, ContextTrack>
    activeTrackId: string
  } {
    const tracks = new Map<string, ContextTrack>()
    let activeTrackId = 'default'

    if (state && state.tracks) {
      Object.values(state.tracks).forEach((t) => {
        tracks.set(t.id, {
          id: t.id,
          name: t.name,
          files: this.deserializeFiles(t),
        })
      })
      activeTrackId = state.activeTrackId || 'default'
    }

    return { tracks, activeTrackId }
  }

  private static deserializeFiles(trackData: SerializedTrack): StagedFile[] {
    if (trackData.items) {
      return trackData.items.map((item) => ({
        type: 'file',
        uri: vscode.Uri.parse(item.uri),
        label: vscode.Uri.parse(item.uri).path.split('/').pop() || 'unknown',
        isPinned: item.isPinned,
      }))
    }
    return []
  }
}
