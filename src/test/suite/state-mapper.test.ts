import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../../models'
import { StateMapper } from '../../services/state-mapper'

suite('StateMapper Suite', () => {
  let sandbox: sinon.SinonSandbox
  let rootUri: vscode.Uri

  setup(() => {
    sandbox = sinon.createSandbox()
    rootUri = vscode.Uri.file('/root')

    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: rootUri,
        name: 'root',
        index: 0,
      },
    ])

    sandbox.stub(vscode.workspace, 'asRelativePath').callsFake((pathOrUri) => {
      const path = pathOrUri.toString()
      // Simulate compression: if path is inside root, make it relative
      if (path.includes(rootUri.path)) {
        return path.split(rootUri.path)[1].replace(/^\//, '')
      }
      return path
    })
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Should compress absolute URIs to relative paths during serialization', () => {
    // Create a file located inside the mock workspace root
    const fullPath = vscode.Uri.joinPath(rootUri, 'src/app.ts').path
    const file = createStagedFile(fullPath, true)

    const trackId = 'track-1'
    const tracks = new Map<string, ContextTrack>()
    tracks.set(trackId, {
      id: trackId,
      name: 'Feature A',
      files: [file],
    })

    const result = StateMapper.toSerialized(tracks, trackId, [trackId])
    const item = result.tracks[trackId].items[0]

    assert.strictEqual(item.uri, 'src/app.ts', 'URI should be compressed to relative path')
    assert.strictEqual(item.isPinned, true)
  })

  test('Should expand relative paths to absolute URIs during hydration', () => {
    const serialized: SerializedState = {
      activeTrackId: 'feature-b',
      trackOrder: ['feature-b'],
      tracks: {
        'feature-b': {
          id: 'feature-b',
          name: 'Feature B',
          items: [{ uri: 'src/auth.ts', isPinned: false }],
        },
      },
    }

    const { tracks } = StateMapper.fromSerialized(serialized)
    const track = tracks.get('feature-b')!
    const file = track.files[0]

    // Expect the path to be joined with the workspace root
    const expectedUri = vscode.Uri.joinPath(rootUri, 'src/auth.ts')

    assert.strictEqual(file.uri.toString(), expectedUri.toString(), 'Relative path should expand to full workspace URI')
    assert.strictEqual(file.isPinned, false)
  })

  test('Should handle absolute URIs gracefully during hydration (backward compatibility)', () => {
    const absoluteUri = 'file:///external/lib/utils.ts'
    const serialized: SerializedState = {
      activeTrackId: 'legacy',
      trackOrder: ['legacy'],
      tracks: {
        legacy: {
          id: 'legacy',
          name: 'Legacy Track',
          items: [{ uri: absoluteUri, isPinned: true }],
        },
      },
    }

    const { tracks } = StateMapper.fromSerialized(serialized)
    const file = tracks.get('legacy')!.files[0]

    assert.strictEqual(file.uri.toString(), absoluteUri, 'Absolute URIs should be preserved')
  })

  test('Should ignore runtime cache properties like pathSegments during serialization', () => {
    const file = createStagedFile('/root/src/cache.ts', false)
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

  test('Should automatically reconstruct file labels from URI paths', () => {
    const serialized: SerializedState = {
      activeTrackId: 'default',
      trackOrder: ['default'],
      tracks: {
        default: {
          id: 'default',
          name: 'Default',
          items: [{ uri: 'src/components/Button.tsx', isPinned: false }],
        },
      },
    }

    const { tracks } = StateMapper.fromSerialized(serialized)
    const file = tracks.get('default')!.files[0]

    assert.strictEqual(file.label, 'Button.tsx', 'Label should be derived from the filename')
  })

  test('Should return safe defaults when state is undefined', () => {
    const result = StateMapper.fromSerialized(undefined)
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
    assert.strictEqual(result.tracks.size, 0)
  })

  test('Should handle tracks with missing item arrays gracefully', () => {
    const partialData: any = {
      activeTrackId: 'broken',
      trackOrder: ['broken'],
      tracks: {
        broken: {
          id: 'broken',
          name: 'Broken',
        },
      },
    }

    const { tracks } = StateMapper.fromSerialized(partialData)
    const track = tracks.get('broken')

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
