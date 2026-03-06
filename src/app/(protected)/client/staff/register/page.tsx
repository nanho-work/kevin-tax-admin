'use client'

import StaffForm from '@/components/client/staff/management/StaffForm'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'

export default function ClientStaffRegisterPage() {
  const { session, loading } = useClientSessionContext()
  const canManage = (session?.role_level ?? 999) <= 10

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!canManage) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">권한 없음</div>
  }

  return (
    <section>
      <StaffForm />
    </section>
  )
}
