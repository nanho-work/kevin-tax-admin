'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'

export default function ClientManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { session, loading } = useClientSessionContext()
  const allowed = getClientRoleRank(session) === 0

  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login/client')
      return
    }
    if (!allowed) {
      router.replace('/client/dashboard')
    }
  }, [allowed, loading, router, session])

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
