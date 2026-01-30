import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ContextTrack, SerializedState, StagedFile } from '../../models'
import { StateMapper } from '../../services/state-mapper'
import { assertPathEqual, normalizePath } from './test-utils'

suite('StateMapper Suite', () => {
  let sandbox: sinon.SinonSandbox
  let rootUri: vscode.Uri
  let secondaryUri: vscode.Uri

  setup(() => {
    sandbox = sinon.createSandbox()
    rootUri = vscode.Uri.file('/root')
    secondaryUri = vscode.Uri.file('/secondary')

    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: rootUri,
        name: 'root',
        index: 0,
      },
    ])

    sandbox.stub(vscode.workspace, 'asRelativePath').callsFake((pathOrUri) => {
      const pathStr = pathOrUri.toString()
      if (normalizePath(pathStr).includes(normalizePath(rootUri.path))) {
        const p = pathOrUri instanceof vscode.Uri ? pathOrUri.path : pathOrUri
        const relative = p.replace(rootUri.path, '').replace(/^\//, '')
        return relative
      }
      return pathStr
    })
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Single Root: Should compress absolute URIs to relative paths', () => {
    const fullPath = vscode.Uri.joinPath(rootUri, 'src/app.ts').path
    const file = createStagedFile(fullPath, true)
    const tracks = createTrackMap('track-1', [file])

    const result = StateMapper.toSerialized(tracks, 'track-1', ['track-1'])
    const item = result.tracks['track-1'].items[0]

    assert.strictEqual(item.uri, 'src/app.ts', 'URI should be compressed to relative path in single-root')
    assert.strictEqual(item.isPinned, true)
  })

  test('Multi-Root: Should persist absolute URIs to avoid ambiguity', () => {
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      { uri: rootUri, name: 'root', index: 0 },
      { uri: secondaryUri, name: 'secondary', index: 1 },
    ])

    const fullPath = vscode.Uri.joinPath(rootUri, 'src/app.ts').path
    const file = createStagedFile(fullPath, false)
    const tracks = createTrackMap('track-1', [file])

    const result = StateMapper.toSerialized(tracks, 'track-1', ['track-1'])
    const item = result.tracks['track-1'].items[0]

    assertPathEqual(item.uri, file.uri.toString(), 'URI should remain absolute in multi-root workspaces')
  })

  test('Hydration: Should expand relative paths against first root (Legacy support)', () => {
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

    const expectedUri = vscode.Uri.joinPath(rootUri, 'src/auth.ts')

    assertPathEqual(file.uri.toString(), expectedUri.toString(), 'Relative path should expand to full workspace URI')
  })

  test('Hydration: Should handle absolute URIs gracefully', () => {
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

    assertPathEqual(file.uri.toString(), absoluteUri, 'Absolute URIs should be preserved')
  })

  test('Should ignore runtime cache properties like pathSegments', () => {
    const file = createStagedFile('/root/src/cache.ts', false)
    file.pathSegments = ['src', 'cache.ts']
    const tracks = createTrackMap('t1', [file])

    const result = StateMapper.toSerialized(tracks, 't1', ['t1'])
    const item = result.tracks['t1'].items[0] as unknown as { pathSegments?: string[] }

    assert.strictEqual(item.pathSegments, undefined, 'Runtime cache properties should not be serialized')
  })

  test('Should handle empty track maps', () => {
    const tracks = new Map<string, ContextTrack>()
    const result = StateMapper.toSerialized(tracks, 'default', [])

    assert.deepStrictEqual(result.tracks, {})
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
  })

  test('Should return safe defaults when state is undefined', () => {
    const result = StateMapper.fromSerialized(undefined)
    assert.strictEqual(result.activeTrackId, 'default')
    assert.deepStrictEqual(result.trackOrder, [])
    assert.strictEqual(result.tracks.size, 0)
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

function createTrackMap(id: string, files: StagedFile[]): Map<string, ContextTrack> {
  const map = new Map<string, ContextTrack>()
  map.set(id, { id, name: 'Track', files })
  return map
}
