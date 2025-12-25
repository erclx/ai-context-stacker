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
        files: this.deserializeFiles(t),
      })
    })

    const activeTrackId = state.activeTrackId || 'default'
    const trackOrder = state.trackOrder || Array.from(tracks.keys())

    return { tracks, activeTrackId, trackOrder }
  }

  private static deserializeFiles(trackData: SerializedTrack): StagedFile[] {
    if (!trackData.items || !Array.isArray(trackData.items)) {
      return []
    }

    return trackData.items.map((item) => {
      const uri = vscode.Uri.parse(item.uri)
      return {
        type: 'file',
        uri,
        label: this.extractLabel(uri),
        isPinned: !!item.isPinned,
      }
    })
  }

  private static extractLabel(uri: vscode.Uri): string {
    const pathParts = uri.path.split('/')
    return pathParts[pathParts.length - 1] || 'unknown'
  }
}
