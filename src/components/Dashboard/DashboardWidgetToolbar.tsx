'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGrid, X } from 'lucide-react'

type WidgetOption = { widget_key: string; title: string; description?: string | null }
type Props = {
  items: WidgetOption[]
  visibleKeys: string[]
  saving: boolean
  disabled: boolean
  onToggle: (key: string) => void
}

export default function DashboardWidgetToolbar({ items, visibleKeys, saving, disabled, onToggle }: Props) {
  const [mounted, setMounted] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, right: 20, downward: false })
  useEffect(() => {
    setMounted(true)
    const update = () => {
      const chat = document.querySelector('[data-work-chat-launcher]')
      const rect = chat?.getBoundingClientRect()
      const top = rect ? Math.max(12, rect.top - 48) : window.innerHeight - 116
      const right = rect ? Math.max(20, window.innerWidth - rect.right) : 20
      setAnchor(previous => previous.top === top && previous.right === right && previous.downward === (top < window.innerHeight / 2)
        ? previous : { top, right, downward: top < window.innerHeight / 2 })
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-work-chat-launcher'] })
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  if (!mounted) return null
  return createPortal(
    <div className="fixed z-[90]" style={{ top: anchor.top, right: anchor.right }}>
      <span role="status" className="sr-only">{saving ? '변경사항 저장 중…' : ''}</span>
      <div className="flex items-center gap-2">
        <div ref={panelRef} className="relative">
          <button ref={triggerRef} type="button" disabled={disabled} aria-expanded={open} aria-controls="dashboard-widget-settings"
            onClick={() => setOpen(!open)}
            className={`inline-flex h-9 items-center gap-1 rounded-full border px-1.5 shadow-md text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${open ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <LayoutGrid className="h-3.5 w-3.5" />위젯
          </button>
          {open && <section id="dashboard-widget-settings" aria-label="위젯 표시 설정" style={{ maxHeight: anchor.downward ? `calc(100dvh - ${anchor.top + 56}px)` : `${Math.max(100, anchor.top - 12)}px` }} className={`absolute right-0 ${anchor.downward ? 'top-11' : 'bottom-11'} flex w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg`}>
            <div className="flex items-start justify-between px-4 pb-3 pt-4">
              <div><h2 className="text-sm font-semibold text-slate-900">표시할 위젯</h2><p className="mt-1 text-xs text-slate-500">선택한 항목은 자동으로 저장됩니다.</p></div>
              <button type="button" aria-label="위젯 설정 닫기" onClick={() => { setOpen(false); triggerRef.current?.focus() }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 overflow-y-auto px-2 pb-2">
              {items.map(item => {
                const active = visibleKeys.includes(item.widget_key)
                return <button key={item.widget_key} type="button" disabled={saving} aria-pressed={active}
                  aria-label={`${item.title} ${active ? '숨기기' : '표시'}`} onClick={() => onToggle(item.widget_key)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 disabled:opacity-50">
                  <span className="text-sm font-medium text-slate-700">{item.title}</span>
                  <span aria-hidden="true" className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${active ? 'bg-sky-600' : 'bg-slate-200'}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-4' : ''}`} /></span>
                </button>
              })}
            </div>
          </section>}
        </div>
      </div>
    </div>, document.body
  )
}
