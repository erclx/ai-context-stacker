import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { StagedFile, StagedFolder } from '../../models'
import { StackProvider } from '../../providers'
import { SelectionResolver } from '../../utils/selection-resolver'

suite('SelectionResolver Suite', () => {
  let sandbox: sinon.SinonSandbox
  let mockProvider: sinon.SinonStubbedInstance<StackProvider>
  let mockTreeView: any

  const fileA = createFile('a.ts', 'src/a.ts')
  const fileB = createFile('b.ts', 'src/b.ts')
  const fileC = createFile('c.ts', 'src/c.ts')

  setup(() => {
    sandbox = sinon.createSandbox()

    mockProvider = sandbox.createStubInstance(StackProvider)
    mockProvider.getFiles.returns([fileA, fileB, fileC])

    mockTreeView = {
      selection: [],
    }
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Priority 1: Should prefer context menu multi-selection over everything', () => {
    const multiSelect = [fileA, fileB]
    const singleClick = fileC
    mockTreeView.selection = [fileC]

    const result = SelectionResolver.resolve(singleClick, multiSelect, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileA, fileB])
  })

  test('Priority 2: Should prefer single clicked item if no multi-selection exists', () => {
    mockTreeView.selection = [fileB]

    const result = SelectionResolver.resolve(fileA, undefined, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].uri.toString(), fileA.uri.toString())
  })

  test('Priority 3: Should fallback to TreeView selection if no context interactions', () => {
    mockTreeView.selection = [fileB, fileC]

    const result = SelectionResolver.resolve(undefined, undefined, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileB, fileC])
  })

  test('Priority 4: Should fallback to Implicit All (provider.getFiles) if absolutely nothing selected', () => {
    mockTreeView.selection = []

    const result = SelectionResolver.resolve(undefined, undefined, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 3)
    assert.ok(mockProvider.getFiles.calledOnce)
  })

  test('Should flatten folders into their contained files', () => {
    const folder = createFolder('src', [fileA, fileB])

    const result = SelectionResolver.resolve(folder, undefined, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(result, [fileA, fileB])
  })

  test('Should deduplicate files if both parent folder and child file are selected', () => {
    const folder = createFolder('src', [fileA])
    const multiSelect = [folder, fileA]

    const result = SelectionResolver.resolve(undefined, multiSelect, mockTreeView, mockProvider)

    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].uri.toString(), fileA.uri.toString())
  })

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
    children: [],
    containedFiles: files,
  }
}
