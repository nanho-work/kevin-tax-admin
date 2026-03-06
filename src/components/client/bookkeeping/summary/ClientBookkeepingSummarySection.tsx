'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  getBookkeepingSummary,
  getBookkeepingSummaryYears,
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
  const [yearTotals, setYearTotals] = useState<Record<number, number>>({})
  const [yearBarStartIndex, setYearBarStartIndex] = useState(0)
  const [loadingYearTotals, setLoadingYearTotals] = useState(false)
  const YEARS_VISIBLE = 5

  const yearOptions = useMemo(() => {
    const from = Math.min(startYear, currentYear)
    const to = Math.max(startYear, currentYear)
    return Array.from({ length: to - from + 1 }, (_, idx) => from + idx)
  }, [currentYear, startYear])

  const maxYearBarStartIndex = useMemo(
    () => Math.max(0, yearOptions.length - YEARS_VISIBLE),
    [yearOptions.length]
  )

  const visibleYearOptions = useMemo(() => {
    return yearOptions.slice(yearBarStartIndex, yearBarStartIndex + YEARS_VISIBLE)
  }, [yearOptions, yearBarStartIndex])

  const selectedYearTotals = useMemo(() => {
    return (rows || []).reduce(
      (acc, item) => {
        acc.supply += item.supply_amount_sum || 0
        acc.vat += item.vat_amount_sum || 0
        acc.total += item.total_amount_sum || 0
        acc.receivable += item.receivable_amount_sum || 0
        return acc
      },
      { supply: 0, vat: 0, total: 0, receivable: 0 }
    )
  }, [rows])

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

  useEffect(() => {
    if (yearOptions.length === 0) return
    setYearBarStartIndex((prev) => {
      if (prev > maxYearBarStartIndex) return maxYearBarStartIndex
      return prev
    })
  }, [yearOptions.length, maxYearBarStartIndex])

  useEffect(() => {
    const index = yearOptions.indexOf(year)
    if (index < 0) return
    if (index < yearBarStartIndex) {
      setYearBarStartIndex(index)
      return
    }
    if (index >= yearBarStartIndex + YEARS_VISIBLE) {
      setYearBarStartIndex(index - YEARS_VISIBLE + 1)
    }
  }, [year, yearOptions, yearBarStartIndex])

  useEffect(() => {
    if (yearOptions.length === 0) return

    const loadYearTotals = async () => {
      try {
        setLoadingYearTotals(true)
        const fromYear = Math.min(...yearOptions)
        const toYear = Math.max(...yearOptions)
        const res = await getBookkeepingSummaryYears(fromYear, toYear)
        const totals = (res.items || []).reduce<Record<number, number>>((acc, item) => {
          acc[item.year] = item.total_amount_sum || 0
          return acc
        }, {})
        setYearTotals(totals)
      } catch {
        setYearTotals({})
      } finally {
        setLoadingYearTotals(false)
      }
    }

    loadYearTotals()
  }, [yearOptions])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">연도별 합계 (총액)</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={yearBarStartIndex <= 0}
              onClick={() => setYearBarStartIndex((prev) => Math.max(0, prev - 1))}
              className="h-8 w-8 rounded border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={yearBarStartIndex >= maxYearBarStartIndex}
              onClick={() => setYearBarStartIndex((prev) => Math.min(maxYearBarStartIndex, prev + 1))}
              className="h-8 w-8 rounded border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex items-stretch justify-start gap-2">
          {visibleYearOptions.map((y) => {
            const active = y === year
            return (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`w-full max-w-[150px] rounded-md border px-2 py-1.5 text-left transition ${
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <p className={`text-xs ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>{y}년</p>
                <p className="mt-0.5 text-xs font-semibold">
                  {loadingYearTotals ? '계산 중...' : formatNumber(yearTotals[y] ?? 0)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[880px] w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
          </colgroup>
          <tbody>
            <tr>
              <td className="px-3 py-3 text-center font-semibold text-zinc-800">{year}년</td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-800">{formatNumber(selectedYearTotals.supply)}</td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-800">{formatNumber(selectedYearTotals.vat)}</td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-800">{formatNumber(selectedYearTotals.total)}</td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-800">
                {formatNumber(selectedYearTotals.receivable)}
              </td>
              <td className="px-3 py-3" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[880px] w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
          </colgroup>
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
