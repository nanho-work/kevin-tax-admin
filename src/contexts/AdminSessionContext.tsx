'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { checkAdminSession } from '@/services/admin/adminService'
import type { AdminSession } from '@/types/admin'

interface AdminSessionContextValue {
  session: AdminSession | null
  loading: boolean
  error: unknown
  refresh: () => Promise<void>
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null)

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await checkAdminSession()
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

  const value = useMemo<AdminSessionContextValue>(
    () => ({ session, loading, error, refresh }),
    [session, loading, error, refresh]
  )

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export function useAdminSessionContext() {
  const context = useContext(AdminSessionContext)
  if (!context) {
    throw new Error('useAdminSessionContext must be used within AdminSessionProvider')
  }
  return context
}

