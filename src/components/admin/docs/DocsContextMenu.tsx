'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

export type DocsContextMenuItem = {
  key: string
  label: string
  disabled?: boolean
  onClick?: () => void
}

type DocsContextMenuProps = {
  open: boolean
  x: number
  y: number
  items: DocsContextMenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 160

export default function DocsContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: DocsContextMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (containerRef.current?.contains(target || null)) return
      onClose()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open, onClose])

  const safePosition = useMemo(() => {
    if (typeof window === 'undefined') return { left: x, top: y }
    const maxLeft = Math.max(8, window.innerWidth - MENU_WIDTH - 8)
    const left = Math.min(Math.max(8, x), maxLeft)
    const top = Math.min(Math.max(8, y), window.innerHeight - 8)
    return { left, top }
  }, [x, y])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[120] min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
      style={{ left: safePosition.left, top: safePosition.top }}
      role="menu"
      aria-label="문서 컨텍스트 메뉴"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            item.onClick?.()
            onClose()
          }}
          className="block w-full rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
