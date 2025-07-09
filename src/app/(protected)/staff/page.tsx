// app/(protected)/staff/page.tsx
import StaffTable from '@/components/staff/StaffTable'


export default function StaffPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">직원 관리</h1>
      <div className="space-y-6">

        <StaffTable />
      </div>
    </div>
  )
}