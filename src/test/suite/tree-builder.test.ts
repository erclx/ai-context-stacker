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
    builder.reset()
    sandbox.restore()
  })

  test('Should maintain flat structure for files in root', async () => {
    const files = [createFile('README.md'), createFile('LICENSE')]
    mockPaths(files, ['README.md', 'LICENSE'])

    const result = await builder.buildAsync(files)

    assert.strictEqual(result.length, 2)
    assert.ok(result.every((item) => item.type === 'file'))
  })

  test('Should create nested folders for deep paths', async () => {
    const deepFile = createFile('/src/utils/math.ts')
    mockPaths([deepFile], ['src/utils/math.ts'])

    const result = await builder.buildAsync([deepFile])

    const srcFolder = result[0] as StagedFolder
    assertFolder(srcFolder, 'src')

    const utilsFolder = srcFolder.children.find((c) => c.label === 'utils') as StagedFolder
    assert.ok(utilsFolder)
    assertFolder(utilsFolder, 'utils')

    const mathFile = utilsFolder.children.find((c) => c.label === 'math.ts')
    assert.ok(mathFile)
  })

  test('Should sort folders before files alphabetically', async () => {
    const file = createFile('config.json')
    const fileInFolder = createFile('assets/logo.png')

    mockPaths([file, fileInFolder], ['config.json', 'assets/logo.png'])

    const result = await builder.buildAsync([file, fileInFolder])

    assertFolder(result[0] as StagedFolder, 'assets')
    assert.strictEqual(result[1].label, 'config.json')
  })

  test('Should associate files with their immediate parent folder', async () => {
    const fileA = createFile('src/a.ts')
    const fileB = createFile('src/nested/b.ts')
    mockPaths([fileA, fileB], ['src/a.ts', 'src/nested/b.ts'])

    const result = await builder.buildAsync([fileA, fileB])

    const srcFolder = result[0] as StagedFolder

    const hasA = srcFolder.containedFiles.some((f) => f.uri.path === fileA.uri.path)
    assert.strictEqual(hasA, true)

    const hasB = srcFolder.containedFiles.some((f) => f.uri.path === fileB.uri.path)
    assert.strictEqual(hasB, false)

    const nestedFolder = srcFolder.children.find((c) => c.label === 'nested') as StagedFolder
    assert.ok(nestedFolder)
    const nestedHasB = nestedFolder.containedFiles.some((f) => f.uri.path === fileB.uri.path)
    assert.strictEqual(nestedHasB, true)
  })

  test('Should increment token stats on parents when file is added', async () => {
    const file = createFile('src/main.ts')
    file.stats = { tokenCount: 100, charCount: 500 }
    mockPaths([file], ['src/main.ts'])

    const result = await builder.buildAsync([file])
    const srcFolder = result[0] as StagedFolder

    assert.strictEqual(srcFolder.tokenCount, 100)
  })

  suite('Pin Propagation & Sorting', () => {
    test('Should propagate pin state from children to parents', async () => {
      const pinnedFile = createFile('src/pinned.ts')
      pinnedFile.isPinned = true
      const unpinnedFile = createFile('src/normal.ts')

      mockPaths([pinnedFile, unpinnedFile], ['src/pinned.ts', 'src/normal.ts'])

      const result = await builder.buildAsync([pinnedFile, unpinnedFile])
      const srcFolder = result[0] as StagedFolder

      assert.strictEqual(srcFolder.isPinned, true, 'Folder containing pinned file should be marked pinned')
    })

    test('Should sort pinned folders above unpinned folders (Pin Priority)', async () => {
      const pinnedFile = createFile('utils/important.ts')
      pinnedFile.isPinned = true

      const normalFile = createFile('api/endpoint.ts')

      mockPaths([pinnedFile, normalFile], ['utils/important.ts', 'api/endpoint.ts'])

      const result = await builder.buildAsync([pinnedFile, normalFile])

      assert.strictEqual(result.length, 2)

      assertFolder(result[0], 'utils')
      assert.strictEqual((result[0] as StagedFolder).isPinned, true)

      assertFolder(result[1], 'api')
    })

    test('Should resort correctly when mixed pinned and unpinned siblings exist', async () => {
      const fileA = createFile('a.ts')
      const fileB = createFile('b.ts')
      fileB.isPinned = true
      const fileC = createFile('c.ts')

      mockPaths([fileA, fileB, fileC], ['a.ts', 'b.ts', 'c.ts'])

      const result = await builder.buildAsync([fileA, fileB, fileC])

      assert.strictEqual(result[0].label, 'b.ts', 'Pinned file should be first')
      assert.strictEqual(result[1].label, 'a.ts', 'Unpinned files should follow alphabetical order')
      assert.strictEqual(result[2].label, 'c.ts')
    })
  })

  suite('Patch Logic', () => {
    test('Should incrementally add files to existing structure', async () => {
      const fileA = createFile('src/a.ts')
      mockPaths([fileA], ['src/a.ts'])
      await builder.buildAsync([fileA])

      const fileB = createFile('src/b.ts')
      mockPaths([fileB], ['src/b.ts'])

      const result = await builder.patch([fileB], [])
      const srcFolder = result[0] as StagedFolder

      assert.strictEqual(srcFolder.children.length, 2)
      assert.ok(srcFolder.children.find((c) => c.label === 'a.ts'))
      assert.ok(srcFolder.children.find((c) => c.label === 'b.ts'))
    })

    test('Should prune empty folders after removal', async () => {
      const file = createFile('src/utils/helper.ts')
      mockPaths([file], ['src/utils/helper.ts'])
      await builder.buildAsync([file])

      const result = await builder.patch([], [file])

      assert.strictEqual(result.length, 0)
    })

    test('Should not prune folders that still contain other files', async () => {
      const fileA = createFile('src/keep.ts')
      const fileB = createFile('src/remove.ts')
      mockPaths([fileA, fileB], ['src/keep.ts', 'src/remove.ts'])

      await builder.buildAsync([fileA, fileB])
      const result = await builder.patch([], [fileB])

      assert.strictEqual(result.length, 1)
      const srcFolder = result[0] as StagedFolder
      assert.strictEqual(srcFolder.children.length, 1)
      assert.strictEqual(srcFolder.children[0].label, 'keep.ts')
    })

    test('Should update token stats bubble-up on patch add/remove', async () => {
      const fileA = createFile('src/a.ts')
      fileA.stats = { tokenCount: 10, charCount: 10 }
      mockPaths([fileA], ['src/a.ts'])
      await builder.buildAsync([fileA])

      const fileB = createFile('src/b.ts')
      fileB.stats = { tokenCount: 20, charCount: 20 }
      mockPaths([fileB], ['src/b.ts'])

      let result = await builder.patch([fileB], [])
      let srcFolder = result[0] as StagedFolder
      assert.strictEqual(srcFolder.tokenCount, 30)

      result = await builder.patch([], [fileA])
      srcFolder = result[0] as StagedFolder
      assert.strictEqual(srcFolder.tokenCount, 20)
    })

    test('Should handle mixed add and remove in single operation', async () => {
      const fileA = createFile('a.ts')
      const fileB = createFile('b.ts')
      mockPaths([fileA, fileB], ['a.ts', 'b.ts'])

      await builder.buildAsync([fileA])

      const result = await builder.patch([fileB], [fileA])

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].label, 'b.ts')
    })
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
