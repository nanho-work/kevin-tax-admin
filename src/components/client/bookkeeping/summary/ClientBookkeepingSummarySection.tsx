'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  getBookkeepingSummary,
  getClientBookkeepingErrorMessage,
  listContracts,
} from '@/services/client/clientBookkeepingService'
import type { ClientBookkeepingMonthlySummaryOut } from '@/types/clientBookkeeping'

function formatNumber(value?: number) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

export default function ClientBookkeepingSummarySection() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [startYear, setStartYear] = useState<number>(currentYear - 3)
  const [rows, setRows] = useState<ClientBookkeepingMonthlySummaryOut[]>([])
  const [loading, setLoading] = useState(false)

  const yearOptions = useMemo(() => {
    const from = Math.min(startYear, currentYear)
    const to = Math.max(startYear, currentYear)
    return Array.from({ length: to - from + 1 }, (_, idx) => from + idx)
  }, [currentYear, startYear])

  const loadYearRange = async () => {
    try {
      const res = await listContracts({})
      const years = (res.items || [])
        .map((item) => {
          const source = item.start_date || item.start_month
          if (!source) return null
          const match = String(source).match(/^(\d{4})/)
          return match ? Number(match[1]) : null
        })
        .filter((v): v is number => Number.isFinite(v))

      if (years.length === 0) {
        setStartYear(currentYear - 1)
        return
      }

      const minYear = Math.min(...years)
      setStartYear(minYear - 1)
    } catch {
      // Fallback to a safe recent range if contract years cannot be loaded.
      setStartYear(currentYear - 3)
    }
  }

  const loadSummary = async (targetYear: number) => {
    try {
      setLoading(true)
      const res = await getBookkeepingSummary(targetYear)
      setRows(res.items || [])
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadYearRange()
  }, [])

  useEffect(() => {
    loadSummary(year)
  }, [year])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-zinc-900">월별 집계</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-600">연도</label>
            <select
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[880px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">월</th>
              <th className="px-3 py-3 text-right">공급가 합계</th>
              <th className="px-3 py-3 text-right">VAT 합계</th>
              <th className="px-3 py-3 text-right">총액 합계</th>
              <th className="px-3 py-3 text-right">미수 합계</th>
              <th className="px-3 py-3 text-center">이동</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                  집계 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.target_month}>
                  <td className="px-3 py-3 text-center">{row.target_month}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.supply_amount_sum)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.vat_amount_sum)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.total_amount_sum)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.receivable_amount_sum)}</td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/client/bookkeeping/billings?target_month_from=${row.target_month}&target_month_to=${row.target_month}`}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      해당 월 보기
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
