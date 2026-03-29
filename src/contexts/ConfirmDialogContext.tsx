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

type PromptDialogOptions = {
  title?: string
  description?: string
  placeholder?: string
  initialValue?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmDialogVariant
}

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
  prompt: (options: PromptDialogOptions) => Promise<string | null>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

type DialogState = {
  open: boolean
  mode: 'confirm' | 'prompt'
  confirmOptions: ConfirmDialogOptions
  promptOptions: PromptDialogOptions
  promptValue: string
}

const DEFAULT_OPTIONS: Required<ConfirmDialogOptions> = {
  title: '확인',
  description: '',
  confirmText: '확인',
  cancelText: '취소',
  variant: 'default',
}

const DEFAULT_PROMPT_OPTIONS: Required<Omit<PromptDialogOptions, 'initialValue'>> = {
  title: '입력',
  description: '',
  placeholder: '',
  confirmText: '확인',
  cancelText: '취소',
  variant: 'default',
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<((result: boolean | string | null) => void) | null>(null)
  const [state, setState] = useState<DialogState>({
    open: false,
    mode: 'confirm',
    confirmOptions: DEFAULT_OPTIONS,
    promptOptions: DEFAULT_PROMPT_OPTIONS,
    promptValue: '',
  })

  const closeDialog = useCallback((result: boolean | string | null) => {
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
      resolverRef.current = (result) => resolve(result === true)
      setState({
        open: true,
        mode: 'confirm',
        confirmOptions: {
          ...DEFAULT_OPTIONS,
          ...options,
        },
        promptOptions: DEFAULT_PROMPT_OPTIONS,
        promptValue: '',
      })
    })
  }, [])

  const prompt = useCallback((options: PromptDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(null)
    }
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (result) => resolve(typeof result === 'string' ? result : null)
      setState({
        open: true,
        mode: 'prompt',
        confirmOptions: DEFAULT_OPTIONS,
        promptOptions: {
          ...DEFAULT_PROMPT_OPTIONS,
          ...options,
        },
        promptValue: options.initialValue ?? '',
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(state.mode === 'confirm' ? false : null)
        resolverRef.current = null
      }
    }
  }, [state.mode])

  useEffect(() => {
    if (!state.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeDialog(state.mode === 'confirm' ? false : null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDialog, state.mode, state.open])

  const value = useMemo<ConfirmDialogContextValue>(() => ({ confirm, prompt }), [confirm, prompt])
  const options = state.mode === 'confirm' ? state.confirmOptions : state.promptOptions

  const handlePromptSubmit = useCallback(() => {
    closeDialog(state.promptValue)
  }, [closeDialog, state.promptValue])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {state.open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4"
          onMouseDown={() => closeDialog(state.mode === 'confirm' ? false : null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-800">{options.title}</p>
            {options.description ? <p className="mt-2 text-sm text-zinc-700">{options.description}</p> : null}
            {state.mode === 'prompt' ? (
              <input
                value={state.promptValue}
                onChange={(event) => setState((prev) => ({ ...prev, promptValue: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handlePromptSubmit()
                  }
                }}
                placeholder={state.promptOptions.placeholder}
                className="mt-3 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                autoFocus
              />
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <UiButton
                size="sm"
                variant="tabInactive"
                onClick={() => closeDialog(state.mode === 'confirm' ? false : null)}
              >
                {options.cancelText}
              </UiButton>
              <UiButton
                size="sm"
                variant={options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  if (state.mode === 'confirm') {
                    closeDialog(true)
                    return
                  }
                  handlePromptSubmit()
                }}
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
