'use client'

import { type DragEvent, type HTMLAttributes, type ReactNode, useState } from 'react'

type FileDropzoneProps = {
  onFilesDrop: (files: FileList) => void
  onClick?: () => void
  className?: string
  idleClassName?: string
  activeClassName?: string
  disabled?: boolean
  children: ReactNode
} & Omit<HTMLAttributes<HTMLDivElement>, 'onDrop' | 'onDragOver' | 'onDragLeave' | 'onClick' | 'children'>

function joinClassNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ')
}

export default function FileDropzone({
  onFilesDrop,
  onClick,
  className,
  idleClassName = '',
  activeClassName = '',
  disabled = false,
  children,
  ...rest
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    if (isDragging) setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    setIsDragging(false)
    const files = event.dataTransfer.files
    if (!files || files.length === 0) return
    onFilesDrop(files)
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={(event) => {
        if (!onClick || disabled) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onClick()
      }}
      {...rest}
      className={joinClassNames(
        className,
        isDragging ? activeClassName : idleClassName,
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {children}
    </div>
  )
}
