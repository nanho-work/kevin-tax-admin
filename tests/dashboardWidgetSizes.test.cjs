const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/dashboardWidgetSizes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api})
const items=['my_attendance','approval_pending','mail_unread','work_post_inbox','memo_widget','checklist_widget'].map((widget_key,index)=>({widget_key,grid_x:0,grid_y:index*4,grid_w:4,grid_h:3}))
test('content sizing packs widgets inside 24 columns without overlap',()=>{
 const result=api.applyDashboardWidgetSizes(items,'admin')
 assert.equal(result.length,items.length)
 assert.equal(result.find(x=>x.widget_key==='approval_pending').grid_w,4)
 assert.equal(result.find(x=>x.widget_key==='mail_unread').grid_w,12)
 assert.equal(result.find(x=>x.widget_key==='memo_widget').grid_w,10)
 for(let i=0;i<result.length;i++) {
  const a=result[i];assert.ok(a.grid_x>=0&&a.grid_x+a.grid_w<=24)
  for(const b of result.slice(i+1)) assert.equal(a.grid_x<b.grid_x+b.grid_w&&a.grid_x+a.grid_w>b.grid_x&&a.grid_y<b.grid_y+b.grid_h&&a.grid_y+a.grid_h>b.grid_y,false)
 }
})
test('unchanged sizes preserve manually chosen positions',()=>{
 const result=api.applyDashboardWidgetSizes(items,'admin');result[0].grid_y=12
 assert.equal(api.applyDashboardWidgetSizes(result,'admin')[0].grid_y,12)
})
test('client work-post count is compact, admin work-post list is wider',()=>{
 assert.equal(api.applyDashboardWidgetSizes(items,'client_account').find(x=>x.widget_key==='work_post_inbox').grid_w,4)
 assert.equal(api.applyDashboardWidgetSizes(items,'admin').find(x=>x.widget_key==='work_post_inbox').grid_w,8)
})

test('attendance honors custom sizes within 3 to 5 fine cells',()=>{
 for(const [w,h,expectedW,expectedH] of [[3,3,3,3],[3,5,3,5],[5,5,5,5],[2,8,3,5]]) {
  const item=api.applyDashboardWidgetSizes([{...items[0],grid_w:w,grid_h:h}],'admin')[0]
  assert.equal(item.grid_w,expectedW);assert.equal(item.grid_h,expectedH)
 }
})

test('custom mail, memo and count sizes survive sizing normalization',()=>{
 for(const [key,w,h] of [['mail_unread',15,10],['memo_widget',13,12],['approval_pending',5,3],['checklist_widget',8,9]]) {
  const result=api.applyDashboardWidgetSizes([{...items[0],widget_key:key,grid_w:w,grid_h:h,config_json:{_dashboard_size_custom:true}}],'admin')[0]
  assert.equal(result.grid_w,w);assert.equal(result.grid_h,h)
 }
})
