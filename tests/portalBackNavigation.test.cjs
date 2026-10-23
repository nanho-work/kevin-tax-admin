const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const exportsForTest = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/portalBackNavigation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsForTest, URLSearchParams })
const { getPortalBackPath: back } = exportsForTest
test('detail and create screens return to their correct portal lists', () => {
  for (const portal of ['/admin','/client']) {
    for (const [detail, parent] of [
      ['/companies/42','/companies'], ['/companies/new','/companies'], ['/companies/bulk','/companies'],
      ['/companies/account/new','/companies/account'], ['/mail/inbox/12','/mail/inbox'], ['/mail/compose','/mail/inbox'],
      ['/docs/23','/docs'], ['/docs/editor/23','/docs'], ['/staff/register','/staff'],
      ['/staff/documents/new','/staff/documents'], ['/office/staff/register','/office/staff'],
      ['/office/blog/create','/office/blog/list'], ['/client-management/blog/sample','/client-management/blog/list'],
      ['/bookkeeping/debits/history/12','/bookkeeping/debits/history'],
      ['/office/bookkeeping/debits/batches/12','/office/bookkeeping/debits/history'],
      ['/office/bookkeeping/debits/upload','/office/bookkeeping/debits'],
      ['/client-management/create','/client-management/list'], ['/client-management/company-create','/client-management/company-list'],
    ]) assert.equal(back(portal + detail), portal + parent)
  }
})
test('top-level menu screens do not get meaningless back buttons', () => {
  for (const route of ['/admin/companies', '/admin/companies/account', '/client/client-management/blog/list', '/admin/office/blog/list', '/admin/workflow/board/materials', '/client/staff/signup-requests', '/admin/setting/team', '/client/bookkeeping/debits/history', '/admin/mail/accounts']) {
    assert.equal(back(route), null, route)
  }
})
test('work-post edit returns to detail and preserves board context', () => {
  const params = new URLSearchParams('post_type=task&board_id=3')
  assert.equal(back('/client/staff/work-posts/8/edit', params), '/client/staff/work-posts/8?post_type=task&board_id=3')
  assert.equal(back('/admin/staff/work-posts/8', params), '/admin/staff/work-posts?post_type=task&board_id=3')
  assert.equal(back('/client/staff/work-posts/new/', params), '/client/staff/work-posts?post_type=task&board_id=3')
})
