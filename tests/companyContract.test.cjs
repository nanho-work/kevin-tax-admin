const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require('react')
const { createRoot } = require('react-dom/client')
const { Simulate } = require('react-dom/test-utils')
const act = React.act
function load(path, overrides, extra = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => overrides[name] || require(name), ...extra })
  return exports
}
let rank = 10, calls = []
const row = { id: 71, company_id: 12, start_date: '2026-01-01', start_month: '2026-01', report_cycle: 'semiannual', payroll_day: 25, payroll_basis: 'previous_month', monthly_fee_supply: 100000, vat_included: false, is_active: true, version_no: 3 }
const services = {
  listBookkeepingContracts: async () => { calls.push(['list']); return { items: [row, { ...row, id: 72, company_id: 13 }] } },
  createBookkeepingContract: async payload => { calls.push(['create', payload]); return { ...row, ...payload } },
  updateBookkeepingContract: async (id, payload) => { calls.push(['update', id, payload]); return { ...row, ...payload } },
  getClientBookkeepingErrorMessage: e => e.message,
}
const Component = load('src/components/admin/Company/CompanyContractSection.tsx', {
  '@/contexts/ManagementSession': { useManagementSession: () => ({ session: { rank_order: rank }, loading: false }) },
  '@/utils/roleRank': { getClientRoleRank: s => s.rank_order },
  '@/services/client/clientBookkeepingService': services,
}).default
const click = text => Simulate.click([...document.querySelectorAll('button')].find(x => x.textContent === text))
test('detail reads only this customer and edits the existing contract ID', async () => {
  calls = []; rank = 10
  const root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(Component, { companyId: 12, creating: false, editable: true })))
  assert.equal(document.querySelectorAll('select option').length, 1)
  assert.match(document.body.textContent, /100,000원/)
  act(() => click('계약 수정'))
  const fee = [...document.querySelectorAll('label')].find(x => x.textContent.includes('월 기장료')).querySelector('input')
  act(() => { fee.value = '150000'; Simulate.change(fee) })
  await act(async () => click('계약 저장'))
  assert.equal(calls.filter(x => x[0] === 'create').length, 0)
  const saved = calls.find(x => x[0] === 'update')
  assert.equal(saved[1], 71)
  assert.equal(saved[2].monthly_fee_supply, 150000)
  assert.equal(saved[2].report_cycle, 'semiannual')
  assert.match(document.body.textContent, /150,000원/)
  act(() => root.unmount())
})
test('new registration validates contract before customer creation, and one-off may omit it', async () => {
  calls = []; rank = 10
  const root = createRoot(document.getElementById('root')), ref = React.createRef()
  await act(async () => root.render(React.createElement(Component, { ref, companyId: 0, creating: true, engagement: 'bookkeeping', editable: true })))
  act(() => assert.throws(() => ref.current.prepare(), /계약 시작일/))
  const start = document.querySelector('[aria-label="계약 시작일"]')
  act(() => { start.value = '2026-10-01'; Simulate.change(start) })
  let payload
  act(() => { payload = ref.current.prepare() })
  assert.equal(payload.start_date, '2026-10-01')
  assert.equal(calls.length, 0)
  await act(async () => root.render(React.createElement(Component, { ref, companyId: 0, creating: true, engagement: 'one_off', editable: true })))
  assert.equal(ref.current.prepare(), null)
  act(() => root.unmount())
})
test('ordinary staff do not fetch or edit office contract information', async () => {
  calls = []; rank = 999
  const root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(Component, { companyId: 12, creating: false, editable: true })))
  assert.equal(document.getElementById('root').textContent, '')
  assert.equal(calls.length, 0)
  act(() => root.unmount())
})
test('both customer and contract menus use the real admin token with the same contract API', async () => {
  const sent = [], http = scope => Object.fromEntries(['get','post','put'].map(method => [method, async (...args) => { sent.push([scope, method, ...args]); return { data: {} } }]))
  const browser = { location: { pathname: '/admin/companies/12' } }
  const api = load('src/services/client/clientBookkeepingService.ts', {
    '@/services/http': { adminHttp: http('admin') },
    '@/services/officeHttp': { officeHttp: http('client') },
    '@/services/upload/multipartUpload': { createMultipartUploadAdapter: x => x },
    '@/utils/apiError': {},
  }, { window: browser, process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://example.test' } } })
  await api.listBookkeepingContracts()
  await api.updateBookkeepingContract(71, { payroll_day: 10 })
  assert.equal(sent[0][0], 'admin')
  assert.equal(sent[1][2], 'https://example.test/client/bookkeeping/contracts/71')
  browser.location.pathname = '/client/companies/12'
  await api.createBookkeepingContract({ company_id: 12 })
  assert.equal(sent[2][0], 'client')
})
