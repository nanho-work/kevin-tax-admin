const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<body></body>',{url:'http://localhost'})
Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})
window.matchMedia=()=>({matches:false})
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = React
const { Simulate } = require('react-dom/test-utils')
function compile(path, req) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:req,window,document,setTimeout,clearTimeout,requestAnimationFrame:cb=>setTimeout(cb,0),cancelAnimationFrame:clearTimeout,console,MutationObserver:dom.window.MutationObserver,ResizeObserver:class {observe(){} disconnect(){}}})
  return exports
}
const state = compile('src/utils/dashboardLayoutState.ts', require)
for (const role of ['Admin','Client']) {
  test(`${role}: failed save preserves UI; double click sends once; last hide and re-show persist`, async () => {
    window.localStorage.clear()
    const item={widget_id:1,widget_key:'memo_widget',title:'메모',visible:true,grid_x:0,grid_y:0,grid_w:3,grid_h:4,min_w:3,min_h:4,max_w:3,max_h:4,sort_order:0,supports_mobile:true}
    const catalog={...item,default_w:3,default_h:4}
    // Explicitly hidden server records prevent default fallback widgets appearing.
    const extra=[{...item,widget_id:2,widget_key:'work_post_inbox',title:'업무',visible:false},{...item,widget_id:3,widget_key:'checklist_widget',title:'체크',visible:false},{...item,widget_id:4,widget_key:'my_attendance',title:'근태',visible:false}]
    let calls=0, rejectSave, resolveSave, lastPayload
    const deletedIds=[]
    const mocks={
      [`get${role}DashboardWidgetLayout`]:async()=>({client_id:1,user_type:role==='Admin'?'admin':'client_account',user_id:1,device_type:'desktop',items:[item,...extra]}),
      [`get${role}DashboardWidgetCatalog`]:async()=>({items:[catalog,...extra.map(i=>({...i,default_w:3,default_h:4}))]}),
      [`save${role}DashboardWidgetLayout`]:(payload)=>{lastPayload=payload;calls++;assert.equal(payload.items[0].visible,calls>=3);return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject})},
      [`get${role}DashboardNote`]:async()=>({content:'saved note',font_size:14}),
      [`get${role}DashboardChecklistByDate`]:async()=>({items:[{item_id:10,content:'done',is_done:true,sort_order:0},{item_id:20,content:'active',is_done:false,sort_order:1}]}),
      [`delete${role}DashboardChecklistItem`]:async(id)=>{deletedIds.push(id)},
      [`patch${role}DashboardChecklistItem`]:async()=>{throw new Error('network')},
    }
    const services=new Proxy(mocks,{get:(obj,key)=>obj[key]|| (async()=>({items:[]}))})
    const req = name => {
      if(name==='react-dom'||name==='react'||name==='react/jsx-runtime') return require(name)
      if(name==='next/navigation') return {useRouter:()=>({push(){}})}
      if(name==='react-hot-toast') return {toast:{error(){},success(){}}}
      if(name==='lucide-react') return new Proxy({},{get:()=>()=>null})
      if(name==='./MonthlyWorkProgressWidget') return {default:()=>null}
      if(name==='./DashboardWidgetMoveSurface') return compile('src/components/Dashboard/DashboardWidgetMoveSurface.tsx',req)
      if(name==='./DashboardWidgetResizeHandles') return compile('src/components/Dashboard/DashboardWidgetResizeHandles.tsx',req)
      if(name==='./DashboardWidgetToolbar') return compile('src/components/Dashboard/DashboardWidgetToolbar.tsx',req)
      if(name.endsWith('.module.css')) return {default:{grid:'grid'}}
      if(name==='@/utils/dashboardLayoutState') return state
      if(name==='@/utils/dashboardGrid') return compile('src/utils/dashboardGrid.ts',require)
      if(name==='@/utils/dashboardWidgetSizes') return compile('src/utils/dashboardWidgetSizes.ts',require)
      if(name.startsWith('@/services/')) return services
      if(name.startsWith('@/utils/')) return new Proxy({},{get:()=>()=>''})
      if(name.includes('Pagination')) return {default:()=>null}
      throw new Error(name)
    }
    const Component=compile(`src/components/Dashboard/${role}DashboardWidgets.tsx`,req).default
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
    await act(async()=>{root.render(React.createElement(Component))})
    const byText = text => [...document.querySelectorAll('button')].find(b=>b.textContent===text)
    assert.equal(byText('배치 편집'),undefined)
    assert.ok(document.querySelector('[data-widget-title]'),'title is immediately draggable')
    await act(async()=>{Simulate.click(byText('위젯'))})
    const button=()=>document.querySelector('button[aria-label="메모 숨기기"],button[aria-label="메모 표시"]')
    assert.equal(button().getAttribute('aria-pressed'),'true')
    await act(async()=>{Simulate.click(button());Simulate.click(button())})
    assert.equal(calls,1)
    await act(async()=>{rejectSave(new Error('network'))})
    assert.equal(button().getAttribute('aria-pressed'),'true')
    assert.equal(window.localStorage.length,0)
    await act(async()=>{Simulate.click(button())})
    await act(async()=>{resolveSave({})})
    assert.equal(button().getAttribute('aria-pressed'),'false')
    assert.ok(host.textContent.includes('표시할 위젯이 없습니다'))
    await act(async()=>{Simulate.click(button())})
    await act(async()=>{resolveSave({})})
    assert.equal(button().getAttribute('aria-pressed'),'true')
    await act(async()=>{Simulate.click(document.querySelector('button[aria-label="체크 표시"]'))})
    await act(async()=>{resolveSave({})})
    const collapse=[...document.querySelectorAll('button')].find(b=>b.textContent==='완료 접기')
    await act(async()=>{Simulate.click(collapse)})
    const checkbox=document.querySelector('input[type="checkbox"]:not(:disabled)')
    await act(async()=>{Simulate.change(checkbox)})
    assert.equal(checkbox.checked,false,'failed check save restores unchecked state')
    await act(async()=>{Simulate.click(document.querySelector('button[title="항목 삭제"]'))})
    assert.deepEqual(deletedIds,[20],'collapsed completed rows must not change deletion target')
    await act(async()=>{Simulate.click(document.querySelector('button[aria-label="근태 표시"]'))})
    await act(async()=>{resolveSave({})})
    const width=document.querySelector('button[aria-label="근태 위젯 가로 크기 조절"]')
    const height=document.querySelector('button[aria-label="근태 위젯 세로 크기 조절"]')
    assert.ok(width && height,'resize handles available without edit mode')
    await act(async()=>{Simulate.keyDown(width,{key:'ArrowLeft'})})
    assert.equal(lastPayload.items.find(i=>i.widget_key==='my_attendance').config_json._dashboard_grid_v2.w,4)
    await act(async()=>{resolveSave({})})
    await act(async()=>{Simulate.keyDown(height,{key:'ArrowDown'})})
    assert.equal(lastPayload.items.find(i=>i.widget_key==='my_attendance').config_json._dashboard_grid_v2.h,5)
    await act(async()=>{resolveSave({})})
    const card=document.querySelector('article[data-widget="my_attendance"]')
    assert.ok(card.style.gridColumn.includes('span 4'));assert.ok(card.style.gridRow.includes('span 5'))
    await act(async()=>{Simulate.keyDown(width,{key:'ArrowRight'})})
    await act(async()=>{rejectSave(new Error('network'))})
    assert.ok(card.style.gridColumn.includes('span 4'),'failed resize keeps previous size')
    width.setPointerCapture=()=>{}
    card.parentElement.getBoundingClientRect=()=>({width:1024})
    const beforeDrag=calls
    await act(async()=>{Simulate.pointerDown(width,{button:0,pointerId:1,clientX:100,clientY:100})})
    await act(async()=>{Simulate.pointerMove(width,{pointerId:1,clientX:50,clientY:100});await new Promise(r=>setTimeout(r,5))})
    assert.ok(parseFloat(card.style.width)<150,'pointer movement previews a smaller pixel width')
    assert.ok(card.style.gridColumn.includes('span 4'),'grid placement remains fixed during preview')
    assert.equal(calls,beforeDrag,'preview must not write to server')
    await act(async()=>{Simulate.pointerCancel(width,{pointerId:1})})
    assert.ok(card.style.gridColumn.includes('span 4'),'cancel restores original width')
    assert.equal(card.style.width,'','cancel removes pixel override')
    await act(async()=>{Simulate.pointerDown(width,{button:0,pointerId:2,clientX:100,clientY:100})})
    await act(async()=>{Simulate.pointerMove(width,{pointerId:2,clientX:50,clientY:100});await new Promise(r=>setTimeout(r,5))})
    await act(async()=>{Simulate.pointerUp(width,{pointerId:2})})
    assert.equal(lastPayload.items.find(i=>i.widget_key==='my_attendance').config_json._dashboard_grid_v2.w,3)
    await act(async()=>{resolveSave({})})
    assert.ok(card.style.gridColumn.includes('span 3'))
    const memoHandle=document.querySelector('button[aria-label="메모 위젯 가로 크기 조절"]')
    await act(async()=>{Simulate.keyDown(memoHandle,{key:'ArrowRight'})})
    const memoSaved=lastPayload.items.find(i=>i.widget_key==='memo_widget')
    assert.equal(memoSaved.config_json._dashboard_grid_v2.w,11)
    assert.equal(memoSaved.config_json._dashboard_size_custom,true)
    await act(async()=>{resolveSave({})})
    await act(async()=>{Simulate.pointerDown(width,{button:0,pointerId:3,clientX:100,clientY:100})})
    await act(async()=>{Simulate.pointerMove(width,{pointerId:3,clientX:10000,clientY:100});await new Promise(r=>setTimeout(r,5))})
    const maxPixels=parseFloat(card.style.width)
    await act(async()=>{Simulate.pointerMove(width,{pointerId:3,clientX:9993,clientY:100});await new Promise(r=>setTimeout(r,5))})
    assert.ok(Math.abs(parseFloat(card.style.width)-(maxPixels-7))<0.01,'reversing at maximum moves immediately by pixels')
    await act(async()=>{Simulate.pointerCancel(width,{pointerId:3})})
    const memoCard=document.querySelector('article[data-widget="memo_widget"]')
    const title=memoCard.querySelector('[data-widget-title]')
    const surface=title.closest('[tabindex="-1"]')
    surface.setPointerCapture=()=>{}
    memoCard.parentElement.getBoundingClientRect=()=>({width:1024,top:0,left:0})
    const initialColumn=memoCard.style.gridColumn
    const startX=Number(initialColumn.split('/')[0])-1
    const delta=startX>0?-50:50
    const beforeMove=calls
    await act(async()=>{Simulate.pointerDown(title,{button:0,pointerId:4,clientX:200,clientY:200})})
    await act(async()=>{Simulate.pointerMove(surface,{pointerId:4,clientX:200+delta,clientY:213});await new Promise(r=>setTimeout(r,5))})
    assert.ok(memoCard.style.transform.includes(`${delta}px, 13px`),'card follows exact pointer delta')
    assert.equal(memoCard.style.gridColumn,initialColumn,'neighbors and grid stay put during preview')
    assert.equal(calls,beforeMove)
    await act(async()=>{Simulate.pointerCancel(surface,{pointerId:4})})
    assert.equal(memoCard.style.transform,'')
    await act(async()=>{Simulate.pointerDown(title,{button:0,pointerId:5,clientX:200,clientY:200})})
    await act(async()=>{Simulate.pointerMove(surface,{pointerId:5,clientX:200+delta,clientY:250});await new Promise(r=>setTimeout(r,5))})
    await act(async()=>{Simulate.pointerUp(surface,{pointerId:5})})
    assert.equal(lastPayload.items.find(i=>i.widget_key==='memo_widget').config_json._dashboard_grid_v2.x,startX+(delta>0?1:-1))
    await act(async()=>{rejectSave(new Error('network'))})
    assert.equal(memoCard.style.gridColumn,initialColumn,'failed move restores original position')
    assert.equal(memoCard.style.transform,'')
    await act(async()=>{root.unmount()});host.remove()
  })
}
