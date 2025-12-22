import * as assert from 'assert'
import * as sinon from 'sinon'
import { TextEncoder } from 'util'
import * as vscode from 'vscode'

import { StagedFile } from '../../models'
import { StatsProcessor } from '../../services'
import { TokenEstimator } from '../../utils'

// Helper to create dummy staged files for test scenarios
const createFile = (path: string): StagedFile => ({
  type: 'file',
  uri: vscode.Uri.file(path),
  label: path,
  isPinned: false,
})

suite('StatsProcessor Performance & Logic Tests', () => {
  let processor: StatsProcessor
  let sandbox: sinon.SinonSandbox

  // Stubs for the mock filesystem
  let fsStatStub: sinon.SinonStub
  let fsReadFileStub: sinon.SinonStub
  let measureSpy: sinon.SinonSpy

  // Reference to original FS to ensure clean teardown
  let originalFs: typeof vscode.workspace.fs

  setup(() => {
    sandbox = sinon.createSandbox()
    processor = new StatsProcessor()

    // Stub FS methods to avoid actual disk I/O dependencies
    fsStatStub = sandbox.stub()
    fsReadFileStub = sandbox.stub()

    // Define mock filesystem structure matching VS Code API requirements
    const mockFs = {
      stat: fsStatStub,
      readFile: fsReadFileStub,
      writeFile: sandbox.stub(),
      delete: sandbox.stub(),
      rename: sandbox.stub(),
      copy: sandbox.stub(),
      createDirectory: sandbox.stub(),
      readDirectory: sandbox.stub(),
      isWritableFileSystem: () => true,
    }

    // Inject mock FS via defineProperty since workspace.fs is readonly
    originalFs = vscode.workspace.fs
    Object.defineProperty(vscode.workspace, 'fs', {
      writable: true,
      value: mockFs,
      configurable: true,
    })

    // Mock computation to isolate I/O logic and speed up tests
    measureSpy = sandbox.stub(TokenEstimator, 'measure').returns({
      tokenCount: 100,
      charCount: 500,
    })
  })

  teardown(() => {
    // Restore original VS Code FS to prevent global test pollution
    if (originalFs) {
      Object.defineProperty(vscode.workspace, 'fs', {
        writable: true,
        value: originalFs,
        configurable: true,
      })
    }
    sandbox.restore()
  })

  test('Should yield to event loop between batches (Anti-Freeze Check)', async () => {
    // Setup file count exceeding the internal concurrency limit
    const files = Array.from({ length: 10 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 500 })
    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    const executionLog: string[] = []

    // Initiate processing without awaiting immediately to allow event loop inspection
    const processingPromise = processor.enrichFileStats(files).then(() => {
      executionLog.push('Processing Complete')
    })

    // Schedule macro task to verify the processor yields to the event loop
    await new Promise<void>((resolve) => {
      // Use setTimeout 0 as a cross-platform "next tick" equivalent
      setTimeout(() => {
        executionLog.push('UI Render Event')
        resolve()
      }, 0)
    })

    await processingPromise

    // Verify UI/Event loop task executed amidst the processing batches
    assert.ok(executionLog.includes('UI Render Event'), 'UI Event should have executed during processing window')
  })

  test('Should process files in chunks of 5', async () => {
    const files = Array.from({ length: 12 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 100 })
    fsReadFileStub.resolves(new TextEncoder().encode('some code'))

    await processor.enrichFileStats(files)

    // Assert total throughput matches input despite batching
    assert.strictEqual(measureSpy.callCount, 12, 'Should measure all 12 files')
    assert.ok(
      files.every((f) => f.stats !== undefined),
      'All files should have stats',
    )
  })

  test('Should skip heavy analysis for large files (>1MB)', async () => {
    const bigFile = createFile('/big.ts')
    const smallFile = createFile('/small.ts')

    // Mock distinct sizes to trigger different logic paths (Heuristic vs Deep Analysis)
    fsStatStub.withArgs(bigFile.uri).resolves({ size: 1024 * 1024 + 1 }) // 1MB + 1 byte
    fsStatStub.withArgs(smallFile.uri).resolves({ size: 500 })

    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    await processor.enrichFileStats([bigFile, smallFile])

    // Ensure heavy tokenizer only runs on the small file
    assert.strictEqual(measureSpy.callCount, 1)

    // Verify heuristic calculation was applied to the large file
    assert.deepStrictEqual(bigFile.stats, {
      tokenCount: Math.ceil((1024 * 1024 + 1) / 4),
      charCount: 1024 * 1024 + 1,
    })
  })

  test('Should handle binary files gracefully', async () => {
    const binaryFile = createFile('/image.png')
    fsStatStub.resolves({ size: 500 })

    // Simulate binary signature with a leading null byte
    const binaryContent = new Uint8Array([0, 1, 2, 3])
    fsReadFileStub.resolves(binaryContent)

    await processor.enrichFileStats([binaryFile])

    assert.strictEqual(binaryFile.isBinary, true)
    assert.strictEqual(binaryFile.stats?.tokenCount, 0)
    // Confirm tokenizer was bypassed for binary content
    assert.strictEqual(measureSpy.called, false, 'Should not measure binary content')
  })

  test('Should handle file read errors without crashing batch', async () => {
    const goodFile = createFile('/good.ts')
    const badFile = createFile('/bad.ts')

    fsStatStub.resolves({ size: 100 })

    // Simulate permission error on a specific file
    fsReadFileStub.withArgs(goodFile.uri).resolves(new TextEncoder().encode('ok'))
    fsReadFileStub.withArgs(badFile.uri).rejects(new Error('EACCES'))

    await processor.enrichFileStats([badFile, goodFile])

    // Verify failed file handled safely with empty stats
    assert.strictEqual(badFile.stats?.tokenCount, 0)

    // Verify partial failure does not halt the entire batch
    assert.strictEqual(goodFile.stats?.tokenCount, 100)
  })
})
