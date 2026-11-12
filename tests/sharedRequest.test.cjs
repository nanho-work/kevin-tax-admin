const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/sharedRequest.ts', 'utf8'), { compilerOptions: {module: ts.ModuleKind.CommonJS} }).outputText, { exports: api })
test('three board consumers reuse the same 100 reads, including after completion', async () => {
  let calls = 0
  const read = api.createSharedRequest(async key => { calls++; return { key, status: 'done', files: 2 } })
  const keys = Array.from({length: 100}, (_, i) => `${i}:${i}`)
  const results = await Promise.all([0,1,2].map(() => Promise.all(keys.map(read))))
  await Promise.all(keys.map(read))
  assert.equal(calls, 100)
  assert.strictEqual(results[0][0], results[1][0])
  assert.equal(results[0][0].files, 2)
  console.log('Board read fixture: 3 consumers × 100 boards: 300 -> 100 requests (66.7% fewer)')
})
test('failed reads retry; a new account/month/write generation never reuses old data', async () => {
  let calls = 0
  const read = api.createSharedRequest(async () => { if (++calls === 1) throw Error('offline'); return 'done' })
  await assert.rejects(read('1'), /offline/)
  assert.equal(await read('1'), 'done')
  const nextGeneration = api.createSharedRequest(async () => 'not_started')
  assert.equal(await nextGeneration('1'), 'not_started')
  assert.equal(calls, 2)
})
