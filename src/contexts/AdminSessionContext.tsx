'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { checkAdminSession } from '@/services/admin/adminService'
import {
  clearAdminAccessToken,
  getAdminAccessToken,
  getAdminAccessTokenExpiryMs,
} from '@/services/http'
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
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    const token = getAdminAccessToken()
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
      const data = await checkAdminSession()
      setSession(data)
    } catch (err) {
      const status = (err as any)?.response?.status
      if (status === 401) {
        clearAdminAccessToken()
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
      const expiryMs = getAdminAccessTokenExpiryMs()
      if (expiryMs && Date.now() >= expiryMs) {
        clearAdminAccessToken()
        setSession(null)
      }
    }
    checkTokenExpiry()
    const timer = window.setInterval(checkTokenExpiry, 30_000)
    return () => window.clearInterval(timer)
  }, [session])

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
