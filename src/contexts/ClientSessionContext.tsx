'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { checkClientSession } from '@/services/client/clientAuthService'
import { clearClientAccessToken, getClientAccessTokenExpiryMs } from '@/services/http'
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

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handleFocus = () => {
      void refresh()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
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
