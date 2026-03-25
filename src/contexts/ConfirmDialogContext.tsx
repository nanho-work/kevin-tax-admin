'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import UiButton from '@/components/common/UiButton'

type ConfirmDialogVariant = 'default' | 'danger'

type ConfirmDialogOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
}

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

type DialogState = {
  open: boolean
  options: ConfirmDialogOptions
}

const DEFAULT_OPTIONS: Required<ConfirmDialogOptions> = {
  title: '확인',
  description: '',
  confirmText: '확인',
  cancelText: '취소',
  variant: 'default',
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((result: boolean) => void) | null>(null)
  const [state, setState] = useState<DialogState>({
    open: false,
    options: DEFAULT_OPTIONS,
  })

  const closeDialog = useCallback((result: boolean) => {
    const resolver = resolverRef.current
    resolverRef.current = null
    setState((prev) => ({ ...prev, open: false }))
    resolver?.(result)
  }, [])

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false)
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({
        open: true,
        options: {
          ...DEFAULT_OPTIONS,
          ...options,
        },
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false)
        resolverRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!state.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeDialog(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDialog, state.open])

  const value = useMemo<ConfirmDialogContextValue>(() => ({ confirm }), [confirm])
  const options = state.options

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {state.open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4" onMouseDown={() => closeDialog(false)}>
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-800">{options.title}</p>
            {options.description ? <p className="mt-2 text-sm text-zinc-700">{options.description}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => closeDialog(false)}>
                {options.cancelText}
              </UiButton>
              <UiButton
                size="sm"
                variant={options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => closeDialog(true)}
              >
                {options.confirmText}
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  }
  return context
}
