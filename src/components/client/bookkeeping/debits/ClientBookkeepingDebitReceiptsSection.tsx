'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import {
  getClientBookkeepingErrorMessage,
  getDebitSummary,
  listBookkeepingDebitBatches,
  listDebitReceipts,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientDebitReceiptMonthlySummaryOut,
  ClientDebitReceiptOut,
  ClientDebitUploadBatchOut,
} from '@/types/clientBookkeeping'

type ReceiptTab = 'all' | 'matched' | 'unmatched'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const normalized = String(value).trim()
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`
  }
  return normalized
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function getCurrentYearMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function shiftYearMonth(value: string, diff: number) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  const next = new Date(year, month - 1 + diff, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function formatAppliedMonth(value?: string | null) {
  if (!value) return '-'
  const normalized = String(value).trim()
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    const [year, month] = normalized.split('-')
    return `${year}.${month}`
  }
  return normalized
}

export default function ClientBookkeepingDebitReceiptsSection() {
  const [rows, setRows] = useState<ClientDebitReceiptOut[]>([])
  const [summaryRows, setSummaryRows] = useState<ClientDebitReceiptMonthlySummaryOut[]>([])
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [batchMap, setBatchMap] = useState<Record<number, ClientDebitUploadBatchOut>>({})

  const [tab, setTab] = useState<ReceiptTab>('all')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth())
  const [companyQuery, setCompanyQuery] = useState('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [total, setTotal] = useState(0)

  const [year, setYear] = useState(new Date().getFullYear())

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, idx) => currentYear - 3 + idx)
  }, [])

  const filteredRows = useMemo(() => {
    const keyword = companyQuery.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => {
      const companyName = (row.company_name || '').toLowerCase()
      const memberName = (row.member_name || '').toLowerCase()
      return companyName.includes(keyword) || memberName.includes(keyword)
    })
  }, [rows, companyQuery])

  const loadReceipts = async (nextPage = page) => {
    try {
      setLoading(true)
      const matchedOnly = tab === 'matched'
      const unmatchedOnly = tab === 'unmatched'
      const res = await listDebitReceipts({
        target_month_from: selectedMonth || undefined,
        target_month_to: selectedMonth || undefined,
        matched_only: matchedOnly || undefined,
        unmatched_only: unmatchedOnly || undefined,
        page: nextPage,
        size,
      })
      setRows(res.items || [])
      setTotal(res.total || 0)
      setPage(nextPage)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async (targetYear = year) => {
    try {
      setSummaryLoading(true)
      const res = await getDebitSummary(targetYear)
      setSummaryRows(res.items || [])
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
      setSummaryRows([])
    } finally {
      setSummaryLoading(false)
    }
  }

  const loadBatchMap = async () => {
    try {
      const pageSize = 100
      let currentPage = 1
      let totalCount = 0
      const merged: ClientDebitUploadBatchOut[] = []

      do {
        const res = await listBookkeepingDebitBatches({ page: currentPage, size: pageSize })
        merged.push(...(res.items || []))
        totalCount = res.total || 0
        currentPage += 1
      } while (merged.length < totalCount)

      setBatchMap(
        merged.reduce<Record<number, ClientDebitUploadBatchOut>>((acc, batch) => {
          acc[batch.id] = batch
          return acc
        }, {})
      )
    } catch {
      setBatchMap({})
    }
  }

  useEffect(() => {
    setPage(1)
    loadReceipts(1)
  }, [tab, selectedMonth])

  useEffect(() => {
    loadSummary(year)
  }, [year])

  useEffect(() => {
    loadBatchMap()
  }, [])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-900">입금내역</h1>
            <p className="mt-1 text-sm text-zinc-500">클라이언트 입금 내역과 청구서 연결 상태를 확인합니다.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/client/bookkeeping/debits/upload"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              자동이체 업로드
            </Link>
            <Link
              href="/client/bookkeeping/debits/history"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              업로드 이력
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_320px_minmax(0,1fr)_auto]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => shiftYearMonth(prev, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="이전 월"
            >
              ‹
            </button>
            <input
              type="month"
              className={`${inputClass} text-center`}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || getCurrentYearMonth())}
              aria-label="조회 월"
            />
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => shiftYearMonth(prev, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              aria-label="다음 월"
            >
              ›
            </button>
          </div>
          <div>
            <input
              className={inputClass}
              placeholder="회사명 또는 입금자명"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
          </div>
          <div aria-hidden="true" />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-md px-3 py-2 text-sm ${
                tab === 'all' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setTab('matched')}
              className={`rounded-md px-3 py-2 text-sm ${
                tab === 'matched' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
              }`}
            >
              매칭완료
            </button>
            <button
              type="button"
              onClick={() => setTab('unmatched')}
              className={`rounded-md px-3 py-2 text-sm ${
                tab === 'unmatched' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
              }`}
            >
              미매칭
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">대상월</th>
              <th className="px-3 py-3 text-left">회사명</th>
              <th className="px-3 py-3 text-left">입금자명</th>
              <th className="px-3 py-3 text-center">입금일</th>
              <th className="px-3 py-3 text-right">입금금액</th>
              <th className="px-3 py-3 text-center">청구서 연결</th>
              <th className="px-3 py-3 text-center">업로드 이력</th>
              <th className="px-3 py-3 text-center">생성일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                  입금 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-center">{row.target_month || '-'}</td>
                  <td className="px-3 py-3 text-left">{row.company_name || '-'}</td>
                  <td className="px-3 py-3 text-left">{row.member_name || '-'}</td>
                  <td className="px-3 py-3 text-center">{formatDate(row.withdraw_date)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.withdraw_amount)}</td>
                  <td className="px-3 py-3 text-center">
                    {row.billing_id ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        연결완료
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-pink-200 bg-pink-50 px-2 py-1 text-xs font-medium text-pink-700">
                        미연결
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/client/bookkeeping/debits/history/${row.batch_id}`}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      {formatAppliedMonth(batchMap[row.batch_id]?.source_name)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={size} onPageChange={(nextPage) => loadReceipts(nextPage)} />

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">수금 월별 집계</h2>
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

        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-3 text-center">월</th>
                <th className="px-3 py-3 text-right">수금 합계</th>
                <th className="px-3 py-3 text-right">매칭 합계</th>
                <th className="px-3 py-3 text-right">미매칭 합계</th>
                <th className="px-3 py-3 text-right">매칭 건수</th>
                <th className="px-3 py-3 text-right">미매칭 건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {summaryLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                    조회 중...
                  </td>
                </tr>
              ) : summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                    집계 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                summaryRows.map((row) => (
                  <tr key={row.target_month}>
                    <td className="px-3 py-3 text-center">{row.target_month}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.received_amount_sum)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.matched_amount_sum)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.unmatched_amount_sum)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.matched_count)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.unmatched_count)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
