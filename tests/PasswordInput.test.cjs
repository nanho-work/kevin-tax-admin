const { test } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' })
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const { Simulate } = require('react-dom/test-utils')
const act = React.act
function load(path, overrides = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => overrides[name] || require(name) })
  return exports
}
const keyboard = load('src/utils/passwordKeyboard.ts')
const PasswordInput = load('src/components/common/PasswordInput.tsx', { '@/utils/passwordKeyboard': keyboard }).default

test('composition, confirmation, blur, caret and ref work with controlled form state', () => {
  let stored = '', forwarded
  function Form() {
    const [value, setValue] = React.useState('')
    return React.createElement(PasswordInput, { ref: el => { forwarded = el }, type: 'text', value, onChange: e => { stored = e.target.value; setValue(stored) } })
  }
  const root = createRoot(document.getElementById('root'))
  act(() => root.render(React.createElement(Form)))
  const input = document.querySelector('input')
  assert.equal(forwarded, input)
  act(() => Simulate.compositionStart(input))
  act(() => { input.value = '한'; Simulate.change(input) })
  assert.equal(input.value, '한')
  assert.equal(stored, '')
  let prevented = false
  act(() => Simulate.keyDown(input, { key: 'Enter', nativeEvent: { isComposing: true }, preventDefault: () => { prevented = true } }))
  assert.equal(prevented, true)
  act(() => Simulate.compositionEnd(input))
  assert.equal(stored, 'gks')
  assert.equal(input.value, 'gks')
  act(() => { input.value = 'A한B'; input.setSelectionRange(2, 2); Simulate.change(input) })
  assert.equal(stored, 'AgksB')
  assert.equal(input.selectionStart, 4)
  act(() => Simulate.compositionStart(input))
  act(() => { input.value = 'ㅃ123!'; Simulate.change(input) })
  act(() => Simulate.blur(input))
  assert.equal(stored, 'Q123!')
  act(() => root.unmount())
})
