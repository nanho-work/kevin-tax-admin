'use client'

import { useEffect, useState } from 'react'
import { fetchTaxSchedules } from '@/services/taxSchedulService'
import { TaxSchedule } from '@/types/taxSchedule'
import Pagination from '@/components/common/Pagination'

export default function TaxScheduleTable() {
  const [schedules, setSchedules] = useState<TaxSchedule[]>([])

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        const data = await fetchTaxSchedules()
        setSchedules(data)
      } catch (error) {
        console.error('스케줄 불러오기 실패:', error)
      }
    }
    loadSchedules()
  }, [])

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">세무 일정 목록</h2>
      <table className="min-w-full text-center border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">회사명</th>
            <th className="border px-4 py-2">일정 종류</th>
            <th className="border px-4 py-2">마감일자</th>
            <th className="border px-4 py-2">상태</th>
            <th className="border px-4 py-2">메모</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((item) => (
            <tr key={item.id}>
              <td className="border px-4 py-2">{item.company_name}</td>
              <td className="border px-4 py-2">{item.schedule_type}</td>
              <td className="border px-4 py-2">{item.due_date}</td>
              <td className="border px-4 py-2">{item.status}</td>
              <td className="border px-4 py-2">{item.memo || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}