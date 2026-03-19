'use client'

import { useMemo, useState } from 'react'
import StaffForm from '@/components/admin/staff/StaffForm'
import StaffTable from '@/components/admin/staff/StaffTable'
import StaffTab from '@/components/admin/staff/StaffTab'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { getAdminRoleRank } from '@/utils/roleRank'

export default function AdminStaffManagementPage() {
  const { session, loading } = useAdminSessionContext()
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list')

  const canManage = useMemo(() => getAdminRoleRank(session) <= 2, [session])

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        권한 확인 중...
      </section>
    )
  }

  return (
    <section>
      <StaffTab activeTab={activeTab} onTabChange={setActiveTab} canManage={canManage} />
      {activeTab === 'list' ? <StaffTable /> : canManage ? <StaffForm /> : null}
    </section>
  )
}

