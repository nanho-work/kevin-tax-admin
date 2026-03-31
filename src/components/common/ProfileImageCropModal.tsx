'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type CropResult = {
  file: File
  previewUrl: string
}

interface Props {
  open: boolean
  imageSrc: string | null
  fileName?: string
  onClose: () => void
  onApply: (result: CropResult) => void
}

const VIEWPORT_SIZE = 240

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildFileName(fileName?: string) {
  const base = (fileName || 'profile-image').replace(/\.[^/.]+$/, '')
  return `${base}_profile.jpg`
}

export default function ProfileImageCropModal({
  open,
  imageSrc,
  fileName,
  onClose,
  onApply,
}: Props) {
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 })
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)

  const baseScale = useMemo(() => {
    if (!naturalSize.w || !naturalSize.h) return 1
    return Math.max(VIEWPORT_SIZE / naturalSize.w, VIEWPORT_SIZE / naturalSize.h)
  }, [naturalSize.h, naturalSize.w])

  const displayW = naturalSize.w * baseScale * zoom
  const displayH = naturalSize.h * baseScale * zoom
  const maxPanX = Math.max(0, (displayW - VIEWPORT_SIZE) / 2)
  const maxPanY = Math.max(0, (displayH - VIEWPORT_SIZE) / 2)

  useEffect(() => {
    if (!open) return
    setZoom(1)
    setPanX(0)
    setPanY(0)
    setNaturalSize({ w: 0, h: 0 })
  }, [open, imageSrc])

  useEffect(() => {
    setPanX((prev) => clamp(prev, -maxPanX, maxPanX))
    setPanY((prev) => clamp(prev, -maxPanY, maxPanY))
  }, [maxPanX, maxPanY])

  const applyZoom = (nextZoom: number) => {
    setZoom(clamp(nextZoom, 1, 3))
  }

  if (!open || !imageSrc) return null

  const handleApply = async () => {
    if (!naturalSize.w || !naturalSize.h) return
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sx = ((displayW / 2 - VIEWPORT_SIZE / 2 - panX) / displayW) * naturalSize.w
    const sy = ((displayH / 2 - VIEWPORT_SIZE / 2 - panY) / displayH) * naturalSize.h
    const sw = (VIEWPORT_SIZE / displayW) * naturalSize.w
    const sh = (VIEWPORT_SIZE / displayH) * naturalSize.h

    const safeSw = clamp(sw, 1, naturalSize.w)
    const safeSh = clamp(sh, 1, naturalSize.h)
    const safeSx = clamp(sx, 0, naturalSize.w - safeSw)
    const safeSy = clamp(sy, 0, naturalSize.h - safeSh)

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    })

    ctx.drawImage(img, safeSx, safeSy, safeSw, safeSh, 0, 0, 512, 512)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    )
    if (!blob) return

    const outFile = new File([blob], buildFileName(fileName), { type: 'image/jpeg' })
    const previewUrl = URL.createObjectURL(blob)
    onApply({ file: outFile, previewUrl })
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50">
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
        <p className="text-sm font-semibold text-zinc-900">프로필 이미지 편집</p>
        <p className="mt-1 text-xs text-zinc-500">점선 영역 기준으로 업로드됩니다.</p>

        <div className="mt-3 flex justify-center">
          <div
            className="relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onDragStart={(e) => e.preventDefault()}
            onWheel={(e) => {
              e.preventDefault()
              const next = zoom + (e.deltaY < 0 ? 0.08 : -0.08)
              applyZoom(next)
            }}
            onPointerDown={(e) => {
              dragRef.current = { active: true, x: e.clientX, y: e.clientY }
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return
              const dx = e.clientX - dragRef.current.x
              const dy = e.clientY - dragRef.current.y
              dragRef.current = { active: true, x: e.clientX, y: e.clientY }
              setPanX((prev) => clamp(prev + dx, -maxPanX, maxPanX))
              setPanY((prev) => clamp(prev + dy, -maxPanY, maxPanY))
            }}
            onPointerUp={() => {
              dragRef.current.active = false
            }}
            onPointerLeave={() => {
              dragRef.current.active = false
            }}
            onPointerCancel={() => {
              dragRef.current.active = false
            }}
            onTouchStart={(e) => {
              if (e.touches.length !== 2) return
              const [a, b] = [e.touches[0], e.touches[1]]
              const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
              pinchRef.current = { distance, zoom }
            }}
            onTouchMove={(e) => {
              if (e.touches.length !== 2 || !pinchRef.current) return
              e.preventDefault()
              const [a, b] = [e.touches[0], e.touches[1]]
              const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
              const scale = distance / Math.max(1, pinchRef.current.distance)
              applyZoom(pinchRef.current.zoom * scale)
            }}
            onTouchEnd={() => {
              pinchRef.current = null
            }}
          >
            <img
              src={imageSrc}
              alt="crop preview"
              draggable={false}
              onLoad={(e) => {
                const target = e.currentTarget
                setNaturalSize({
                  w: target.naturalWidth || 0,
                  h: target.naturalHeight || 0,
                })
              }}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: `${displayW || VIEWPORT_SIZE}px`,
                height: `${displayH || VIEWPORT_SIZE}px`,
                transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`,
                touchAction: 'none',
                cursor: 'grab',
              }}
            />
            <div className="pointer-events-none absolute inset-2 rounded-md border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-600">
            확대/축소
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-zinc-600">
            좌우 위치
            <input
              type="range"
              min={-maxPanX}
              max={maxPanX}
              step={1}
              value={panX}
              onChange={(e) => setPanX(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-zinc-600">
            상하 위치
            <input
              type="range"
              min={-maxPanY}
              max={maxPanY}
              step={1}
              value={panY}
              onChange={(e) => setPanY(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-800"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
