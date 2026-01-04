import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ContextTrack, StagedFile } from '../../models'
import { PersistenceService } from '../../services/persistence-service'

suite('PersistenceService Suite', () => {
  let sandbox: sinon.SinonSandbox
  let persistence: PersistenceService
  let mementoStub: {
    get: sinon.SinonStub
    update: sinon.SinonStub
    keys: sinon.SinonStub
  }
  let extensionContext: any

  setup(() => {
    sandbox = sinon.createSandbox()

    mementoStub = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
      keys: sandbox.stub().returns([]),
    }

    extensionContext = {
      workspaceState: mementoStub as unknown as vscode.Memento,
    }

    persistence = new PersistenceService(extensionContext)
  })

  teardown(() => {
    persistence.dispose()
    sandbox.restore()
  })

  test('Should write to storage on first save', async () => {
    const tracks = createTracks(['file1.ts'])
    await persistence.saveImmediate(tracks, 'track1', ['track1'])

    assert.strictEqual(mementoStub.update.calledOnce, true)
  })

  test('Should skip write if fingerprint matches (Optimization)', async () => {
    const tracks = createTracks(['file1.ts'])

    await persistence.saveImmediate(tracks, 'track1', ['track1'])
    mementoStub.update.resetHistory()

    await persistence.saveImmediate(tracks, 'track1', ['track1'])

    assert.strictEqual(mementoStub.update.called, false, 'Should not write to storage if state unchanged')
  })

  test('Should detect changes in active track ID', async () => {
    const tracks = createTracks(['file1.ts'])
    await persistence.saveImmediate(tracks, 'track1', ['track1'])
    mementoStub.update.resetHistory()

    await persistence.saveImmediate(tracks, 'track2', ['track1'])

    assert.strictEqual(mementoStub.update.calledOnce, true, 'Should detect active track change')
  })

  test('Should detect changes in file list', async () => {
    const tracks = createTracks(['file1.ts'])
    await persistence.saveImmediate(tracks, 'track1', ['track1'])
    mementoStub.update.resetHistory()

    tracks.get('track1')!.files.push(createFile('file2.ts'))

    await persistence.saveImmediate(tracks, 'track1', ['track1'])

    assert.strictEqual(mementoStub.update.calledOnce, true, 'Should detect file addition')
  })

  test('Should detect changes in track order', async () => {
    const tracks = createTracks(['file1.ts'])
    await persistence.saveImmediate(tracks, 'track1', ['track1', 'track2'])
    mementoStub.update.resetHistory()

    await persistence.saveImmediate(tracks, 'track1', ['track2', 'track1'])

    assert.strictEqual(mementoStub.update.calledOnce, true, 'Should detect order change')
  })

  test('Should clear state and reset fingerprint', async () => {
    const tracks = createTracks(['file1.ts'])
    await persistence.saveImmediate(tracks, 'track1', ['track1'])
    mementoStub.update.resetHistory()

    await persistence.clear()

    assert.strictEqual(mementoStub.update.calledWith(sinon.match.any, undefined), true)

    await persistence.saveImmediate(tracks, 'track1', ['track1'])
    assert.strictEqual(mementoStub.update.callCount, 2)
  })
})

function createTracks(filenames: string[]): Map<string, ContextTrack> {
  const map = new Map<string, ContextTrack>()
  const files = filenames.map(createFile)
  map.set('track1', { id: 'track1', name: 'Track 1', files })
  return map
}

function createFile(name: string): StagedFile {
  return {
    type: 'file',
    uri: vscode.Uri.file(`/${name}`),
    label: name,
    isPinned: false,
  }
}
