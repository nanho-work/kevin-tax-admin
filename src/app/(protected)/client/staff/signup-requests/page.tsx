'use client'

import ClientStaffSignupRequestsSection from '@/components/client/staff/signup/ClientStaffSignupRequestsSection'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'

export default function ClientStaffSignupRequestsPage() {
  const { session, loading } = useClientSessionContext()
  const canManage = getClientRoleRank(session) <= 10

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!canManage) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">권한 없음</div>
  }

  return <ClientStaffSignupRequestsSection />
}
