const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/monthlyWorkProgress.ts','utf8'), { compilerOptions: {module: ts.ModuleKind.CommonJS} }).outputText, { exports: api })
test('report month uses Seoul date and attribution rolls over year boundary', () => {
 const result = api.getMonthlyWorkPeriod(new Date('2025-12-31T15:00:00Z'))
 assert.equal(result.report, '2026-01'); assert.equal(result.attribution, '2025-12')
})
test('counts companies separately from tasks and excludes NA from progress', () => {
 const row = {company_id:1, company_name:'A',board_id:1,total_count:5,done_count:2,todo_count:2,is_excluded:false}
 const result = api.summarizeMonthlyWork([row, {...row,company_id:2,board_id:null,total_count:0,done_count:0,todo_count:0}, {...row,company_id:3,is_excluded:true}])
 assert.equal(result.percent,50); assert.equal(result.pending.length,1); assert.equal(result.todo,2)
 assert.equal(result.na,1); assert.equal(result.unregistered,1)
})
test('empty and NA-only work are not shown as 100% complete', () => {
 assert.equal(api.summarizeMonthlyWork([]).percent,null)
 assert.equal(api.summarizeMonthlyWork([{board_id:1,total_count:3,done_count:0,todo_count:0}]).percent,null)
})
