'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { DASHBOARD_COLUMNS, DASHBOARD_GAP, DASHBOARD_ROW_HEIGHT } from '@/utils/dashboardGrid'

type Props = { children: ReactNode; className?: string; x: number; y: number; width: number; disabled: boolean; onMove: (x: number, y: number) => Promise<void>; onActive: (value: boolean) => void }
type Drag = { id: number; startX: number; startY: number; dx: number; dy: number; step: number; top: number; left: number; grid: HTMLElement; card: HTMLElement; restore: () => void }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max,value))
const rowStep = DASHBOARD_ROW_HEIGHT + DASHBOARD_GAP

export default function DashboardWidgetMoveSurface({children,className,x,y,width,disabled,onMove,onActive}: Props) {
  const session = useRef<Drag | null>(null)
  const frame = useRef<number | null>(null)
  const pendingRestore = useRef<(() => void) | null>(null)
  const cancelFrame = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null }
  const paint = (drag: Drag) => { drag.card.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0)` }
  useEffect(() => () => { cancelFrame(); session.current?.restore(); pendingRestore.current?.() }, [])
  const finish = async (commit: boolean) => {
    const drag = session.current
    if (!drag) return
    session.current = null; cancelFrame()
    const nextX = clamp(Math.round(x + drag.dx / drag.step),0,DASHBOARD_COLUMNS-width)
    const nextY = Math.max(0,Math.round(y + drag.dy / rowStep))
    if (commit && (nextX !== x || nextY !== y)) {
      drag.dx = (nextX-x)*drag.step; drag.dy = (nextY-y)*rowStep; paint(drag)
      pendingRestore.current = drag.restore
      try { await onMove(nextX,nextY) } finally { drag.restore(); pendingRestore.current=null; onActive(false) }
    } else { drag.restore(); onActive(false) }
  }
  return <div className={className} tabIndex={-1} onDragStart={event=>event.preventDefault()}
    onPointerDown={event=>{
      if (disabled || event.button!==0 || session.current || pendingRestore.current || window.matchMedia('(max-width: 1023px)').matches) return
      const target = event.target as HTMLElement
      if (!target.closest('[data-widget-title]') || target.closest('button,input,select,textarea,a')) return
      const card = event.currentTarget.closest('article'); const grid=card?.parentElement
      if (!card || !grid) return
      event.preventDefault(); event.currentTarget.focus({preventScroll:true}); event.currentTarget.setPointerCapture(event.pointerId)
      const rect=grid.getBoundingClientRect()
      const old={transform:card.style.transform,zIndex:card.style.zIndex,boxShadow:card.style.boxShadow,transition:card.style.transition,willChange:card.style.willChange}
      const cursor=document.body.style.cursor; const selection=document.body.style.userSelect
      const restore=()=>{Object.assign(card.style,old);document.body.style.cursor=cursor;document.body.style.userSelect=selection}
      session.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,dx:0,dy:0,step:(rect.width+DASHBOARD_GAP)/DASHBOARD_COLUMNS,top:rect.top,left:rect.left,grid,card,restore}
      card.style.zIndex='30';card.style.transition='none';card.style.willChange='transform';card.style.boxShadow='0 12px 28px rgb(15 23 42 / 16%)'
      document.body.style.cursor='grabbing';document.body.style.userSelect='none';onActive(true)
    }}
    onPointerMove={event=>{
      const drag=session.current
      if (!drag || drag.id!==event.pointerId) return
      const rect=drag.grid.getBoundingClientRect()
      drag.dx=clamp(event.clientX-drag.startX+drag.left-rect.left,-x*drag.step,(DASHBOARD_COLUMNS-width-x)*drag.step)
      drag.dy=Math.max(-y*rowStep,event.clientY-drag.startY+drag.top-rect.top)
      if(frame.current===null) frame.current=requestAnimationFrame(()=>{frame.current=null;if(session.current===drag)paint(drag)})
    }}
    onPointerUp={event=>{if(session.current?.id===event.pointerId)void finish(true)}}
    onPointerCancel={()=>void finish(false)} onLostPointerCapture={()=>void finish(false)}
    onKeyDown={event=>{if(event.key==='Escape')void finish(false)}}>{children}</div>
}
