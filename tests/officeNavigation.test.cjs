const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function load(path, sandbox) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  sandbox.exports = {}
  vm.runInNewContext(code, sandbox)
  return sandbox.exports
}
test('office links retain their route, query and dynamic identifier in SSR and browser', () => {
  const { mapOfficeHref } = load('src/utils/officeHref.ts', { require: () => ({ usePathname: () => '/admin/office/staff' }) })
  assert.equal(mapOfficeHref('/admin/office/staff', '/client/staff?panel=org'), '/admin/office/staff?panel=org')
  assert.equal(mapOfficeHref('/admin/office/blog/list', '/client/client-management/blog/tax?category=3'), '/admin/office/blog/tax?category=3')
  assert.equal(mapOfficeHref('/client/staff', '/client/staff?panel=org'), '/client/staff?panel=org')
})
test('management API uses actual staff transport even when client login also exists', () => {
  const makeHttp = name => Object.assign((config) => name + ':call', { get: () => name + ':get', post: () => name + ':post' })
  const sandbox = { window: { location: { pathname: '/admin/office/bookkeeping/contracts' } }, require: () => ({ adminHttp: makeHttp('admin'), clientHttp: makeHttp('client') }) }
  const { officeHttp } = load('src/services/officeHttp.ts', sandbox)
  assert.equal(officeHttp.get('/client/bookkeeping/contracts'), 'admin:get')
  assert.equal(officeHttp({ url: '/client/staffs/' }), 'admin:call')
  sandbox.window.location.pathname = '/client/staff'
  assert.equal(officeHttp.post('/client/staffs/'), 'client:post')
})
