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
let pathname = '/admin/workflow/board'
const exp = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/contexts/HeaderBackContext.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: exp, require: name => name === 'next/navigation' ? { usePathname: () => pathname } : require(name)
})
function Header() {
  const back = exp.useHeaderBackAction()
  return back ? React.createElement('button', { onClick: back }, 'back') : null
}
function Detail({ onBack }) {
  exp.useInPageBack(true, onBack)
  return null
}
const render = (detail, onBack) => React.createElement(exp.HeaderBackProvider, null, React.createElement(Header), detail && React.createElement(Detail, { onBack }))
test('state-only detail registers current callback and removes action on close', async () => {
  const root = createRoot(document.getElementById('root'))
  let count = 0
  await React.act(async () => root.render(render(true, () => count++)))
  assert.ok(document.querySelector('button'))
  await React.act(async () => root.render(render(true, () => { count += 2 })))
  React.act(() => Simulate.click(document.querySelector('button')))
  assert.equal(count, 2)
  await React.act(async () => root.render(render(false)))
  assert.equal(document.querySelector('button'), null)
  React.act(() => root.unmount())
})
test('a different route never exposes the previous detail action', async () => {
  const root = createRoot(document.getElementById('root'))
  await React.act(async () => root.render(render(true, () => {})))
  pathname = '/admin/companies'
  await React.act(async () => root.render(render(false)))
  assert.equal(document.querySelector('button'), null)
  React.act(() => root.unmount())
})
