'use client'

import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import UiButton from '@/components/common/UiButton'

type UiSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onClear?: () => void
  wrapperClassName?: string
  inputClassName?: string
}

export default function UiSearchInput({
  value,
  onChange,
  onSubmit,
  onClear,
  wrapperClassName,
  inputClassName,
  placeholder = '검색',
  disabled,
  ...props
}: UiSearchInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && onSubmit) {
      event.preventDefault()
      onSubmit()
    }
  }

  const clear = () => {
    if (onClear) {
      onClear()
      return
    }
    onChange('')
  }

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 transition focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-200',
        disabled && 'opacity-60',
        wrapperClassName
      )}
    >
      <Search className="h-4 w-4 text-zinc-400" />
      <input
        {...props}
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'h-full w-full border-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400',
          inputClassName
        )}
      />
      {value ? (
        <UiButton
          type="button"
          size="iconSm"
          variant="soft"
          aria-label="검색어 지우기"
          onClick={clear}
          disabled={disabled}
          className="shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </UiButton>
      ) : null}
    </div>
  )
}
