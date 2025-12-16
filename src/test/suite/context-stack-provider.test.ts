import * as assert from 'assert'
import * as vscode from 'vscode'

import { ContextStackProvider } from '../../providers/context-stack-provider'

// High-level suite for ContextStackProvider unit tests
suite('ContextStackProvider Test Suite', () => {
  // The provider instance under test
  let provider: ContextStackProvider

  // Helper function to create a VS Code Uri object for file paths
  const createUri = (path: string) => vscode.Uri.file(path)

  // Setup runs before each test
  setup(() => {
    // Instantiate a fresh provider for state isolation
    provider = new ContextStackProvider()
  })

  // Teardown runs after each test
  teardown(() => {
    // Clean up resources, specifically the internal EventEmitter
    provider.dispose()
  })

  // Test the initial state upon instantiation
  test('Initial state should be empty', () => {
    assert.strictEqual(provider.getFiles().length, 0)
  })

  // Test adding a single file and verifying the tree data change event
  test('addFile: Should add a single file and fire event', async () => {
    const uri = createUri('/path/to/test.ts')
    let eventFired = false

    // Subscribe to the change event to track if it's fired
    const disposable = provider.onDidChangeTreeData(() => {
      eventFired = true
    })

    provider.addFile(uri)

    // Assertions on state change and event firing
    const files = provider.getFiles()
    assert.strictEqual(files.length, 1)
    assert.strictEqual(files[0].uri.toString(), uri.toString())
    assert.strictEqual(eventFired, true, 'Event should fire on add')

    disposable.dispose()
  })

  // Test the deduplication logic for single file adds
  test('addFile: Should prevent duplicate files', () => {
    const uri = createUri('/path/to/test.ts')

    provider.addFile(uri)
    // Attempt to add the same URI again
    provider.addFile(uri)

    const files = provider.getFiles()
    assert.strictEqual(files.length, 1, 'Should not add duplicate URI')
  })

  // Test adding multiple URIs at once, including an existing one
  test('addFiles: Should add multiple files and deduplicate existing ones', () => {
    const uri1 = createUri('/path/to/a.ts')
    const uri2 = createUri('/path/to/b.ts')

    // Stage uri1 first
    provider.addFile(uri1)

    // Add both uri1 (duplicate) and uri2 (new)
    provider.addFiles([uri1, uri2])

    const files = provider.getFiles()
    // Only 2 unique files should exist in the stack
    assert.strictEqual(files.length, 2)
    assert.ok(files.find((f) => f.uri.toString() === uri1.toString()))
    assert.ok(files.find((f) => f.uri.toString() === uri2.toString()))
  })

  // Test removing a specific staged file
  test('removeFile: Should remove specific file', () => {
    const uri1 = createUri('/path/to/a.ts')
    const uri2 = createUri('/path/to/b.ts')

    provider.addFiles([uri1, uri2])

    // Find the staged object for uri1 to pass to the remove method
    const fileToRemove = provider.getFiles().find((f) => f.uri.toString() === uri1.toString())

    if (fileToRemove) {
      provider.removeFile(fileToRemove)
    }

    const files = provider.getFiles()
    assert.strictEqual(files.length, 1)
    assert.strictEqual(files[0].uri.toString(), uri2.toString())
  })

  // Test clearing the entire context stack
  test('clear: Should remove all files', () => {
    provider.addFile(createUri('/path/to/a.ts'))
    provider.addFile(createUri('/path/to/b.ts'))

    assert.strictEqual(provider.getFiles().length, 2)

    let eventFired = false
    // Subscribe to event before clearing
    const disposable = provider.onDidChangeTreeData(() => (eventFired = true))

    provider.clear()

    // Assert state is empty and event fired
    assert.strictEqual(provider.getFiles().length, 0)
    assert.strictEqual(eventFired, true, 'Event should fire on clear')

    disposable.dispose()
  })

  // Test the implementation of the required TreeDataProvider method
  test('getTreeItem: Should generate correct Item properties', () => {
    const uri = createUri('/my/project/src/index.ts')
    provider.addFile(uri)
    const stagedFile = provider.getFiles()[0]

    // Call the VS Code API method implementation
    const treeItem = provider.getTreeItem(stagedFile)

    // Validate key properties for the VS Code TreeView
    assert.strictEqual(treeItem.label, 'index.ts', 'Label should be the filename')
    assert.strictEqual(treeItem.contextValue, 'stagedFile', 'Context value is required for menus')
    assert.strictEqual(treeItem.tooltip, uri.fsPath, 'Tooltip should be full path')

    // Check the custom URI scheme used for displaying content
    assert.strictEqual(treeItem.resourceUri?.scheme, 'ai-stack')
  })
})
