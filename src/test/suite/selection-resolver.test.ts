import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { StagedFile, StagedFolder } from '../../models'
import { ContextStackProvider } from '../../providers'
import { SelectionResolver } from '../../utils/selection-resolver'

/**
 * Validates the logic gate for file selection.
 * Ensures strict hierarchy adherence (Context > Tree > All) and correct folder flattening.
 */
suite('SelectionResolver Suite', () => {
  let sandbox: sinon.SinonSandbox
  let mockProvider: sinon.SinonStubbedInstance<ContextStackProvider>
  let mockTreeView: any // Type as 'any' to easily stub read-only properties like 'selection'

  const fileA = createFile('a.ts', 'src/a.ts')
  const fileB = createFile('b.ts', 'src/b.ts')
  const fileC = createFile('c.ts', 'src/c.ts')

  setup(() => {
    sandbox = sinon.createSandbox()

    // Create a mock provider with the correct prototype
    mockProvider = sandbox.createStubInstance(ContextStackProvider)
    mockProvider.getFiles.returns([fileA, fileB, fileC])

    // Mock TreeView state
    mockTreeView = {
      selection: [],
    }
  })

  teardown(() => {
    sandbox.restore()
  })

  // --- Hierarchy Logic Tests ---

  test('Priority 1: Should prefer context menu multi-selection over everything', () => {
    // Arrange: All inputs populated, but 'selectedItems' (multi-select) should win
    const multiSelect = [fileA, fileB]
    const singleClick = fileC
    mockTreeView.selection = [fileC]

    // Act
    const result = SelectionResolver.resolve(singleClick, multiSelect, mockTreeView, mockProvider)

    // Assert
    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileA, fileB])
  })

  test('Priority 2: Should prefer single clicked item if no multi-selection exists', () => {
    // Arrange: No multi-select, but clicked item exists
    mockTreeView.selection = [fileB] // Tree selection should be ignored

    // Act
    const result = SelectionResolver.resolve(fileA, undefined, mockTreeView, mockProvider)

    // Assert
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].uri.toString(), fileA.uri.toString())
  })

  test('Priority 3: Should fallback to TreeView selection if no context interactions', () => {
    // Arrange
    mockTreeView.selection = [fileB, fileC]

    // Act
    const result = SelectionResolver.resolve(undefined, undefined, mockTreeView, mockProvider)

    // Assert
    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileB, fileC])
  })

  test('Priority 4: Should fallback to Implicit All (provider.getFiles) if absolutely nothing selected', () => {
    // Arrange: Empty everything
    mockTreeView.selection = []

    // Act
    const result = SelectionResolver.resolve(undefined, undefined, mockTreeView, mockProvider)

    // Assert
    assert.strictEqual(result.length, 3)
    assert.ok(mockProvider.getFiles.calledOnce)
  })

  // --- Flattening & Deduplication Tests ---

  test('Should flatten folders into their contained files', () => {
    // Arrange: Create a folder containing A and B
    const folder = createFolder('src', [fileA, fileB])

    // Act
    const result = SelectionResolver.resolve(folder, undefined, mockTreeView, mockProvider)

    // Assert
    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileA, fileB])
  })

  test('Should deduplicate files if both parent folder and child file are selected', () => {
    // Arrange: Folder contains A. Selection is [Folder, FileA].
    const folder = createFolder('src', [fileA])
    const multiSelect = [folder, fileA]

    // Act
    const result = SelectionResolver.resolve(undefined, multiSelect, mockTreeView, mockProvider)

    // Assert: A should appear only once
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].uri.toString(), fileA.uri.toString())
  })

  // --- Feedback Label Tests ---

  test('Feedback: Should return filename for single file', () => {
    const label = SelectionResolver.getFeedbackLabel([fileA], 10)
    assert.strictEqual(label, 'a.ts')
  })

  test('Feedback: Should return "All Staged Files" if count matches total', () => {
    const label = SelectionResolver.getFeedbackLabel([fileA, fileB], 2)
    assert.strictEqual(label, 'All Staged Files')
  })

  test('Feedback: Should return "X Files" for subsets', () => {
    const label = SelectionResolver.getFeedbackLabel([fileA, fileB], 10)
    assert.strictEqual(label, '2 Files')
  })
})

// --- Helpers ---

function createFile(label: string, path: string): StagedFile {
  return {
    type: 'file',
    label,
    uri: vscode.Uri.file(path),
  }
}

function createFolder(label: string, files: StagedFile[]): StagedFolder {
  return {
    type: 'folder',
    id: `folder:${label}`,
    label,
    resourceUri: vscode.Uri.file(label),
    children: [], // Children structure irrelevant for this specific test
    containedFiles: files,
  }
}
