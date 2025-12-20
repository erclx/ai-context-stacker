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
 * Represents a single file record in storage.
 */
export interface SerializedFile {
  uri: string
  isPinned: boolean
}

/**
 * The shape of a track when saved to storage.
 */
export interface SerializedTrack {
  id: string
  name: string
  items: SerializedFile[]
}

/**
 * The full shape of the persisted workspace state.
 */
export interface SerializedState {
  tracks: Record<string, SerializedTrack>
  activeTrackId: string
}
