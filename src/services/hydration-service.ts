import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../models'
import { Logger } from '../utils'
import { PersistenceService } from './persistence-service'

export interface HydrationResult {
  tracks: Map<string, ContextTrack>
  activeTrackId: string
  trackOrder: string[]
}

export class HydrationService {
  constructor(private persistence: PersistenceService) {}

  public async hydrate(): Promise<HydrationResult | null> {
    const startTime = Date.now()

    try {
      const raw = await this.persistence.load()
      if (!raw) {
        return null
      }

      const result = await this.restoreStateInChunks(raw)
      Logger.debug(`Hydration service completed in ${Date.now() - startTime}ms`)
      return result
    } catch (error) {
      Logger.error('Hydration failed', error as Error)
      return null
    }
  }

  private async restoreStateInChunks(rawState: SerializedState): Promise<HydrationResult> {
    const activeTrackId = rawState.activeTrackId || 'default'
    const trackOrder = rawState.trackOrder || []
    const tracks = new Map<string, ContextTrack>()

    const trackEntries = Object.entries(rawState.tracks || {})
    const CHUNK_SIZE = 5

    for (let i = 0; i < trackEntries.length; i += CHUNK_SIZE) {
      await this.yieldToEventLoop()

      const chunk = trackEntries.slice(i, i + CHUNK_SIZE)

      for (const [id, serializedTrack] of chunk) {
        try {
          const track = this.deserializeTrackOptimized(serializedTrack)
          tracks.set(id, track)
        } catch (error) {
          Logger.error(`Failed to deserialize track ${id}`, error as Error)
        }
      }
    }

    return { tracks, activeTrackId, trackOrder }
  }

  private deserializeTrackOptimized(trackData: unknown): ContextTrack {
    const files: StagedFile[] = []
    const data = trackData as { id: string; name: string; items?: Array<{ uri: string; isPinned?: boolean }> }

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        try {
          const uri = this.expandUri(item.uri)
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
      id: data.id,
      name: data.name,
      files,
    }
  }

  private expandUri(pathOrUri: string): vscode.Uri {
    if (pathOrUri.includes('://') || pathOrUri.startsWith('/')) {
      return vscode.Uri.parse(pathOrUri)
    }
    const root = vscode.workspace.workspaceFolders?.[0]
    if (root) {
      return vscode.Uri.joinPath(root.uri, pathOrUri)
    }
    return vscode.Uri.file(pathOrUri)
  }

  private extractLabel(uri: vscode.Uri): string {
    const pathParts = uri.path.split('/')
    return pathParts[pathParts.length - 1] || 'unknown'
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
  }
}
