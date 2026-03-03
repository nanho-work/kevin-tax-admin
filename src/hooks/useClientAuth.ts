'use client'

import { useCallback } from 'react'
import { checkClientSession, clientLogin, logoutClient } from '@/services/client/clientAuthService'
import type { ClientLoginRequest } from '@/types/clientAuth'

export function useClientAuth() {
  const login = useCallback((payload: ClientLoginRequest) => clientLogin(payload), [])
  const session = useCallback(() => checkClientSession(), [])
  const logout = useCallback(() => logoutClient(), [])
  return { login, session, logout }
}

