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
const { act } = React
let calls = [], fail = false, path = '/admin/workflow/board/materials', opened = false
const archive = {
  total: 1, page: 1, size: 20,
  companies: [{ id: 12, name: '테스트 업체' }], tasks: ['원천세', '급여'], years: [2025, 2026],
  summary: { total_files: 25, total_size_bytes: 2500, companies_count: 1 },
  items: [{ company_id: 12, company_name: '테스트 업체', task_name: '원천세', docs_entry_id: 1, file_name: '급여.pdf', attribution_month: '2026-10' }],
  groups: [{ company_id: 12, company_name: '테스트 업체', task_name: '원천세', file_count: 25, latest_uploaded_at: '2026-10-01' }],
}
const service = {
  fetchTaskFileArchive: async (scope, params) => { calls.push({ scope, params }); if (fail) throw Error('조회 실패'); return { ...archive, page: params.page } },
  getTaskBoardErrorMessage: e => e.message,
  fetchTaskFilePreviewUrl: async () => { assert.equal(opened, true); return { preview_url: 'https://example.test/preview' } },
}
const overrides = {
  'next/navigation': { usePathname: () => path },
  'react-hot-toast': { toast: { error: () => {} } },
  '@/services/workflowTaskBoard': service,
  '@/utils/dateTime': { formatKSTDate: s => s },
  '@/components/common/UiButton': { default: props => React.createElement('button', props) },
  '@/components/common/UiSearchInput': { default: props => React.createElement('input', { value: props.value, onChange: e => props.onChange(e.target.value) }) },
  '@/components/common/Pagination': { default: props => React.createElement('button', { onClick: () => props.onPageChange(2) }, '다음 페이지') },
}
const exp = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/(protected)/admin/workflow/board/materials/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports: exp, require: name => overrides[name] || require(name), window, setTimeout, clearTimeout })
const click = text => Simulate.click([...document.querySelectorAll('button')].find(x => x.textContent === text))
async function mount() {
  calls = []; fail = false
  const root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(exp.default))))
  return root
}
test('company filter carries scope and resets pagination without losing task options', async () => {
  const root = await mount()
  await act(async () => click('다음 페이지'))
  assert.equal(calls.at(-1).params.page, 2)
  const select = [...document.querySelectorAll('select')].find(x => x.textContent.includes('전체 업체'))
  await act(async () => { select.value = '12'; Simulate.change(select) })
  assert.equal(calls.at(-1).params.company_id, 12)
  assert.equal(calls.at(-1).params.page, 1)
  assert.match(document.body.textContent, /급여/)
  act(() => root.unmount())
})
test('annual aggregates use server totals and drill into same company/task with no month restriction', async () => {
  const root = await mount()
  await act(async () => click('연도별 보기'))
  assert.equal(calls.at(-1).params.grouped, true)
  assert.match(document.body.textContent, /25건/)
  await act(async () => click('파일 보기'))
  assert.equal(calls.at(-1).params.company_id, 12)
  assert.equal(calls.at(-1).params.task_name, '원천세')
  assert.equal(calls.at(-1).params.month, undefined)
  assert.equal(calls.at(-1).params.grouped, false)
  act(() => root.unmount())
})
test('failure is distinct from empty results and retry recovers', async () => {
  const root = await mount()
  fail = true
  await act(async () => click('새로고침'))
  assert.equal(document.querySelector('[role="alert"]').textContent, '조회 실패')
  assert.doesNotMatch(document.body.textContent, /선택한 조건에 연결된 파일이 없습니다/)
  fail = false
  await act(async () => click('다시 시도'))
  assert.equal(document.querySelector('[role="alert"]'), null)
  act(() => root.unmount())
})
test('month crossing is exactly one year even in StrictMode', async () => {
  const root = await mount()
  for (let i = 0; i < 12; i++) {
    await act(async () => Simulate.click(document.querySelector('[aria-label="다음 월"]')))
  }
  const initial = calls[0].params, last = calls.at(-1).params
  assert.equal(last.year, initial.year + 1)
  assert.equal(last.month, initial.month)
  act(() => root.unmount())
})
test('client screen uses client scope and opens preview during user click', async () => {
  path = '/client/workflow/board/materials'
  const root = await mount()
  assert.equal(calls.at(-1).scope, 'client')
  opened = false
  let url
  window.open = () => { opened = true; return { opener: null, location: { replace: value => { url = value } }, close() {} } }
  await act(async () => Simulate.click(document.querySelector('[aria-label="새창 보기"]')))
  assert.equal(url, 'https://example.test/preview')
  act(() => root.unmount())
  path = '/admin/workflow/board/materials'
})
