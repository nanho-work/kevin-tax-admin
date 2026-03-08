'use client'

import { useEffect, useState } from 'react'
import AnnualLeaveTable from '@/components/admin/AnnualLeave/AnnualLeaveTable'
import AdminLeaveRequestPanel from '@/components/admin/staff/AdminLeaveRequestPanel'
import { fetchAnnualLeaves } from '@/services/admin/annualLeaveService'

export default function AdminMyLeavePage() {
  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false)
  const [leaveAccessStatus, setLeaveAccessStatus] = useState<'checking' | 'allowed' | 'forbidden'>('checking')

  useEffect(() => {
    const verifyLeaveAccess = async () => {
      try {
        await fetchAnnualLeaves({ offset: 0, limit: 1 })
        setLeaveAccessStatus('allowed')
      } catch (error) {
        const status = (error as any)?.response?.status
        setLeaveAccessStatus(status === 403 ? 'forbidden' : 'allowed')
      }
    }
    void verifyLeaveAccess()
  }, [])

  if (leaveAccessStatus === 'checking') {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
        권한 확인 중...
      </div>
    )
  }

  if (leaveAccessStatus === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-700">
        권한이 없습니다. 관리자에게 신청하세요.
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">내휴가관리</h1>
            <p className="mt-1 text-sm text-neutral-500">직원 본인 기준 휴가관리 화면입니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsRequestPanelOpen(true)}
            className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            휴가 신청
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <AnnualLeaveTable />
      </div>
      {isRequestPanelOpen ? (
        <AdminLeaveRequestPanel
          mode="panel"
          onClose={() => setIsRequestPanelOpen(false)}
        />
      ) : null}
    </section>
  )
}
