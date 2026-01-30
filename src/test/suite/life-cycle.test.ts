import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { TrackManager } from '../../providers/track-manager'
import { FileLifecycleService } from '../../services/file-lifecycle-service'
import { assertPathEqual, normalizePath } from './test-utils'

suite('Lifecycle Management Suite', () => {
  let trackManager: TrackManager
  let lifecycleService: FileLifecycleService
  let sandbox: sinon.SinonSandbox
  let persistenceMock: any
  let hydrationMock: any
  let contextMock: any
  let fsStatStub: sinon.SinonStub

  setup(() => {
    sandbox = sinon.createSandbox()

    persistenceMock = {
      saveImmediate: sandbox.stub().resolves(),
      requestSave: sandbox.stub(),
      clear: sandbox.stub().resolves(),
    }
    hydrationMock = {
      hydrate: sandbox.stub().resolves(null),
    }
    contextMock = {
      globalState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves(),
      },
      extensionPath: '/mock/path',
      subscriptions: [],
    }

    fsStatStub = sandbox.stub()
    const fsMock = {
      stat: fsStatStub,
      readFile: sandbox.stub(),
      readDirectory: sandbox.stub(),
    }

    sandbox.stub(vscode.workspace, 'fs').value(fsMock)

    trackManager = new TrackManager(contextMock, persistenceMock, hydrationMock)
    lifecycleService = new FileLifecycleService(trackManager)
  })

  teardown(() => {
    trackManager.dispose()
    lifecycleService.dispose()
    sandbox.restore()
  })

  test('Renaming a folder should propagate to nested files', async () => {
    const oldRoot = vscode.Uri.file('/root/old')
    const newRoot = vscode.Uri.file('/root/new')
    const fileA = vscode.Uri.file('/root/old/fileA.ts')
    const fileB = vscode.Uri.file('/root/old/nested/fileB.ts')

    trackManager.createTrack('Test Track')
    trackManager.addFilesToActive([fileA, fileB])

    fsStatStub
      .withArgs(sinon.match((uri: vscode.Uri) => normalizePath(uri.fsPath) === normalizePath(newRoot.fsPath)))
      .resolves({ type: vscode.FileType.Directory } as vscode.FileStat)
    ;(lifecycleService as any).queueRename(oldRoot, newRoot)

    await new Promise((resolve) => setTimeout(resolve, 350))

    const track = trackManager.getActiveTrack()
    assert.strictEqual(track.files.length, 2)

    assertPathEqual(track.files[0].uri.fsPath, '/root/new/fileA.ts')
    assert.strictEqual(track.files[0].label, 'fileA.ts')

    assertPathEqual(track.files[1].uri.fsPath, '/root/new/nested/fileB.ts')
  })

  test('Boundary Check: Should not rename partial matches', async () => {
    const oldRoot = vscode.Uri.file('/root/src')
    const newRoot = vscode.Uri.file('/root/lib')

    const targetFile = vscode.Uri.file('/root/src/index.ts')
    // Distinct path that won't collide even if lowercased
    const boundaryFile = vscode.Uri.file('/root/src-backup/index.ts')

    trackManager.createTrack('Boundary Track')
    trackManager.addFilesToActive([targetFile, boundaryFile])

    fsStatStub
      .withArgs(sinon.match((uri: vscode.Uri) => normalizePath(uri.fsPath) === normalizePath(newRoot.fsPath)))
      .resolves({ type: vscode.FileType.Directory } as vscode.FileStat)
    ;(lifecycleService as any).queueRename(oldRoot, newRoot)
    await new Promise((resolve) => setTimeout(resolve, 350))

    const track = trackManager.getActiveTrack()

    const newTarget = track.files.find((f) => normalizePath(f.uri.fsPath) === normalizePath('/root/lib/index.ts'))
    const originalBoundary = track.files.find(
      (f) => normalizePath(f.uri.fsPath) === normalizePath('/root/src-backup/index.ts'),
    )

    assert.ok(newTarget, 'Target file in /src/ should be renamed to /lib/')
    assert.ok(originalBoundary, 'File in /src-backup/ should NOT be touched')
  })

  test('File rename should be handled individually', async () => {
    const oldFile = vscode.Uri.file('/root/old.ts')
    const newFile = vscode.Uri.file('/root/new.ts')

    trackManager.createTrack('File Track')
    trackManager.addFilesToActive([oldFile])

    fsStatStub.resolves({ type: vscode.FileType.File } as vscode.FileStat)
    ;(lifecycleService as any).queueRename(oldFile, newFile)
    await new Promise((resolve) => setTimeout(resolve, 350))

    const track = trackManager.getActiveTrack()
    assertPathEqual(track.files[0].uri.fsPath, '/root/new.ts')
  })
})
