const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const api={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/dashboardGrid.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api})
const old={grid_x:3,grid_y:2,grid_w:5,grid_h:4,min_w:2,max_w:12,min_h:2,max_h:12,config_json:{custom:'keep'}}
test('legacy coordinates double while rendered pixel geometry stays the same',()=>{
 const fine=api.decodeDashboardGrid(old)
 assert.equal(fine.grid_x,6);assert.equal(fine.grid_y,4)
 assert.equal(fine.grid_w,10);assert.equal(fine.grid_h,8)
 assert.equal(fine.grid_h*api.DASHBOARD_ROW_HEIGHT+(fine.grid_h-1)*api.DASHBOARD_GAP,old.grid_h*84+(old.grid_h-1)*16)
 for(const width of [960,1440,1800]) {
  const coarseCell=(width-11*16)/12
  const fineCell=(width-23*16)/24
  assert.ok(Math.abs(old.grid_w*coarseCell+(old.grid_w-1)*16-(fine.grid_w*fineCell+(fine.grid_w-1)*16))<0.001)
 }
})
test('odd half-cell positions survive API save and server size clamping',()=>{
 const fine={...api.decodeDashboardGrid(old),grid_x:7,grid_y:5}
 const encoded=api.encodeDashboardGrid(fine)
 assert.equal(encoded.config_json.custom,'keep')
 const loaded=api.decodeDashboardGrid({...encoded,grid_w:4,grid_h:3})
 assert.equal(loaded.grid_x,7);assert.equal(loaded.grid_y,5)
 assert.equal(loaded.grid_w,10);assert.equal(loaded.grid_h,8)
 const again=api.decodeDashboardGrid(api.encodeDashboardGrid(loaded))
 assert.equal(again.grid_x,7);assert.equal(again.grid_y,5)
})
test('invalid saved fine coordinates fall back to legacy geometry',()=>{
 const item=api.decodeDashboardGrid({...old,config_json:{_dashboard_grid_v2:{x:-1,y:0,w:100,h:1}}})
 assert.equal(item.grid_x,6);assert.equal(item.grid_w,10)
})
