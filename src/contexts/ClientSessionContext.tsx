'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { checkClientSession } from '@/services/client/clientAuthService'
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
      setSession(null)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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
