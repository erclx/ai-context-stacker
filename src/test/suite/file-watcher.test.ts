import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ContextTrackManager } from '../../providers'
import { FileWatcherService } from '../../services'

// Mocks the VS Code FileSystemWatcher to allow manual event triggering
class MockWatcher implements vscode.FileSystemWatcher {
  ignoreCreateEvents = false
  ignoreChangeEvents = false
  ignoreDeleteEvents = false

  // Event Emitters to simulate filesystem events
  private _onDidCreate = new vscode.EventEmitter<vscode.Uri>()
  private _onDidDelete = new vscode.EventEmitter<vscode.Uri>()
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>()

  // Public Event Accessors exposed to the service under test
  readonly onDidCreate = this._onDidCreate.event
  readonly onDidDelete = this._onDidDelete.event
  readonly onDidChange = this._onDidChange.event

  // Helper methods to manually trigger events during testing
  fireCreate(uri: vscode.Uri) {
    this._onDidCreate.fire(uri)
  }
  fireDelete(uri: vscode.Uri) {
    this._onDidDelete.fire(uri)
  }

  // Clean up event emitters
  dispose() {
    this._onDidCreate.dispose()
    this._onDidDelete.dispose()
    this._onDidChange.dispose()
  }
}

// Mocks ContextTrackManager to intercept and verify calls to replaceUri/removeUri
class MockTrackManager {
  public trackedUris = new Set<string>()
  public replaceLog: { old: string; new: string }[] = []
  public removeLog: string[] = []

  // Simulate checking if a file is currently tracked
  hasUri(uri: vscode.Uri): boolean {
    return this.trackedUris.has(uri.toString())
  }

  // Log replacement calls for assertion
  replaceUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    this.replaceLog.push({
      old: oldUri.toString(),
      new: newUri.toString(),
    })
  }

  // Log removal calls for assertion
  removeUriEverywhere(uri: vscode.Uri): void {
    this.removeLog.push(uri.toString())
  }
}

suite('FileWatcherService Integration Tests', () => {
  let service: FileWatcherService
  let mockWatcher: MockWatcher
  let mockManager: MockTrackManager
  let clock: sinon.SinonFakeTimers
  let originalCreateWatcher: any

  setup(() => {
    // Take control of the system clock (Time Travel)
    clock = sinon.useFakeTimers()

    // Initialize the manual mock watcher
    mockWatcher = new MockWatcher()
    originalCreateWatcher = vscode.workspace.createFileSystemWatcher

    // Intercept the global VS Code API to return our controlled mock watcher
    Object.defineProperty(vscode.workspace, 'createFileSystemWatcher', {
      writable: true,
      value: () => mockWatcher,
    })

    // Setup the mock manager dependency
    mockManager = new MockTrackManager()
    service = new FileWatcherService(mockManager as unknown as ContextTrackManager)
  })

  teardown(() => {
    // Ensure service cleanup
    service.dispose()
    mockWatcher.dispose()

    // Restore the original VS Code API implementation
    Object.defineProperty(vscode.workspace, 'createFileSystemWatcher', {
      value: originalCreateWatcher,
    })

    // Release the clock and restore normal time
    clock.restore()
  })

  test('Should handle "Git Checkout" event storm (Rename Detection)', async () => {
    // Scenario: Simulate a Git checkout where a file moves from old to new location
    const oldUri = vscode.Uri.file('/src/old/A.ts')
    const newUri = vscode.Uri.file('/src/new/A.ts')

    // Pre-condition: File must be tracked to be eligible for rename detection
    mockManager.trackedUris.add(oldUri.toString())

    // Trigger simultaneous events to simulate an event storm
    mockWatcher.fireDelete(oldUri)
    mockWatcher.fireCreate(newUri)

    // Fast-forward time past the debounce window
    // tickAsync ensures async promises (flushBuffer) resolve before we assert
    await clock.tickAsync(250)

    // Verify that the delete and create were correctly correlated as a rename
    assert.strictEqual(mockManager.replaceLog.length, 1, 'Should detect 1 rename')
    assert.strictEqual(mockManager.replaceLog[0].old, oldUri.toString(), 'Should match old URI')
    assert.strictEqual(mockManager.replaceLog[0].new, newUri.toString(), 'Should match new URI')
    assert.strictEqual(mockManager.removeLog.length, 0, 'Should NOT treat as delete')
  })

  test('Should handle massive volume without blocking (1000 events)', async () => {
    const BATCH_SIZE = 1000
    const deletes: vscode.Uri[] = []

    // Generate a large set of tracked files to simulate heavy load
    for (let i = 0; i < BATCH_SIZE; i++) {
      const uri = vscode.Uri.file(`/src/file_${i}.ts`)
      deletes.push(uri)
      mockManager.trackedUris.add(uri.toString())
    }

    // Fire all events synchronously to test batching performance
    deletes.forEach((uri) => mockWatcher.fireDelete(uri))

    // Process the entire batch
    await clock.tickAsync(250)

    // Verify all events were processed in the single batch
    assert.strictEqual(mockManager.removeLog.length, BATCH_SIZE, 'Should process all deletes')
  })

  test('Should ignore events for untracked files', async () => {
    const untrackedUri = vscode.Uri.file('/src/ghost.ts')

    // Trigger a delete event for an untracked file
    mockWatcher.fireDelete(untrackedUri)
    await clock.tickAsync(250)

    // Ensure no action was taken
    assert.strictEqual(mockManager.removeLog.length, 0, 'Should ignore untracked file')
  })

  test('Should prevent race conditions on disposal', async () => {
    const uri = vscode.Uri.file('/src/race.ts')
    mockManager.trackedUris.add(uri.toString())

    // Trigger an event that schedules a buffered task
    mockWatcher.fireDelete(uri)

    // Dispose the service immediately, before the timer fires
    service.dispose()

    // Try to advance time
    await clock.tickAsync(250)

    // Verify that the buffered task was cancelled
    assert.strictEqual(mockManager.removeLog.length, 0, 'Should not process events after disposal')
  })
})
