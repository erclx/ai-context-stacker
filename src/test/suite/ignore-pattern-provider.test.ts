import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

// Relative imports
import { IgnorePatternProvider } from '../../providers'
import { Logger } from '../../utils'

// Suite for testing the IgnorePatternProvider logic, including caching and watchers
suite('IgnorePatternProvider Test Suite', () => {
  // The provider instance under test
  let provider: IgnorePatternProvider

  // Stubs for VS Code API and internal methods
  let findFilesStub: sinon.SinonStub
  let readFileStub: sinon.SinonStub
  let watcherStub: sinon.SinonStub
  let loggerInfoStub: sinon.SinonStub
  let loggerErrorStub: sinon.SinonStub

  // Mock Event Emitters to simulate file system changes
  let onDidChangeEmitter: vscode.EventEmitter<vscode.Uri>
  let onDidCreateEmitter: vscode.EventEmitter<vscode.Uri>
  let onDidDeleteEmitter: vscode.EventEmitter<vscode.Uri>

  // Setup runs before each test
  setup(() => {
    // 1. Setup Emitters for the FileSystemWatcher events
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>()
    onDidCreateEmitter = new vscode.EventEmitter<vscode.Uri>()
    onDidDeleteEmitter = new vscode.EventEmitter<vscode.Uri>()

    // 2. Stub the watcher creation to return a mock watcher with our Emitters
    // This ensures the provider's constructor registers listeners on our mock events
    watcherStub = sinon.stub(vscode.workspace, 'createFileSystemWatcher').returns({
      ignoreCreateEvents: false,
      ignoreChangeEvents: false,
      ignoreDeleteEvents: false,
      onDidChange: onDidChangeEmitter.event,
      onDidCreate: onDidCreateEmitter.event,
      onDidDelete: onDidDeleteEmitter.event,
      dispose: () => {},
    } as any)

    // 3. Stub the VS Code file searching API
    findFilesStub = sinon.stub(vscode.workspace, 'findFiles')

    // 4. Silence and track Logger calls
    loggerInfoStub = sinon.stub(Logger, 'info')
    loggerErrorStub = sinon.stub(Logger, 'error')

    // 5. Instantiate Provider (this triggers initWatcher() and uses the stubbed watcher)
    provider = new IgnorePatternProvider()

    // 6. Stub the internal method for reading file content from disk
    readFileStub = sinon.stub(provider, 'readFile')
  })

  // Teardown runs after each test
  teardown(() => {
    // Dispose the provider's internal watcher
    provider?.dispose()

    // Restore all stubs and mocks
    sinon.restore()
    // Clean up mock event emitters
    onDidChangeEmitter?.dispose()
    onDidCreateEmitter?.dispose()
    onDidDeleteEmitter?.dispose()
  })

  // Test the case where no .gitignore is found in the workspace
  test('getExcludePatterns: Should return fallback patterns if .gitignore is missing', async () => {
    // Mock findFiles to return an empty array (no .gitignore)
    findFilesStub.resolves([])

    const patterns = await provider.getExcludePatterns()

    // Assert that the resulting pattern string contains a known fallback default
    assert.ok(patterns.includes('node_modules'), 'Should include fallback defaults')
    // Ensure disk read was skipped
    assert.strictEqual(readFileStub.called, false, 'Should not read file if not found')
  })

  // Test the logic for parsing and combining patterns from a .gitignore file
  test('getExcludePatterns: Should parse .gitignore content correctly', async () => {
    const uri = vscode.Uri.file('/root/.gitignore')
    // Mock findFiles to return a .gitignore URI
    findFilesStub.resolves([uri])

    const gitIgnoreContent = `
        # Comment
        node_modules
        /dist/
        *.log
    `
    // Mock the file read to return the test content
    readFileStub.resolves(new Uint8Array(Buffer.from(gitIgnoreContent)))

    const patterns = await provider.getExcludePatterns()

    // Assert the resulting pattern string has correctly processed/prefixed patterns
    assert.ok(patterns.includes('**/node_modules'))
    assert.ok(patterns.includes('**/dist'))
    assert.ok(patterns.includes('**/*.log'))
    assert.ok(!patterns.includes('#'))
  })

  // Test that the caching mechanism works by preventing unnecessary disk reads
  test('Caching: Should not read file system twice if cache is valid', async () => {
    const uri = vscode.Uri.file('/root/.gitignore')
    findFilesStub.resolves([uri])
    readFileStub.resolves(new Uint8Array(Buffer.from('temp')))

    // First Call (Cache Miss, reads from disk)
    await provider.getExcludePatterns()

    // Second Call (Cache Hit, reads from memory)
    await provider.getExcludePatterns()

    // Assert readFileStub was only called once
    assert.strictEqual(readFileStub.calledOnce, true)
  })

  // Test that the file system watcher correctly invalidates the cache on change events
  test('Cache Invalidation: Should re-read file after .gitignore changes', async () => {
    const uri = vscode.Uri.file('/root/.gitignore')
    findFilesStub.resolves([uri])
    readFileStub.resolves(new Uint8Array(Buffer.from('temp')))

    // First read (populates cache)
    await provider.getExcludePatterns()
    assert.strictEqual(readFileStub.callCount, 1)

    // Trigger Watcher on change event (invalidates cache)
    onDidChangeEmitter.fire(uri)

    // Second read (forces disk read due to cache miss)
    await provider.getExcludePatterns()
    assert.strictEqual(readFileStub.callCount, 2)
  })

  // Test recovery mechanism when reading the .gitignore file fails
  test('Error Handling: Should fallback to defaults if reading .gitignore fails', async () => {
    findFilesStub.resolves([vscode.Uri.file('/root/.gitignore')])

    // Mock the readFile method to throw an error
    readFileStub.rejects(new Error('Permission denied'))

    const patterns = await provider.getExcludePatterns()

    // Assert fallback defaults are used
    assert.ok(patterns.includes('node_modules'))
    // Assert the error was logged
    assert.ok(loggerErrorStub.called)
  })
})
