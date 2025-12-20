import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { isStagedFolder, StagedFile, StagedFolder } from '../../models'
import { TreeBuilder } from '../../services/tree-builder'

/**
 * Validates the transformation of flat file lists into a hierarchical TreeView model.
 * Focuses on recursion logic, sorting, and virtual folder integrity.
 */
suite('TreeBuilder Suite', () => {
  let builder: TreeBuilder
  let sandbox: sinon.SinonSandbox
  let asRelativePathStub: sinon.SinonStub

  setup(() => {
    sandbox = sinon.createSandbox()
    builder = new TreeBuilder()
    setupMocks(sandbox)
  })

  teardown(() => {
    sandbox.restore()
  })

  test('Should maintain flat structure for files in root', () => {
    // Arrange
    const files = [createFile('README.md'), createFile('LICENSE')]
    mockPaths(files, ['README.md', 'LICENSE'])

    // Act
    const result = builder.build(files)

    // Assert
    assert.strictEqual(result.length, 2)
    assert.ok(result.every((item) => item.type === 'file'))
  })

  test('Should create nested folders for deep paths', () => {
    // Arrange: src/utils/math.ts
    const deepFile = createFile('/src/utils/math.ts')
    mockPaths([deepFile], ['src/utils/math.ts'])

    // Act
    const result = builder.build([deepFile])

    // Assert
    const srcFolder = result[0] as StagedFolder
    assertFolder(srcFolder, 'src')

    const utilsFolder = srcFolder.children[0] as StagedFolder
    assertFolder(utilsFolder, 'utils')

    assert.strictEqual(utilsFolder.children[0].label, 'math.ts')
  })

  test('Should sort folders before files alphabetically', () => {
    // Arrange: 'config.json' (file) vs 'assets/logo.png' (folder)
    const file = createFile('config.json')
    const fileInFolder = createFile('assets/logo.png')

    mockPaths([file, fileInFolder], ['config.json', 'assets/logo.png'])

    // Act
    const result = builder.build([file, fileInFolder])

    // Assert: Folder 'assets' comes before file 'config.json'
    assertFolder(result[0] as StagedFolder, 'assets')
    assert.strictEqual(result[1].label, 'config.json')
  })

  test('Should aggregate all leaf nodes in folder.containedFiles', () => {
    // Arrange
    const fileA = createFile('src/a.ts')
    const fileB = createFile('src/b.ts')
    mockPaths([fileA, fileB], ['src/a.ts', 'src/b.ts'])

    // Act
    const result = builder.build([fileA, fileB])

    // Assert
    const srcFolder = result[0] as StagedFolder
    assert.strictEqual(srcFolder.containedFiles.length, 2, 'Should contain both nested files')
    assert.deepStrictEqual(srcFolder.containedFiles, [fileA, fileB])
  })

  // --- Helpers ---

  function setupMocks(sb: sinon.SinonSandbox): void {
    // Mock workspace folder to prevent "undefined" errors during folder creation
    sb.stub(vscode.workspace, 'getWorkspaceFolder').returns({
      uri: vscode.Uri.file('/root'),
      name: 'root',
      index: 0,
    })

    // Stub asRelativePath to control path segments deterministically
    asRelativePathStub = sb.stub(vscode.workspace, 'asRelativePath')
  }

  /**
   * Configures the relative path mock to return specific paths for given URIs.
   */
  function mockPaths(files: StagedFile[], paths: string[]): void {
    files.forEach((file, index) => {
      asRelativePathStub.withArgs(file.uri).returns(paths[index])
    })
  }

  function createFile(path: string): StagedFile {
    return {
      type: 'file',
      label: path.split('/').pop() || path,
      uri: vscode.Uri.file(path),
    }
  }

  function assertFolder(item: any, expectedLabel: string): void {
    assert.strictEqual(isStagedFolder(item), true, `Item ${item.label} should be a folder`)
    assert.strictEqual(item.label, expectedLabel)
  }
})
