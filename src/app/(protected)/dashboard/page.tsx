

import DashboardCalendar from '@/components/Dashboard/DashboardCalendar'


export default function DashboardPage() {
  return (
    <main className="bg-white p-4">
      <h1 className="text-xl font-bold mb-4">관리자 대시보드</h1>
      <DashboardCalendar />
    </main>
  )
}