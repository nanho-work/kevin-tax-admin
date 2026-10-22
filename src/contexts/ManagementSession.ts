'use client'
import { useOptionalAdminSession } from './AdminSessionContext'
import { useOptionalClientSession } from './ClientSessionContext'
import { getAdminRoleRank } from '@/utils/roleRank'
// Only presentation fields are shared. API calls keep the real actor's token.
export function useManagementSession() {
  const admin = useOptionalAdminSession()
  const client = useOptionalClientSession()
  if (admin) return { ...admin, session: admin.session ? {
    client_id: admin.session.client_id, name: admin.session.name,
    rank_order: getAdminRoleRank(admin.session) === 1 ? 10 : 999,
  } : null }
  if (client) return client
  throw new Error('Management session provider is required')
}
