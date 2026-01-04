import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { SerializedState } from '../../models'
import { HydrationService } from '../../services/hydration-service'
import { PersistenceService } from '../../services/persistence-service'

suite('HydrationService Suite', () => {
  let sandbox: sinon.SinonSandbox
  let persistenceStub: sinon.SinonStubbedInstance<PersistenceService>
  let hydration: HydrationService
  let fsStatStub: sinon.SinonStub

  const root1 = vscode.Uri.file('/root1')
  const root2 = vscode.Uri.file('/root2')

  setup(() => {
    sandbox = sinon.createSandbox()

    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      { uri: root1, name: 'root1', index: 0 },
      { uri: root2, name: 'root2', index: 1 },
    ])

    fsStatStub = sandbox.stub()
    const mockFs = {
      stat: fsStatStub,
      readFile: sandbox.stub(),
      writeFile: sandbox.stub(),
      delete: sandbox.stub(),
      rename: sandbox.stub(),
      copy: sandbox.stub(),
      createDirectory: sandbox.stub(),
      readDirectory: sandbox.stub(),
      isWritableFileSystem: () => true,
    }

    const originalFs = vscode.workspace.fs
    Object.defineProperty(vscode.workspace, 'fs', {
      writable: true,
      value: mockFs,
    })

    persistenceStub = sandbox.createStubInstance(PersistenceService)
    hydration = new HydrationService(persistenceStub)
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Should hydrate valid files successfully', async () => {
    setupPersistence({
      activeTrackId: 't1',
      trackOrder: ['t1'],
      tracks: {
        t1: {
          id: 't1',
          name: 'Main',
          items: [{ uri: 'src/valid.ts', isPinned: false }],
        },
      },
    })

    fsStatStub
      .withArgs(sinon.match((u: vscode.Uri) => u.path.endsWith('src/valid.ts')))
      .resolves({ size: 100, type: vscode.FileType.File })

    const result = await hydration.hydrate()

    assert.ok(result)
    assert.strictEqual(result.tracks.get('t1')?.files.length, 1)
    assert.strictEqual(result.tracks.get('t1')?.files[0].uri.path, '/root1/src/valid.ts')
  })

  test('Should prune dead links (files not found on disk)', async () => {
    setupPersistence({
      activeTrackId: 't1',
      trackOrder: ['t1'],
      tracks: {
        t1: {
          id: 't1',
          name: 'Main',
          items: [{ uri: 'src/deleted.ts', isPinned: false }],
        },
      },
    })

    fsStatStub.rejects(new Error('FileNotFound'))

    const result = await hydration.hydrate()

    assert.ok(result)
    assert.strictEqual(result.tracks.get('t1')?.files.length, 0, 'Missing file should be pruned')
  })

  test('Multi-Root: Should find file in secondary root if not in first', async () => {
    const relativePath = 'shared/utils.ts'
    setupPersistence({
      activeTrackId: 't1',
      trackOrder: ['t1'],
      tracks: {
        t1: {
          id: 't1',
          name: 'Main',
          items: [{ uri: relativePath, isPinned: false }],
        },
      },
    })

    const uri1 = vscode.Uri.joinPath(root1, relativePath)
    const uri2 = vscode.Uri.joinPath(root2, relativePath)

    fsStatStub.withArgs(sinon.match((u: vscode.Uri) => u.toString() === uri1.toString())).rejects()
    fsStatStub.withArgs(sinon.match((u: vscode.Uri) => u.toString() === uri2.toString())).resolves({ size: 100 })

    const result = await hydration.hydrate()
    const file = result?.tracks.get('t1')?.files[0]

    assert.ok(file, 'File should be found in secondary root')
    assert.strictEqual(file.uri.toString(), uri2.toString(), 'URI should resolve to the second root')
  })

  test('Should handle catastrophic persistence failure gracefully', async () => {
    persistenceStub.load.rejects(new Error('Storage corruption'))

    const result = await hydration.hydrate()

    assert.strictEqual(result, null, 'Should return null on load error')
  })

  function setupPersistence(state: SerializedState) {
    persistenceStub.load.resolves(state)
  }
})
