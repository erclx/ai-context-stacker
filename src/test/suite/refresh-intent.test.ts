import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { StagedFile } from '../../models'
import { TrackManager } from '../../providers/track-manager'
import { resolveScanRoots, syncFilesWithFileSystem } from '../../utils/file-scanner'
import { assertPathEqual, normalizePath } from './test-utils'

suite('Refresh Intent & Metadata Demotion Suite', () => {
  let sandbox: sinon.SinonSandbox
  let trackManager: TrackManager
  let findFilesStub: sinon.SinonStub
  let fsStatStub: sinon.SinonStub
  let rootUri: vscode.Uri
  let ignoreManagerMock: any

  setup(() => {
    sandbox = sinon.createSandbox()
    rootUri = vscode.Uri.file('/root')

    ignoreManagerMock = {
      getExcludePatterns: sandbox.stub().resolves(''),
    }

    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: rootUri,
        name: 'root',
        index: 0,
      },
    ])

    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').callsFake((uri: vscode.Uri) => {
      const normalizedUri = normalizePath(uri.fsPath)
      const normalizedRoot = normalizePath(rootUri.fsPath)
      if (normalizedUri.startsWith(normalizedRoot)) {
        return { uri: rootUri, name: 'root', index: 0 }
      }
      return undefined
    })

    findFilesStub = sandbox.stub(vscode.workspace, 'findFiles').resolves([])
    fsStatStub = sandbox.stub().resolves({ type: vscode.FileType.File })
    sandbox.stub(vscode.workspace, 'fs').value({
      stat: fsStatStub,
    })

    const persistenceMock = {
      saveImmediate: sandbox.stub().resolves(),
      requestSave: sandbox.stub(),
      clear: sandbox.stub().resolves(),
    }
    const hydrationMock = {
      hydrate: sandbox.stub().resolves(null),
    }
    const contextMock = {
      globalState: { get: sandbox.stub(), update: sandbox.stub().resolves() },
      extensionPath: '/mock/path',
      subscriptions: [],
    } as unknown as vscode.ExtensionContext

    trackManager = new TrackManager(contextMock, persistenceMock as any, hydrationMock as any)
  })

  teardown(() => {
    trackManager.dispose()
    sandbox.restore()
  })

  suite('Intent-Based Scanning', () => {
    test('Individual Root File: Should ONLY verify existence, NO recursive scan', async () => {
      const file = createStagedFile('/root/package.json', false)
      const scanRoots = resolveScanRoots([file])

      assert.strictEqual(scanRoots.filesToVerify.length, 1, 'Should have 1 file to verify')
      assert.strictEqual(scanRoots.foldersToRescan.length, 0, 'Should have 0 folders to rescan')

      await syncFilesWithFileSystem(
        scanRoots.filesToVerify,
        scanRoots.foldersToRescan,
        ignoreManagerMock,
        new vscode.CancellationTokenSource().token,
      )

      assert.strictEqual(fsStatStub.called, true, 'fs.stat should be called')
      assert.strictEqual(findFilesStub.called, false, 'findFiles should NOT be called for individual root files')
    })

    test('Folder Discovery: Should trigger recursive scan for folder-sourced files', async () => {
      const file = createStagedFile('/root/src/main.ts', true)
      const scanRoots = resolveScanRoots([file])

      assert.strictEqual(scanRoots.filesToVerify.length, 0, 'Should have 0 files to verify')
      assert.strictEqual(scanRoots.foldersToRescan.length, 1, 'Should have 1 folder to rescan')
      assertPathEqual(scanRoots.foldersToRescan[0].fsPath, '/root/src')

      await syncFilesWithFileSystem(
        scanRoots.filesToVerify,
        scanRoots.foldersToRescan,
        ignoreManagerMock,
        new vscode.CancellationTokenSource().token,
      )

      assert.strictEqual(findFilesStub.called, true, 'findFiles SHOULD be called for folder roots')
    })
  })

  suite('Metadata Demotion (Move Logic)', () => {
    test('Root Demotion: Moving file from folder to root should set flag to false', async () => {
      const srcUri = vscode.Uri.file('/root/src/file.ts')
      const destUri = vscode.Uri.file('/root/file.ts')

      trackManager.createTrack('Demotion Test')
      const file = trackManager.addFilesToActive([srcUri], true)[0]

      assert.strictEqual(file.isFromFolderAddition, true, 'Setup: File should start with flag=true')

      trackManager.replaceUri(srcUri, destUri)

      const track = trackManager.getActiveTrack()
      const movedFile = track.files.find((f) => normalizePath(f.uri.fsPath) === normalizePath(destUri.fsPath))
      assert.ok(movedFile, 'File should exist at new location')
      assert.strictEqual(
        movedFile.isFromFolderAddition,
        false,
        'Flag should be demoted to FALSE when moved to workspace root',
      )
    })

    test('Subfolder Preservation: Moving file between subfolders should KEEP flag true', async () => {
      const srcUri = vscode.Uri.file('/root/src/utils/file.ts')
      const destUri = vscode.Uri.file('/root/src/services/file.ts')

      trackManager.createTrack('Preservation Test')
      const file = trackManager.addFilesToActive([srcUri], true)[0]

      assert.strictEqual(file.isFromFolderAddition, true, 'Setup: File should start with flag=true')

      trackManager.replaceUri(srcUri, destUri)

      const track = trackManager.getActiveTrack()
      const movedFile = track.files.find((f) => normalizePath(f.uri.fsPath) === normalizePath(destUri.fsPath))
      assert.ok(movedFile)
      assert.strictEqual(movedFile.isFromFolderAddition, true, 'Flag should remain TRUE when moving between subfolders')
    })
  })
})

function createStagedFile(pathStr: string, isFromFolderAddition: boolean): StagedFile {
  const uri = vscode.Uri.file(pathStr)
  return {
    type: 'file',
    uri: uri,
    label: pathStr.split('/').pop() || 'unknown',
    isFromFolderAddition,
  }
}
