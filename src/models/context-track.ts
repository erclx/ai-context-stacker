import { StagedFile } from './staged-file'

/**
 * Represents a distinct staging environment (track).
 */
export interface ContextTrack {
  readonly id: string
  name: string
  files: StagedFile[]
}

/**
 * The shape of a track when saved to storage (no stats).
 */
export interface SerializedTrack {
  id: string
  name: string
  uris: string[]
}

/**
 * The full shape of the persisted workspace state.
 */
export interface SerializedState {
  tracks: Record<string, SerializedTrack>
  activeTrackId: string
}
