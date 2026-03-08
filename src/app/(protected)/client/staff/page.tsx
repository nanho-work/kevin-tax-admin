'use client'

import StaffTable from '@/components/client/staff/management/StaffTable'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientRoleRank } from '@/utils/roleRank'

export default function ClientStaffPage() {
  const { session, loading } = useClientSessionContext()
  const canManage = getClientRoleRank(session) <= 10

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  return (
    <section>
      <StaffTable canManage={canManage} />
    </section>
  )
}
