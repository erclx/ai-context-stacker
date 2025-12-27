import * as assert from 'assert'
import * as sinon from 'sinon'
import { TextEncoder } from 'util'
import * as vscode from 'vscode'

import { StagedFile } from '../../models'
import { StatsProcessor } from '../../services'
import { TokenEstimator } from '../../utils'

const createFile = (path: string): StagedFile => ({
  type: 'file',
  uri: vscode.Uri.file(path),
  label: path,
  isPinned: false,
})

suite('StatsProcessor Performance & Logic Tests', () => {
  let processor: StatsProcessor
  let sandbox: sinon.SinonSandbox
  let clock: sinon.SinonFakeTimers

  let fsStatStub: sinon.SinonStub
  let fsReadFileStub: sinon.SinonStub
  let measureSpy: sinon.SinonSpy

  let originalFs: typeof vscode.workspace.fs

  setup(() => {
    sandbox = sinon.createSandbox()

    // Take over the clock to manually advance through the 2.5s startup delay
    clock = sandbox.useFakeTimers({
      shouldAdvanceTime: true,
      shouldClearNativeTimers: true,
    })

    processor = new StatsProcessor()

    // Stub FS methods to avoid actual disk I/O
    fsStatStub = sandbox.stub()
    fsReadFileStub = sandbox.stub()

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

    measureSpy = sandbox.stub(TokenEstimator, 'measure').returns({
      tokenCount: 100,
      charCount: 500,
    })
  })

  teardown(() => {
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
    // Force multiple batches by lowering the limit
    ;(processor as any).MAX_BATCH_SIZE = 2

    const files = Array.from({ length: 5 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 500 })
    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    const executionLog: string[] = []

    const processingPromise = processor.enrichFileStats(files).then(() => {
      executionLog.push('Processing Complete')
    })

    // Fast-forward past the warmup circuit breaker
    await clock.tickAsync(2600)

    // Schedule a macro task to simulate a UI render event
    setTimeout(() => {
      executionLog.push('UI Render Event')
    }, 0)

    await clock.runAllAsync()
    await processingPromise

    // The UI event must occur before processing finishes to prove we yielded
    assert.ok(executionLog.includes('UI Render Event'), 'UI Event should have executed during processing window')
  })

  test('Should process files in chunks', async () => {
    const files = Array.from({ length: 5 }, (_, i) => createFile(`/file_${i}.ts`))

    fsStatStub.resolves({ size: 100 })
    fsReadFileStub.resolves(new TextEncoder().encode('some code'))

    const promise = processor.enrichFileStats(files)

    await clock.tickAsync(3000)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(measureSpy.callCount, 5, 'Should measure all 5 files')
    assert.ok(
      files.every((f) => f.stats !== undefined),
      'All files should have stats',
    )
  })

  test('Should skip heavy analysis for large files (>1MB)', async () => {
    const bigFile = createFile('/big.ts')
    const smallFile = createFile('/small.ts')

    // 1MB + 4 bytes
    fsStatStub.withArgs(bigFile.uri).resolves({ size: 1024 * 1024 + 4 })
    fsStatStub.withArgs(smallFile.uri).resolves({ size: 500 })

    fsReadFileStub.resolves(new TextEncoder().encode('content'))

    const promise = processor.enrichFileStats([bigFile, smallFile])

    await clock.tickAsync(2600)
    await clock.runAllAsync()
    await promise

    // Heavy tokenizer should only run on the small file
    assert.strictEqual(measureSpy.callCount, 1)

    // Verify heuristic: (1MB + 4) / 4 ~ 262145 tokens
    const expectedTokens = Math.ceil((1024 * 1024 + 4) / 4)

    assert.deepStrictEqual(bigFile.stats, {
      tokenCount: expectedTokens,
      charCount: 1024 * 1024 + 4,
    })
  })

  test('Should handle binary files gracefully', async () => {
    const binaryFile = createFile('/image.png')
    fsStatStub.resolves({ size: 500 })

    const binaryContent = new Uint8Array([0, 1, 2, 3])
    fsReadFileStub.resolves(binaryContent)

    const promise = processor.enrichFileStats([binaryFile])

    await clock.tickAsync(2600)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(binaryFile.isBinary, true)
    assert.strictEqual(binaryFile.stats?.tokenCount, 0)
    assert.strictEqual(measureSpy.called, false)
  })

  test('Should handle file read errors without crashing batch', async () => {
    const goodFile = createFile('/good.ts')
    const badFile = createFile('/bad.ts')

    fsStatStub.resolves({ size: 100 })

    fsReadFileStub.withArgs(goodFile.uri).resolves(new TextEncoder().encode('ok'))
    fsReadFileStub.withArgs(badFile.uri).rejects(new Error('EACCES'))

    const promise = processor.enrichFileStats([badFile, goodFile])

    await clock.tickAsync(2600)
    await clock.runAllAsync()
    await promise

    assert.strictEqual(badFile.stats?.tokenCount, 0)
    assert.strictEqual(goodFile.stats?.tokenCount, 100)
  })
})
