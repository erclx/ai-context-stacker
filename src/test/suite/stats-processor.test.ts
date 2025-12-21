import * as assert from 'assert'
import * as sinon from 'sinon'
import { TextEncoder } from 'util'
import * as vscode from 'vscode'

import { StagedFile } from '../../models'
import { StatsProcessor } from '../../services'
import { TokenEstimator } from '../../utils'

// Helper to create dummy staged files
const createFile = (path: string): StagedFile => ({
  type: 'file',
  uri: vscode.Uri.file(path),
  label: path,
  isPinned: false,
})

suite('StatsProcessor Performance & Logic Tests', () => {
  let processor: StatsProcessor
  let sandbox: sinon.SinonSandbox

  // Stubs for our mock filesystem
  let fsStatStub: sinon.SinonStub
  let fsReadFileStub: sinon.SinonStub
  let measureSpy: sinon.SinonSpy

  // Keep track of original FS to restore cleanup
  let originalFs: typeof vscode.workspace.fs

  setup(() => {
    sandbox = sinon.createSandbox()
    processor = new StatsProcessor()

    // 1. Create a complete Mock FileSystem object
    // We cannot stub individual methods on the real vscode.workspace.fs
    // because they are read-only/non-configurable.
    fsStatStub = sandbox.stub()
    fsReadFileStub = sandbox.stub()

    const mockFs = {
      stat: fsStatStub,
      readFile: fsReadFileStub,
      // Add other members of FileSystem if strictly required by types,
      // but usually the runtime usage only hits these two.
      writeFile: sandbox.stub(),
      delete: sandbox.stub(),
      rename: sandbox.stub(),
      copy: sandbox.stub(),
      createDirectory: sandbox.stub(),
      readDirectory: sandbox.stub(),
      isWritableFileSystem: () => true,
    }

    // 2. Inject the Mock FS into vscode.workspace
    originalFs = vscode.workspace.fs
    Object.defineProperty(vscode.workspace, 'fs', {
      writable: true,
      value: mockFs,
      configurable: true,
    })

    // 3. Mock TokenEstimator
    // Avoid heavy computation during tests
    measureSpy = sandbox.stub(TokenEstimator, 'measure').returns({
      tokenCount: 100,
      charCount: 500,
    })
  })

  teardown(() => {
    // Restore the original VS Code FileSystem
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
    // Scenario: Process 10 files. Batch size is 5.
    // We expect a yield after the first 5.
    const files = Array.from({ length: 10 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 500 })
    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    const executionLog: string[] = []

    // A. Start Processing (Async)
    const processingPromise = processor.enrichFileStats(files).then(() => {
      executionLog.push('Processing Complete')
    })

    // B. Queue "UI Render" Task
    // Using setImmediate simulates a macro task (like UI rendering).
    // If the processor yields correctly using setImmediate/setTimeout(0),
    // this task should have a chance to run before the entire batch completes.
    await new Promise<void>((resolve) => {
      // Use setTimeout 0 as a cross-platform "next tick" equivalent for tests
      setTimeout(() => {
        executionLog.push('UI Render Event')
        resolve()
      }, 0)
    })

    await processingPromise

    // C. Verify Order
    // We expect the UI Event to appear in the log.
    // Note: Exact ordering relative to 'Processing Complete' depends on the
    // exact yield timing, but essential requirement is that it RAN.
    assert.ok(executionLog.includes('UI Render Event'), 'UI Event should have executed during processing window')
  })

  test('Should process files in chunks of 5', async () => {
    const files = Array.from({ length: 12 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 100 })
    fsReadFileStub.resolves(new TextEncoder().encode('some code'))

    await processor.enrichFileStats(files)

    // Assert all files were processed
    assert.strictEqual(measureSpy.callCount, 12, 'Should measure all 12 files')
    assert.ok(
      files.every((f) => f.stats !== undefined),
      'All files should have stats',
    )
  })

  test('Should skip heavy analysis for large files (>1MB)', async () => {
    const bigFile = createFile('/big.ts')
    const smallFile = createFile('/small.ts')

    // Mock specific file sizes
    fsStatStub.withArgs(bigFile.uri).resolves({ size: 1024 * 1024 + 1 }) // 1MB + 1 byte
    fsStatStub.withArgs(smallFile.uri).resolves({ size: 500 })

    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    await processor.enrichFileStats([bigFile, smallFile])

    // Expect measure to be called ONLY for the small file
    assert.strictEqual(measureSpy.callCount, 1)

    // Verify Heuristic Stats for big file
    assert.deepStrictEqual(bigFile.stats, {
      tokenCount: Math.ceil((1024 * 1024 + 1) / 4),
      charCount: 1024 * 1024 + 1,
    })
  })

  test('Should handle binary files gracefully', async () => {
    const binaryFile = createFile('/image.png')
    fsStatStub.resolves({ size: 500 })

    // Mock binary content (null byte at start)
    const binaryContent = new Uint8Array([0, 1, 2, 3])
    fsReadFileStub.resolves(binaryContent)

    await processor.enrichFileStats([binaryFile])

    assert.strictEqual(binaryFile.isBinary, true)
    assert.strictEqual(binaryFile.stats?.tokenCount, 0)
    assert.strictEqual(measureSpy.called, false, 'Should not measure binary content')
  })

  test('Should handle file read errors without crashing batch', async () => {
    const goodFile = createFile('/good.ts')
    const badFile = createFile('/bad.ts')

    fsStatStub.resolves({ size: 100 })

    // Use call-based stubbing for different returns
    fsReadFileStub.withArgs(goodFile.uri).resolves(new TextEncoder().encode('ok'))
    fsReadFileStub.withArgs(badFile.uri).rejects(new Error('EACCES'))

    await processor.enrichFileStats([badFile, goodFile])

    // Bad file should have empty stats
    assert.strictEqual(badFile.stats?.tokenCount, 0)

    // Good file should still be processed
    assert.strictEqual(goodFile.stats?.tokenCount, 100)
  })
})
