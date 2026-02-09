import { StagedFile } from './staged-file'

export interface ContextTrack {
  readonly id: string
  name: string
  files: StagedFile[]
}

export interface SerializedFile {
  uri: string
  isPinned: boolean
  isFromFolderAddition?: boolean
}

export interface SerializedTrack {
  id: string
  name: string
  items: SerializedFile[]
}

export interface SerializedState {
  tracks: Record<string, SerializedTrack>
  activeTrackId: string
  trackOrder: string[]
}
