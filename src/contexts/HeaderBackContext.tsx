'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

type BackAction = { pathname: string; run: () => void }
const HeaderBackContext = createContext<{
  action: BackAction | null
  register: (action: BackAction) => () => void
}>({ action: null, register: () => () => {} })

export function HeaderBackProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<BackAction | null>(null)
  const register = useCallback((next: BackAction) => {
    setAction(next)
    return () => setAction(current => current === next ? null : current)
  }, [])
  return <HeaderBackContext.Provider value={{ action, register }}>{children}</HeaderBackContext.Provider>
}

export function useHeaderBackAction() {
  const pathname = usePathname()
  const { action } = useContext(HeaderBackContext)
  return action?.pathname === pathname ? action.run : null
}

/** Detail panels with no URL change can register their own return-to-list action. */
export function useInPageBack(enabled: boolean, onBack: () => void) {
  const pathname = usePathname()
  const { register } = useContext(HeaderBackContext)
  const callback = useRef(onBack)
  useEffect(() => { callback.current = onBack }, [onBack])
  useEffect(() => {
    if (!enabled) return
    return register({ pathname, run: () => callback.current() })
  }, [enabled, pathname, register])
}
