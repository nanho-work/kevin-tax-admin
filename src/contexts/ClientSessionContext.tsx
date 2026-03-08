'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { checkClientSession } from '@/services/client/clientAuthService'
import { clearClientAccessToken, getClientAccessToken, getClientAccessTokenExpiryMs } from '@/services/http'
import type { ClientSession } from '@/types/clientAuth'

interface ClientSessionContextValue {
  session: ClientSession | null
  loading: boolean
  error: unknown
  refresh: () => Promise<void>
}

const ClientSessionContext = createContext<ClientSessionContextValue | null>(null)

export function ClientSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    const token = getClientAccessToken()
    if (!token) {
      setSession(null)
      setError(null)
      setLoading(false)
      initializedRef.current = true
      return
    }

    const shouldBlock = !initializedRef.current
    try {
      if (shouldBlock) setLoading(true)
      setError(null)
      const data = await checkClientSession()
      setSession(data)
    } catch (err) {
      const status = (err as any)?.response?.status
      if (status === 401) {
        clearClientAccessToken()
        setSession(null)
      }
      setError(err)
    } finally {
      if (shouldBlock) {
        setLoading(false)
        initializedRef.current = true
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!session) return
    const checkTokenExpiry = () => {
      const expiryMs = getClientAccessTokenExpiryMs()
      if (expiryMs && Date.now() >= expiryMs) {
        clearClientAccessToken()
        setSession(null)
      }
    }
    checkTokenExpiry()
    const timer = window.setInterval(checkTokenExpiry, 30_000)
    return () => window.clearInterval(timer)
  }, [session])

  const value = useMemo<ClientSessionContextValue>(
    () => ({ session, loading, error, refresh }),
    [session, loading, error, refresh]
  )

  return <ClientSessionContext.Provider value={value}>{children}</ClientSessionContext.Provider>
}

export function useClientSessionContext() {
  const context = useContext(ClientSessionContext)
  if (!context) {
    throw new Error('useClientSessionContext must be used within ClientSessionProvider')
  }
  return context
}
