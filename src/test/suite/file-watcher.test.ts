import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ContextTrack } from '../../models'
import { TrackManager } from '../../providers'
import { FileWatcherService } from '../../services'

class MockWatcher implements vscode.FileSystemWatcher {
  ignoreCreateEvents = false
  ignoreChangeEvents = false
  ignoreDeleteEvents = false

  private _onDidDelete = new vscode.EventEmitter<vscode.Uri>()
  readonly onDidDelete = this._onDidDelete.event

  readonly onDidCreate = new vscode.EventEmitter<vscode.Uri>().event
  readonly onDidChange = new vscode.EventEmitter<vscode.Uri>().event

  fireDelete(uri: vscode.Uri) {
    this._onDidDelete.fire(uri)
  }

  dispose() {
    this._onDidDelete.dispose()
  }
}

class MockTrackManager {
  public trackedUris = new Set<string>()
  public replaceLog: { old: string; new: string }[] = []
  public removeLog: string[] = []

  private _onDidChangeTrack = new vscode.EventEmitter<ContextTrack>()
  public readonly onDidChangeTrack = this._onDidChangeTrack.event

  public fireTrackChange(track: ContextTrack) {
    this._onDidChangeTrack.fire(track)
  }

  getActiveTrack(): ContextTrack {
    return { id: 'test', name: 'Test', files: [] }
  }

  hasUri(uri: vscode.Uri): boolean {
    return this.trackedUris.has(uri.toString())
  }

  replaceUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    this.replaceLog.push({
      old: oldUri.toString(),
      new: newUri.toString(),
    })
  }

  removeUriEverywhere(uri: vscode.Uri): void {
    this.removeLog.push(uri.toString())
  }
}

suite('FileWatcherService Integration Tests', () => {
  let service: FileWatcherService
  let mockWatcher: MockWatcher
  let mockManager: MockTrackManager
  let clock: sinon.SinonFakeTimers

  let createWatcherStub: sinon.SinonStub
  let renameStub: sinon.SinonStub
  let deleteStub: sinon.SinonStub
  let remoteNameStub: sinon.SinonStub

  let capturedRenameListener: (e: vscode.FileRenameEvent) => void
  let capturedDeleteListener: (e: vscode.FileDeleteEvent) => void

  setup(() => {
    clock = sinon.useFakeTimers()
    mockWatcher = new MockWatcher()
    mockManager = new MockTrackManager()

    remoteNameStub = sinon.stub(vscode.env, 'remoteName').get(() => undefined)

    createWatcherStub = sinon.stub(vscode.workspace, 'createFileSystemWatcher').returns(mockWatcher)

    renameStub = sinon.stub(vscode.workspace, 'onDidRenameFiles').callsFake((listener: any) => {
      capturedRenameListener = listener
      return { dispose: () => {} }
    })

    deleteStub = sinon.stub(vscode.workspace, 'onDidDeleteFiles').callsFake((listener: any) => {
      capturedDeleteListener = listener
      return { dispose: () => {} }
    })

    service = new FileWatcherService(mockManager as unknown as TrackManager)
  })

  teardown(() => {
    service.dispose()
    mockWatcher.dispose()
    createWatcherStub.restore()
    renameStub.restore()
    deleteStub.restore()
    remoteNameStub.restore()
    clock.restore()
  })

  test('Should Handle High-Level VS Code Rename', async () => {
    const oldUri = vscode.Uri.file('/src/old.ts')
    const newUri = vscode.Uri.file('/src/new.ts')

    mockManager.trackedUris.add(oldUri.toString())

    capturedRenameListener({
      files: [{ oldUri, newUri }],
    })

    assert.strictEqual(mockManager.replaceLog.length, 1)
    assert.strictEqual(mockManager.replaceLog[0].old, oldUri.toString())
    assert.strictEqual(mockManager.replaceLog[0].new, newUri.toString())
  })

  test('Should Handle High-Level VS Code Delete', async () => {
    const uri = vscode.Uri.file('/src/deleted.ts')

    mockManager.trackedUris.add(uri.toString())

    capturedDeleteListener({
      files: [uri],
    })

    assert.strictEqual(mockManager.removeLog.length, 1)
    assert.strictEqual(mockManager.removeLog[0], uri.toString())
  })

  test('Should Handle Low-Level External Delete (Fallback)', async () => {
    const uri = vscode.Uri.file('/src/external_delete.ts')

    mockManager.trackedUris.add(uri.toString())

    mockManager.fireTrackChange({
      id: 'test',
      name: 'Test',
      files: [{ type: 'file', uri, label: 'file', isPinned: false }],
    })

    mockWatcher.fireDelete(uri)

    await clock.tickAsync(250)

    assert.strictEqual(mockManager.removeLog.length, 1)
    assert.strictEqual(mockManager.removeLog[0], uri.toString())
  })

  test('Should Rebuild Scoped Watcher on Track Change', async () => {
    const trackA: ContextTrack = {
      id: '1',
      name: 'A',
      files: [{ type: 'file', uri: vscode.Uri.file('/a.ts'), label: 'a', isPinned: false }],
    }

    mockManager.fireTrackChange(trackA)

    assert.strictEqual(createWatcherStub.called, true)
    assert.ok(createWatcherStub.lastCall.args[0].includes('/a.ts'))
  })
})
