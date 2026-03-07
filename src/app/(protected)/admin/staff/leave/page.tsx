import AnnualLeaveTable from '@/components/admin/AnnualLeave/AnnualLeaveTable'

export default function AdminStaffLeavePage() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-neutral-900">휴가관리</h1>
        <p className="mt-1 text-sm text-neutral-500">직원 본인 기준 휴가관리 UI 연결을 위한 관리자 화면입니다.</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <AnnualLeaveTable />
      </div>
    </section>
  )
}
