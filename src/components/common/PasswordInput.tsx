'use client'

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, SyntheticEvent } from 'react'
import { toEnglishPasswordKeys } from '@/utils/passwordKeyboard'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> & { value: string }

/** Keep IME composition intact visually, but never send Korean text to form state. */
const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ value, onChange, onCompositionStart, onCompositionEnd, onKeyDown, onBlur, ...props }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selection = useRef<[number, number] | null>(null)
  useImperativeHandle(ref, () => inputRef.current!)
  useLayoutEffect(() => {
    if (selection.current && inputRef.current) {
      inputRef.current.setSelectionRange(...selection.current)
      selection.current = null
    }
  })
  const composing = useRef(false)
  const [draft, setDraft] = useState<string | null>(null)

  function emit(event: SyntheticEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const raw = input.value
    const next = toEnglishPasswordKeys(raw)
    const start = input.selectionStart
    const end = input.selectionEnd
    // Existing form handlers read event.target.value. Normalize before forwarding.
    input.value = next
    onChange?.(event as ChangeEvent<HTMLInputElement>)
    if (next !== raw && start !== null && end !== null) {
      selection.current = [toEnglishPasswordKeys(raw.slice(0, start)).length, toEnglishPasswordKeys(raw.slice(0, end)).length]
      input.setSelectionRange(...selection.current)
    }
  }

  return <input {...props} ref={inputRef} type={props.type ?? 'password'} value={draft ?? value}
    autoCapitalize="none" autoCorrect="off" spellCheck={false} lang="en" inputMode="text"
    onCompositionStart={(event) => {
      composing.current = true
      setDraft(event.currentTarget.value)
      onCompositionStart?.(event)
    }}
    onChange={(event) => {
      if (composing.current) {
        setDraft(event.currentTarget.value)
        return
      }
      emit(event)
    }}
    onCompositionEnd={(event) => {
      composing.current = false
      setDraft(null)
      emit(event)
      onCompositionEnd?.(event)
    }}
    onBlur={(event) => {
      composing.current = false
      setDraft(null)
      emit(event)
      onBlur?.(event)
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      onKeyDown?.(event)
    }}
  />
})

export default PasswordInput
