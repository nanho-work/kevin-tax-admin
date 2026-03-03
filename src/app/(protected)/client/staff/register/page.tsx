'use client'

import { useEffect, useState } from 'react'
import StaffForm from '@/components/admin/staff/StaffForm'
import { checkClientSession } from '@/services/client/clientAuthService'

export default function ClientStaffRegisterPage() {
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await checkClientSession()
        setCanManage(session.role_level <= 10)
      } catch {
        setCanManage(false)
      } finally {
        setLoading(false)
      }
    }
    loadSession()
  }, [])

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!canManage) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">권한 없음</div>
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">직원등록</h1>
        <p className="mt-1 text-sm text-zinc-500">직원 신규 등록 화면입니다.</p>
      </div>
      <StaffForm />
    </section>
  )
}
