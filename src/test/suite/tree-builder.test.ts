import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { isStagedFolder, StagedFile, StagedFolder } from '../../models'
import { TreeBuilder } from '../../services/tree-builder'

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
    const files = [createFile('README.md'), createFile('LICENSE')]
    mockPaths(files, ['README.md', 'LICENSE'])

    const result = builder.build(files)

    assert.strictEqual(result.length, 2)
    assert.ok(result.every((item) => item.type === 'file'))
  })

  test('Should create nested folders for deep paths', () => {
    const deepFile = createFile('/src/utils/math.ts')
    mockPaths([deepFile], ['src/utils/math.ts'])

    const result = builder.build([deepFile])

    const srcFolder = result[0] as StagedFolder
    assertFolder(srcFolder, 'src')

    const utilsFolder = srcFolder.children.find((c) => c.label === 'utils') as StagedFolder
    assert.ok(utilsFolder, 'Should have utils folder')
    assertFolder(utilsFolder, 'utils')

    const mathFile = utilsFolder.children.find((c) => c.label === 'math.ts')
    assert.ok(mathFile, 'Should have math.ts')
  })

  test('Should sort folders before files alphabetically', () => {
    const file = createFile('config.json')
    const fileInFolder = createFile('assets/logo.png')

    mockPaths([file, fileInFolder], ['config.json', 'assets/logo.png'])

    const result = builder.build([file, fileInFolder])

    assertFolder(result[0] as StagedFolder, 'assets')
    assert.strictEqual(result[1].label, 'config.json')
  })

  test('Should associate files with their immediate parent folder', () => {
    const fileA = createFile('src/a.ts')
    const fileB = createFile('src/nested/b.ts')
    mockPaths([fileA, fileB], ['src/a.ts', 'src/nested/b.ts'])

    const result = builder.build([fileA, fileB])

    const srcFolder = result[0] as StagedFolder

    const hasA = srcFolder.containedFiles.some((f) => f.uri.path === fileA.uri.path)
    assert.strictEqual(hasA, true, 'src should contain a.ts directly')

    const hasB = srcFolder.containedFiles.some((f) => f.uri.path === fileB.uri.path)
    assert.strictEqual(hasB, false, 'src should not contain b.ts directly')

    const nestedFolder = srcFolder.children.find((c) => c.label === 'nested') as StagedFolder
    assert.ok(nestedFolder)
    const nestedHasB = nestedFolder.containedFiles.some((f) => f.uri.path === fileB.uri.path)
    assert.strictEqual(nestedHasB, true, 'nested should contain b.ts directly')
  })

  function setupMocks(sb: sinon.SinonSandbox): void {
    sb.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: vscode.Uri.file('/root'),
        name: 'root',
        index: 0,
      },
    ])

    sb.stub(vscode.workspace, 'getWorkspaceFolder').returns({
      uri: vscode.Uri.file('/root'),
      name: 'root',
      index: 0,
    })

    asRelativePathStub = sb.stub(vscode.workspace, 'asRelativePath')
  }

  function mockPaths(files: StagedFile[], paths: string[]): void {
    files.forEach((file, index) => {
      asRelativePathStub.withArgs(file.uri, sinon.match.any).returns(paths[index])
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
