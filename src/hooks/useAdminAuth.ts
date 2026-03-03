'use client'

import { useCallback } from 'react'
import { adminLogin, checkAdminSession, logoutAdmin } from '@/services/admin/adminService'
import type { LoginRequest } from '@/types/admin'

export function useAdminAuth() {
  const login = useCallback((payload: LoginRequest) => adminLogin(payload), [])
  const session = useCallback(() => checkAdminSession(), [])
  const logout = useCallback(() => logoutAdmin(), [])
  return { login, session, logout }
}

