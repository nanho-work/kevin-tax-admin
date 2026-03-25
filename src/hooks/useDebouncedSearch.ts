'use client'

import { useCallback, useEffect, useRef } from 'react'

type UseDebouncedSearchOptions = {
  value: string
  onSearch: () => void
  delay?: number
  minLength?: number
  enabled?: boolean
  searchOnEmpty?: boolean
}

export default function useDebouncedSearch({
  value,
  onSearch,
  delay = 300,
  minLength = 1,
  enabled = true,
  searchOnEmpty = true,
}: UseDebouncedSearchOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const runNow = useCallback(() => {
    cancel()
    onSearch()
  }, [cancel, onSearch])

  useEffect(() => {
    if (!enabled) return
    const trimmed = value.trim()
    const canSearch = trimmed.length >= minLength || (searchOnEmpty && trimmed.length === 0)
    if (!canSearch) return

    timeoutRef.current = setTimeout(() => {
      onSearch()
      timeoutRef.current = null
    }, delay)

    return cancel
  }, [value, onSearch, delay, minLength, enabled, searchOnEmpty, cancel])

  return { runNow, cancel }
}

