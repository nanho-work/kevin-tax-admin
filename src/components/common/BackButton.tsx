'use client'

import { useRouter } from 'next/navigation'

type Props = {
  fallbackPath: string
  label?: string
  className?: string
}

export default function BackButton({ fallbackPath, label = '뒤로가기', className }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackPath)
      }}
      className={
        className || 'rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50'
      }
    >
      {label}
    </button>
  )
}
