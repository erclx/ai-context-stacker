import * as assert from 'assert'
import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../../models'
import { StateMapper } from '../../services/state-mapper'

/**
 * Validates the data persistence layer.
 * Ensures that complex domain objects (Tracks/Files) survive the round-trip
 * to JSON storage without data loss or corruption.
 */
suite('StateMapper Suite', () => {
  // --- Serialization Tests (Memory -> JSON) ---

  test('Should serialize domain tracks into a simplified JSON object', () => {
    // Arrange
    const file = createStagedFile('/src/app.ts', true)
    const trackId = 'track-1'
    const trackOrder = [trackId]

    const tracks = new Map<string, ContextTrack>()
    tracks.set(trackId, {
      id: trackId,
      name: 'Feature A',
      files: [file],
    })

    // Act
    const result = StateMapper.toSerialized(tracks, trackId, trackOrder)

    // Assert
    assert.strictEqual(result.activeTrackId, trackId)
    assert.deepStrictEqual(result.trackOrder, trackOrder)
    assert.strictEqual(Object.keys(result.tracks).length, 1)

    const serializedTrack = result.tracks[trackId]
    assert.strictEqual(serializedTrack.name, 'Feature A')
    assert.strictEqual(serializedTrack.items.length, 1)

    // Verify file transformation
    const item = serializedTrack.items[0]
    assert.strictEqual(item.uri, file.uri.toString())
    assert.strictEqual(item.isPinned, true)
  })

  test('Should handle empty track maps', () => {
    // Arrange
    const tracks = new Map<string, ContextTrack>()

    // Act
    const result = StateMapper.toSerialized(tracks, 'default', [])

    // Assert
    assert.deepStrictEqual(result.tracks, {})
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
  })

  // --- Deserialization Tests (JSON -> Memory) ---

  test('Should hydrate domain model from valid serialized state', () => {
    // Arrange
    const serialized: SerializedState = {
      activeTrackId: 'feature-b',
      trackOrder: ['feature-b'],
      tracks: {
        'feature-b': {
          id: 'feature-b',
          name: 'Feature B',
          items: [{ uri: 'file:///src/auth.ts', isPinned: false }],
        },
      },
    }

    // Act
    const { tracks, activeTrackId, trackOrder } = StateMapper.fromSerialized(serialized)

    // Assert
    assert.strictEqual(activeTrackId, 'feature-b')
    assert.deepStrictEqual(trackOrder, ['feature-b'])
    assert.ok(tracks.has('feature-b'))

    const track = tracks.get('feature-b')!
    assert.strictEqual(track.name, 'Feature B')
    assert.strictEqual(track.files.length, 1)

    // Verify URI reconstruction
    const file = track.files[0]
    assert.strictEqual(file.uri.toString(), 'file:///src/auth.ts')
    assert.strictEqual(file.isPinned, false)
  })

  test('Should automatically reconstruct file labels from URI paths', () => {
    // Arrange: JSON does not store labels, they must be derived
    const serialized: SerializedState = {
      activeTrackId: 'default',
      trackOrder: ['default'],
      tracks: {
        default: {
          id: 'default',
          name: 'Default',
          items: [{ uri: 'file:///project/utils/helper.spec.ts', isPinned: false }],
        },
      },
    }

    // Act
    const { tracks } = StateMapper.fromSerialized(serialized)

    // Assert
    const file = tracks.get('default')!.files[0]
    assert.strictEqual(file.label, 'helper.spec.ts', 'Label should be derived from the filename')
  })

  test('Should return safe defaults when state is undefined', () => {
    // Act
    const result = StateMapper.fromSerialized(undefined)

    // Assert
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
    assert.strictEqual(result.tracks.size, 0)
  })

  test('Should handle tracks with missing item arrays gracefully', () => {
    // Arrange: Simulate legacy data or partial corruption where 'items' is missing
    const partialData: any = {
      activeTrackId: 'broken-track',
      trackOrder: ['broken-track'],
      tracks: {
        'broken-track': {
          id: 'broken-track',
          name: 'Broken',
          // items property is missing
        },
      },
    }

    // Act
    const { tracks } = StateMapper.fromSerialized(partialData)

    // Assert
    const track = tracks.get('broken-track')
    assert.ok(track)
    assert.deepStrictEqual(track!.files, [], 'Should default to empty array if items missing')
  })
})

// --- Helpers ---

function createStagedFile(path: string, isPinned = false): StagedFile {
  const uri = vscode.Uri.file(path)
  return {
    type: 'file',
    uri: uri,
    label: path.split('/').pop() || 'unknown',
    isPinned,
  }
}
