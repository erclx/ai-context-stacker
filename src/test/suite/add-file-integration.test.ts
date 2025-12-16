import * as assert from 'assert'
import * as path from 'path'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { registerAddFileContextMenuCommand } from '../../commands/add-file-context-menu'
import { ContextStackProvider } from '../../providers'
import { IgnorePatternProvider } from '../../providers'

// Integration-level tests validating the add-file context menu command behavior
// against real filesystem interactions and provider state changes
suite('Integration: Add File Logic', () => {
  // Provider instances for testing state
  let contextStackProvider: ContextStackProvider
  let ignoreProvider: IgnorePatternProvider
  // Mock context for command registration
  let extensionContext: vscode.ExtensionContext

  // Stub for intercepting VS Code command registration
  let registerCommandStub: sinon.SinonStub
  // Captured command callback to allow direct invocation in tests
  let commandCallback: Function

  // Setup for each test case
  setup(() => {
    // Create fresh provider instances for each test to avoid state leakage
    contextStackProvider = new ContextStackProvider()
    ignoreProvider = new IgnorePatternProvider()

    // Minimal mock of ExtensionContext
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext

    // Stub command registration to capture the command callback for manual execution
    registerCommandStub = sinon.stub(vscode.commands, 'registerCommand')

    // Capture the callback for the specific command under test
    registerCommandStub.callsFake((commandId, callback) => {
      if (commandId === 'aiContextStacker.addFileToStack') {
        commandCallback = callback
      }
      return { dispose: () => {} }
    })

    // Register the command, which executes the stub and captures the callback
    registerAddFileContextMenuCommand(extensionContext, contextStackProvider, ignoreProvider)
  })

  // Cleanup after each test
  teardown(() => {
    // Dispose providers to clean up watchers and event emitters
    contextStackProvider.dispose()
    ignoreProvider.dispose()

    // Restore all sinon stubs
    sinon.restore()
  })

  // Test adding a single file via the context menu command
  test('Command Logic: Should add a single file when selected', async () => {
    // Get a URI for a real file in the workspace (package.json)
    const rootPath = path.resolve(__dirname, '../../../')
    const packageJsonUri = vscode.Uri.file(path.join(rootPath, 'package.json'))

    // Check if the command callback was successfully captured
    assert.ok(commandCallback, 'Command callback was not captured')

    // Execute the captured command logic, simulating a single file selection
    await commandCallback(packageJsonUri, [packageJsonUri])

    // Validate that the provider state reflects the added file
    const files = contextStackProvider.getFiles()
    assert.strictEqual(files.length, 1, 'Should have 1 file staged')
    assert.strictEqual(files[0].label, 'package.json', 'Should match the added file')
  })

  // Test scanning an entire folder and adding all valid files
  test('Command Logic: Should scan folder and add nested files', async () => {
    // Target a real folder (e.g., 'src/commands')
    const rootPath = path.resolve(__dirname, '../../../')
    const commandsFolderUri = vscode.Uri.file(path.join(rootPath, 'src/commands'))

    // Check if the command callback was successfully captured
    assert.ok(commandCallback, 'Command callback was not captured')

    // Execute the command logic, simulating a folder selection
    // This relies on real VS Code file system stat and findFiles calls
    await commandCallback(commandsFolderUri, [commandsFolderUri])

    // Validate that multiple files were added from the folder scan
    const files = contextStackProvider.getFiles()
    assert.ok(files.length > 2, `Should have found multiple files, found ${files.length}`)

    // Check for a known file expected in the scanned directory
    const hasAddFile = files.some((f) => f.label === 'add-file.ts')
    assert.ok(hasAddFile, 'Should include add-file.ts from the scanned folder')
  })
})
