'use client'

import { useEffect, useRef } from 'react'
import { DASHBOARD_COLUMNS, DASHBOARD_GAP, DASHBOARD_ROW_HEIGHT } from '@/utils/dashboardGrid'

type Axis = 'x' | 'y' | 'both'
type Props = { title: string; width: number; height: number; minWidth: number; maxWidth: number; minHeight: number; maxHeight: number; disabled: boolean; onResize: (width: number, height: number) => Promise<void>; onActive: (active: boolean) => void }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rowStep = DASHBOARD_ROW_HEIGHT + DASHBOARD_GAP
const pixels = (cells: number, step: number) => cells * step - DASHBOARD_GAP

type Drag = { id: number; x: number; y: number; pxW: number; pxH: number; axis: Axis; step: number; maxW: number; card: HTMLElement; restore: () => void }
export default function DashboardWidgetResizeHandles({ title, width, height, minWidth, maxWidth, minHeight, maxHeight, disabled, onResize, onActive }: Props) {
  const session = useRef<Drag | null>(null)
  const frame = useRef<number | null>(null)
  const pendingRestore = useRef<(() => void) | null>(null)
  const paint = (drag: Drag) => {
    drag.card.style.width = `${drag.pxW}px`
    drag.card.style.height = `${drag.pxH}px`
  }
  const cancelFrame = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null }
  useEffect(() => () => { cancelFrame(); session.current?.restore(); pendingRestore.current?.(); session.current = null }, [])
  const finish = async (commit: boolean) => {
    const drag = session.current
    if (!drag) return
    session.current = null
    cancelFrame()
    const w = drag.axis === 'y' ? width : clamp(Math.round((drag.pxW + DASHBOARD_GAP) / drag.step), minWidth, drag.maxW)
    const h = drag.axis === 'x' ? height : clamp(Math.round((drag.pxH + DASHBOARD_GAP) / rowStep), minHeight, maxHeight)
    if (commit && (w !== width || h !== height)) {
      drag.pxW = pixels(w, drag.step); drag.pxH = pixels(h, rowStep)
      paint(drag)
      pendingRestore.current = drag.restore
      try { await onResize(w,h) } finally { drag.restore(); pendingRestore.current = null; onActive(false) }
    } else { drag.restore(); onActive(false) }
  }
  return <>
    {(['x', 'y', 'both'] as const).map(axis => <button key={axis} type="button" disabled={disabled}
      aria-label={`${title} 위젯 ${axis === 'x' ? '가로' : axis === 'y' ? '세로' : '가로·세로'} 크기 조절`}
      title={`드래그하여 크기 조절 · 가로 ${minWidth}~${maxWidth}칸, 세로 ${minHeight}~${maxHeight}칸`}
      className={`absolute z-20 hidden touch-none select-none border-0 bg-transparent p-0 hover:bg-sky-400/30 focus-visible:bg-sky-400/30 focus-visible:outline-none disabled:pointer-events-none lg:block ${axis === 'x' ? 'bottom-5 right-0 top-3 w-2 cursor-ew-resize' : axis === 'y' ? 'bottom-0 left-3 right-5 h-2 cursor-ns-resize' : 'bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-br-xl'}`}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || session.current || pendingRestore.current) return
        const card = event.currentTarget.closest('article'); const grid = card?.parentElement
        if (!card || !grid) return
        event.preventDefault(); event.stopPropagation(); event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        const step = (grid.getBoundingClientRect().width + DASHBOARD_GAP) / DASHBOARD_COLUMNS
        const maxW = Math.min(maxWidth, DASHBOARD_COLUMNS - Number(card.style.gridColumn.split('/')[0].trim()) + 1)
        const old = { width: card.style.width, height: card.style.height, zIndex: card.style.zIndex, outline: card.style.outline, transition: card.style.transition }
        const cursor = document.body.style.cursor; const selection = document.body.style.userSelect
        const restore = () => { Object.assign(card.style,old); document.body.style.cursor = cursor; document.body.style.userSelect = selection }
        session.current = { id:event.pointerId, x:event.clientX, y:event.clientY, pxW:pixels(width,step), pxH:pixels(height,rowStep), axis, step, maxW, card, restore }
        card.style.zIndex = '30'; card.style.outline = '2px solid #38bdf8'; card.style.transition = 'none'
        document.body.style.cursor = axis === 'x' ? 'ew-resize' : axis === 'y' ? 'ns-resize' : 'nwse-resize'
        document.body.style.userSelect = 'none'
        onActive(true)
      }}
      onPointerMove={event => {
        const drag = session.current
        if (!drag || drag.id !== event.pointerId) return
        // Incremental clamping makes reversing direction respond immediately at limits.
        if (drag.axis !== 'y') drag.pxW = clamp(drag.pxW + event.clientX - drag.x, pixels(minWidth,drag.step), pixels(drag.maxW,drag.step))
        if (drag.axis !== 'x') drag.pxH = clamp(drag.pxH + event.clientY - drag.y, pixels(minHeight,rowStep), pixels(maxHeight,rowStep))
        drag.x = event.clientX; drag.y = event.clientY
        if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; if (session.current === drag) paint(drag) })
      }}
      onPointerUp={event => { if (session.current?.id === event.pointerId) void finish(true) }}
      onPointerCancel={() => void finish(false)} onLostPointerCapture={() => void finish(false)}
      onKeyDown={event => {
        if (event.key === 'Escape') { void finish(false); return }
        if (disabled || session.current || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const start = Number(event.currentTarget.closest('article')?.style.gridColumn.split('/')[0].trim() || 1)
        const w = axis === 'y' ? width : clamp(width + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),minWidth,Math.min(maxWidth,DASHBOARD_COLUMNS-start+1))
        const h = axis === 'x' ? height : clamp(height + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0),minHeight,maxHeight)
        if (w !== width || h !== height) void onResize(w,h)
      }}>
      {axis === 'both' && <span aria-hidden="true" className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-slate-300 group-hover:border-sky-500" />}
    </button>)}
  </>
}
