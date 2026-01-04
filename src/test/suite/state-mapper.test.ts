import * as assert from 'assert'
import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../../models'
import { StateMapper } from '../../services/state-mapper'

suite('StateMapper Suite', () => {
  test('Should serialize domain tracks into a simplified JSON object', () => {
    const file = createStagedFile('/src/app.ts', true)
    const trackId = 'track-1'
    const trackOrder = [trackId]

    const tracks = new Map<string, ContextTrack>()
    tracks.set(trackId, {
      id: trackId,
      name: 'Feature A',
      files: [file],
    })

    const result = StateMapper.toSerialized(tracks, trackId, trackOrder)

    assert.strictEqual(result.activeTrackId, trackId)
    assert.deepStrictEqual(result.trackOrder, trackOrder)
    assert.strictEqual(Object.keys(result.tracks).length, 1)

    const serializedTrack = result.tracks[trackId]
    assert.strictEqual(serializedTrack.name, 'Feature A')
    assert.strictEqual(serializedTrack.items.length, 1)

    const item = serializedTrack.items[0]
    assert.strictEqual(item.uri, file.uri.toString())
    assert.strictEqual(item.isPinned, true)
  })

  test('Should ignore runtime cache properties like pathSegments during serialization', () => {
    const file = createStagedFile('/src/cache.ts', false)
    file.pathSegments = ['src', 'cache.ts']

    const tracks = new Map<string, ContextTrack>()
    tracks.set('t1', { id: 't1', name: 'T1', files: [file] })

    const result = StateMapper.toSerialized(tracks, 't1', ['t1'])
    const item = result.tracks['t1'].items[0] as any

    assert.strictEqual(item.pathSegments, undefined, 'Runtime cache properties should not be serialized')
  })

  test('Should handle empty track maps', () => {
    const tracks = new Map<string, ContextTrack>()

    const result = StateMapper.toSerialized(tracks, 'default', [])

    assert.deepStrictEqual(result.tracks, {})
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
  })

  test('Should hydrate domain model from valid serialized state', () => {
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

    const { tracks, activeTrackId, trackOrder } = StateMapper.fromSerialized(serialized)

    assert.strictEqual(activeTrackId, 'feature-b')
    assert.deepStrictEqual(trackOrder, ['feature-b'])
    assert.ok(tracks.has('feature-b'))

    const track = tracks.get('feature-b')!
    assert.strictEqual(track.name, 'Feature B')
    assert.strictEqual(track.files.length, 1)

    const file = track.files[0]
    assert.strictEqual(file.uri.toString(), 'file:///src/auth.ts')
    assert.strictEqual(file.isPinned, false)
  })

  test('Should automatically reconstruct file labels from URI paths', () => {
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

    const { tracks } = StateMapper.fromSerialized(serialized)

    const file = tracks.get('default')!.files[0]
    assert.strictEqual(file.label, 'helper.spec.ts', 'Label should be derived from the filename')
  })

  test('Should return safe defaults when state is undefined', () => {
    const result = StateMapper.fromSerialized(undefined)

    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
    assert.strictEqual(result.tracks.size, 0)
  })

  test('Should handle tracks with missing item arrays gracefully', () => {
    const partialData: any = {
      activeTrackId: 'broken-track',
      trackOrder: ['broken-track'],
      tracks: {
        'broken-track': {
          id: 'broken-track',
          name: 'Broken',
        },
      },
    }

    const { tracks } = StateMapper.fromSerialized(partialData)

    const track = tracks.get('broken-track')
    assert.ok(track)
    assert.deepStrictEqual(track!.files, [], 'Should default to empty array if items missing')
  })
})

function createStagedFile(path: string, isPinned = false): StagedFile {
  const uri = vscode.Uri.file(path)
  return {
    type: 'file',
    uri: uri,
    label: path.split('/').pop() || 'unknown',
    isPinned,
  }
}
