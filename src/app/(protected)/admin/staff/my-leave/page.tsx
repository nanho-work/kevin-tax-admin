'use client'

import { useState } from 'react'
import AnnualLeaveTable from '@/components/admin/AnnualLeave/AnnualLeaveTable'
import AdminLeaveRequestPanel from '@/components/admin/staff/AdminLeaveRequestPanel'

export default function AdminMyLeavePage() {
  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false)

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
