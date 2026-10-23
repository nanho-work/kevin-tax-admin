const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const storage = new Map()
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/dashboardLayoutState.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS }}).outputText, { exports: api, window: { localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) } } })
const meta = (key,id) => ({ widget_key:key, widget_id:id, title:key, default_w:3,default_h:3,min_w:1,min_h:1,max_w:12,max_h:12,supports_mobile:true })
const layout = {client_id:1,user_type:'admin',user_id:1,device_type:'desktop',items:[],is_customized:false}
test('all hidden widgets including local fallback stay hidden after reload', () => {
  const catalog = [meta('memo_widget',-1)]
  const initial = api.restoreDashboardItems(layout,catalog,[],['memo_widget'])
  assert.equal(initial[0].visible,true)
  const hidden = api.mergeDashboardVisibility(initial,[])
  const key = api.dashboardStorageKey(layout)
  api.writeLocalDashboardItems(key,hidden)
  const restored = api.restoreDashboardItems(layout,catalog,api.readLocalDashboardItems(key),['memo_widget'])
  assert.equal(restored[0].visible,false)
})
test('server widget visibility and IDs take precedence over fallback', () => {
  const item = {...meta('memo_widget',5),visible:false,grid_x:0,grid_y:0,grid_w:3,grid_h:3,sort_order:0}
  const result = api.restoreDashboardItems({...layout,items:[item]},[meta('memo_widget',5)],[{...item,widget_id:-1,visible:true}],['memo_widget'])
  assert.equal(result.length,1)
  assert.equal(result[0].widget_id,5)
  assert.equal(result[0].visible,false)
})
test('local preference keys isolate tenant, user, scope and device', () => {
  const keys = [layout,{...layout,client_id:2},{...layout,user_id:2},{...layout,user_type:'client_account'},{...layout,device_type:'mobile'}].map(api.dashboardStorageKey)
  assert.equal(new Set(keys).size,5)
})
test('malformed local geometry does not enter layout state', () => {
  storage.set('broken','not json')
  assert.equal(api.readLocalDashboardItems('broken').length,0)
  storage.set('broken',JSON.stringify([{widget_key:'memo_widget',visible:true,grid_x:-1,grid_y:0,grid_w:3,grid_h:3,sort_order:0}]))
  assert.equal(api.readLocalDashboardItems('broken').length,0)
})
test('hiding preserves config and does not mutate previous layout', () => {
  const initial = api.restoreDashboardItems(layout,[meta('memo_widget',-1)],[],['memo_widget'])
  initial[0].config_json={setting:'keep'}
  const hidden = api.mergeDashboardVisibility(initial,[])
  assert.equal(initial[0].visible,true)
  assert.equal(hidden[0].config_json.setting,'keep')
})
