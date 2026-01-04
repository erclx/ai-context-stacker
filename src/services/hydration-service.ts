import * as os from 'os'
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
    const CHUNK_SIZE = 3

    for (let i = 0; i < trackEntries.length; i += CHUNK_SIZE) {
      await this.yieldToEventLoop()

      const chunk = trackEntries.slice(i, i + CHUNK_SIZE)

      await Promise.all(
        chunk.map(async ([id, serializedTrack]) => {
          try {
            const track = await this.deserializeTrackAsync(serializedTrack)
            tracks.set(id, track)
          } catch (error) {
            Logger.error(`Failed to deserialize track ${id}`, error as Error)
          }
        }),
      )
    }

    return { tracks, activeTrackId, trackOrder }
  }

  private async deserializeTrackAsync(trackData: unknown): Promise<ContextTrack> {
    const files: StagedFile[] = []
    const data = trackData as { id: string; name: string; items?: Array<{ uri: string; isPinned?: boolean }> }

    if (data.items && Array.isArray(data.items)) {
      const VALIDATION_CONCURRENCY = Math.max(4, os.cpus().length)
      const queue = [...data.items]

      while (queue.length > 0) {
        const batch = queue.splice(0, VALIDATION_CONCURRENCY)

        await Promise.all(
          batch.map(async (item) => {
            try {
              const validatedUri = await this.resolveAndValidateUri(item.uri)
              if (validatedUri) {
                files.push({
                  type: 'file',
                  uri: validatedUri,
                  label: this.extractLabel(validatedUri),
                  isPinned: !!item.isPinned,
                })
              }
            } catch (error) {
              Logger.warn(`Skipped invalid URI during hydration: ${item.uri}`)
            }
          }),
        )
      }
    }

    return {
      id: data.id,
      name: data.name,
      files,
    }
  }

  private async resolveAndValidateUri(pathOrUri: string): Promise<vscode.Uri | null> {
    if (pathOrUri.includes('://') || pathOrUri.startsWith('/') || /^[a-zA-Z]:\\/.test(pathOrUri)) {
      const uri = vscode.Uri.parse(pathOrUri)
      return (await this.checkExists(uri)) ? uri : null
    }

    const folders = vscode.workspace.workspaceFolders || []

    if (folders.length === 1) {
      const uri = vscode.Uri.joinPath(folders[0].uri, pathOrUri)
      return (await this.checkExists(uri)) ? uri : null
    }

    for (const folder of folders) {
      const candidate = vscode.Uri.joinPath(folder.uri, pathOrUri)
      if (await this.checkExists(candidate)) {
        return candidate
      }
    }

    return null
  }

  private async checkExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri)
      return true
    } catch {
      return false
    }
  }

  private extractLabel(uri: vscode.Uri): string {
    const pathParts = uri.path.split('/')
    return pathParts[pathParts.length - 1] || 'unknown'
  }

  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
  }
}
