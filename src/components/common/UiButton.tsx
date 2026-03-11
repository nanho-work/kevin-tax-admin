'use client'

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type UiButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'soft'
  | 'tabActive'
  | 'tabInactive'

type UiButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'iconSm'

export type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant
  size?: UiButtonSize
}

const variantClassMap: Record<UiButtonVariant, string> = {
  primary: 'border border-sky-600 bg-sky-600 text-white hover:bg-sky-700',
  secondary: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
  soft: 'border border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
  tabActive: 'border-sky-300 bg-sky-50 text-sky-700',
  tabInactive: 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50',
}

const sizeClassMap: Record<UiButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px]',
  sm: 'h-7 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9',
  iconSm: 'h-7 w-7',
}

export default function UiButton({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: UiButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        variantClassMap[variant],
        sizeClassMap[size],
        className
      )}
      {...props}
    />
  )
}

