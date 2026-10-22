'use client'

import StaffTable from '@/components/client/staff/management/StaffTable'
import { useManagementSession } from '@/contexts/ManagementSession'
import { getClientRoleRank } from '@/utils/roleRank'
import { useSearchParams } from 'next/navigation'

export default function ClientStaffPage() {
  const { session, loading } = useManagementSession()
  const canManage = getClientRoleRank(session) <= 10
  const searchParams = useSearchParams()
  const initialPanel = searchParams.get('panel') === 'org' ? 'org' : null

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  return (
    <section>
      <StaffTable canManage={canManage} initialPanel={initialPanel} />
    </section>
  )
}
