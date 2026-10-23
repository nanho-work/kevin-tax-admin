const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>')
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require('react')
const { createRoot } = require('react-dom/client')
const { Simulate } = require('react-dom/test-utils')
const { act } = React
function load(path, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: name => deps[name] || require(name) })
  return exports
}
const toggle = load('src/components/common/UiEditToggle.tsx')
const Editor = load('src/components/admin/Company/CompanyContactEditor.tsx', { '@/components/common/UiEditToggle': toggle }).default
const base = { contactId: 3, name: 'Kim', phone: '010', email: 'test@example.test', department: '', position: '', notify_mail: true, memo: 'saved memo' }
const clickLabel = label => Simulate.click(document.querySelector(`[aria-label="${label}"]`))
const click = text => Simulate.click([...document.querySelectorAll('button')].find(el => el.textContent === text))
const input = title => [...document.querySelectorAll('label')].find(el => el.textContent === title).querySelector('input')
const change = (el, value) => { el.value = value; Simulate.change(el) }
async function mount(overrides = {}) {
  const root = createRoot(document.getElementById('root'))
  const info = [], memos = []
  const props = { label: '메인 담당자', contact: base, editable: true, busy: false, badge: null, onDelete() {}, formatPhone: x => x,
    onSaveInfo: async data => { info.push(data); return true },
    onSaveMemo: async data => { memos.push(data); return true }, ...overrides }
  await act(async () => root.render(React.createElement(Editor, props)))
  return { root, info, memos }
}
test('information and memo have independent edit locks and payloads', async () => {
  const { root, info, memos } = await mount()
  act(() => clickLabel('메인 담당자 정보 수정'))
  assert.equal(input('이름').readOnly, false)
  assert.equal(document.querySelector('textarea').readOnly, true)
  act(() => change(input('이름'), 'Lee'))
  act(() => clickLabel('메인 담당자 메모 수정'))
  act(() => change(document.querySelector('textarea'), 'draft memo'))
  await act(async () => click('정보 저장'))
  assert.equal(info[0].name, 'Lee')
  assert.equal('memo' in info[0], false)
  assert.equal(document.querySelector('textarea').value, 'draft memo')
  assert.equal(document.querySelector('textarea').readOnly, false)
  await act(async () => click('메모 저장'))
  assert.deepEqual(memos, ['draft memo'])
  assert.equal(document.querySelector('textarea').readOnly, true)
  act(() => root.unmount())
})
test('locking memo cancels only memo and preserves information draft', async () => {
  const { root } = await mount()
  act(() => { clickLabel('메인 담당자 정보 수정'); clickLabel('메인 담당자 메모 수정') })
  act(() => { change(input('이름'), 'draft'); change(document.querySelector('textarea'), 'changed') })
  act(() => clickLabel('메인 담당자 메모 수정'))
  assert.equal(document.querySelector('textarea').value, 'saved memo')
  assert.equal(input('이름').value, 'draft')
  assert.equal(input('이름').readOnly, false)
  act(() => root.unmount())
})
test('empty memo can be saved; failure retains draft and unlocked state', async () => {
  let received
  const { root } = await mount({ onSaveMemo: async memo => { received = memo; return false } })
  act(() => clickLabel('메인 담당자 메모 수정'))
  act(() => change(document.querySelector('textarea'), ''))
  await act(async () => click('메모 저장'))
  assert.equal(received, '')
  assert.equal(document.querySelector('textarea').value, '')
  assert.equal(document.querySelector('textarea').readOnly, false)
  act(() => root.unmount())
})
test('new contact requires registration before memo; read-only users cannot unlock', async () => {
  let instance = await mount({ contact: { ...base, contactId: null } })
  assert.equal(document.querySelector('[aria-label="메인 담당자 메모 수정"]').disabled, true)
  act(() => instance.root.unmount())
  instance = await mount({ editable: false })
  assert.equal(document.querySelector('[aria-label="메인 담당자 정보 수정"]'), null)
  assert.equal(input('이름').readOnly, true)
  assert.equal(document.querySelector('textarea').readOnly, true)
  act(() => instance.root.unmount())
})
