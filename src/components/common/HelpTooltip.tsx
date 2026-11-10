'use client'

import { useId, useLayoutEffect, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function HelpTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; maxWidth: number; maxHeight: number } | null>(null)
  const open = !dismissed && (hovered || focused)
  const enter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true); setDismissed(false)
  }
  const leave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHovered(false), 120)
  }
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current) }, [])
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const update = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return
      const viewport = window.visualViewport
      const x = viewport?.offsetLeft ?? 0
      const y = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? document.documentElement.clientWidth
      const height = viewport?.height ?? window.innerHeight
      const margin = 8
      const gap = 8
      const anchor = trigger.getBoundingClientRect()
      if (anchor.bottom < y || anchor.top > y + height || anchor.right < x || anchor.left > x + width) {
        setDismissed(true)
        return
      }
      const maxWidth = Math.max(1, Math.min(280, width - margin * 2))
      tooltip.style.width = `${maxWidth}px`
      const below = Math.max(0, y + height - margin - anchor.bottom - gap)
      const above = Math.max(0, anchor.top - gap - y - margin)
      const naturalHeight = tooltip.scrollHeight
      const useBelow = below >= naturalHeight || below >= above
      const maxHeight = Math.max(1, useBelow ? below : above)
      const actualHeight = Math.min(naturalHeight, maxHeight)
      const left = Math.max(x + margin, Math.min(anchor.left + anchor.width / 2 - maxWidth / 2, x + width - margin - maxWidth))
      const top = Math.max(y + margin, useBelow ? anchor.bottom + gap : anchor.top - gap - actualHeight)
      setPosition({ left, top, maxWidth, maxHeight })
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(true) }
    update()
    const observer = new ResizeObserver(update)
    if (triggerRef.current) observer.observe(triggerRef.current)
    if (tooltipRef.current) observer.observe(tooltipRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('keydown', escape)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('keydown', escape)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open, children])
  return <span className="inline-flex shrink-0 align-middle font-normal" onMouseEnter={enter} onMouseLeave={leave}>
    <button ref={triggerRef} type="button" aria-label={`${label} 도움말`} aria-describedby={open ? id : undefined}
      onFocus={() => { setFocused(true); setDismissed(false) }} onBlur={() => setFocused(false)}
      onClick={() => { setFocused(true); setDismissed(false) }}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[11px] leading-none text-slate-500 hover:border-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
      <span aria-hidden="true">?</span>
    </button>
    {open && createPortal(<span ref={tooltipRef} id={id} role="tooltip" onMouseEnter={enter} onMouseLeave={leave}
      style={{ position: 'fixed', zIndex: 10000, left: position?.left ?? 0, top: position?.top ?? 0, width: position?.maxWidth ?? 280, maxHeight: position?.maxHeight, visibility: position ? 'visible' : 'hidden' }}
      className="block overflow-y-auto break-words rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg">{children}</span>, document.body)}
  </span>
}
