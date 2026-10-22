'use client'

import type { ButtonHTMLAttributes } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  tone?: 'accent' | 'neutral'
  loading?: boolean
}

export default function HeaderActionButton({ icon: Icon, tone = 'neutral', loading = false, children, className = '', disabled, ...props }: Props) {
  return (
    <button
      {...props}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${tone === 'accent' ? 'bg-sky-100/80 text-sky-800 hover:bg-sky-200/70 active:bg-sky-200' : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 active:bg-slate-200/70'} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </button>
  )
}
