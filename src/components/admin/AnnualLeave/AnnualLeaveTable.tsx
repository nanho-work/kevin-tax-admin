'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchAnnualLeaves } from '@/services/admin/annualLeaveService'
import type { AnnualLeave } from '@/types/annualLeave'
import Pagination from '@/components/common/Pagination'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function getCurrentYear() {
  return new Date().getFullYear()
}

export default function AnnualLeaveTable() {
  const [leaves, setLeaves] = useState<AnnualLeave[]>([])
  const [total, setTotal] = useState(0)
  const [year, setYear] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 12

  const yearOptions = useMemo(() => {
    const currentYear = getCurrentYear()
    return Array.from({ length: 7 }, (_, idx) => currentYear - 3 + idx)
  }, [])

  const summary = useMemo(() => {
    return leaves.reduce(
      (acc, leave) => {
        acc.granted += Number(leave.granted_days || 0)
        acc.consumed += Number(leave.consumed_days || leave.used_days || 0)
        acc.remaining += Number(leave.remaining_days || 0)
        return acc
      },
      { granted: 0, consumed: 0, remaining: 0 }
    )
  }, [leaves])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const offset = (page - 1) * limit
        const res = await fetchAnnualLeaves({
          year: typeof year === 'number' ? year : undefined,
          offset,
          limit,
        })
        setLeaves(res.items || [])
        setTotal(res.total || 0)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [page, year])

  useEffect(() => {
    setPage(1)
  }, [year])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">총 부여 연차</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatNumber(summary.granted)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">총 사용 연차</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatNumber(summary.consumed)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">총 잔여 연차</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatNumber(summary.remaining)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            className={inputClass}
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">전체 연도</option>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}년
              </option>
            ))}
          </select>
          <div aria-hidden="true" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-center">연차 구분</th>
              <th className="px-3 py-3 text-center">적용기간</th>
              <th className="px-3 py-3 text-center">부여 연차</th>
              <th className="px-3 py-3 text-center">사용 연차</th>
              <th className="px-3 py-3 text-center">잔여 연차</th>
              <th className="px-3 py-3 text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
              </tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">연차 내역이 없습니다.</td>
              </tr>
            ) : (
              leaves.map((leave) => (
                <tr key={leave.id}>
                  <td className="px-3 py-3 text-center text-zinc-900">{leave.memo || '-'}</td>
                  <td className="px-3 py-3 text-center text-zinc-600">
                    {formatDate(leave.grant_date)} ~ {formatDate(leave.expired_at)}
                  </td>
                  <td className="px-3 py-3 text-center text-zinc-900">{formatNumber(leave.granted_days)}</td>
                  <td className="px-3 py-3 text-center text-zinc-900">{formatNumber(leave.consumed_days || leave.used_days)}</td>
                  <td className="px-3 py-3 text-center font-semibold text-zinc-900">{formatNumber(leave.remaining_days)}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={
                        leave.is_closed
                          ? 'inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700'
                          : 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
                      }
                    >
                      {leave.is_closed ? '사용 완료' : '사용 가능'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={limit} onPageChange={(newPage) => setPage(newPage)} />
    </div>
  )
}
