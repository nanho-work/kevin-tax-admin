'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

type Props = {
  fallbackPath: string
  label?: string
  className?: string
  iconOnly?: boolean
  onBack?: () => void
}

export default function BackButton({ fallbackPath, label = '뒤로가기', className, iconOnly = false, onBack }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (onBack) { onBack(); return }
        if (window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackPath)
      }}
      className={
        className || (iconOnly
          ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2'
          : 'rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50')
      }
    >
      {iconOnly ? <ArrowLeft className="h-5 w-5" aria-hidden="true" /> : label}
    </button>
  )
}
