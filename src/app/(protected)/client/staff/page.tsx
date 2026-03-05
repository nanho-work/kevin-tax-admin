'use client'

import { useEffect, useState } from 'react'
import StaffTable from '@/components/client/staff/management/StaffTable'
import { checkClientSession } from '@/services/client/clientAuthService'

export default function ClientStaffPage() {
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

  return (
    <section>
      <StaffTable canManage={canManage} />
    </section>
  )
}
