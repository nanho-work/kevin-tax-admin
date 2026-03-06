'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  getClientBookkeepingErrorMessage,
  getDebitSummary,
  listDebitReceipts,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientDebitReceiptMonthlySummaryOut,
  ClientDebitReceiptOut,
} from '@/types/clientBookkeeping'
import type { CompanyTaxDetail } from '@/types/admin_campany'

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

export default function ClientBookkeepingDebitReceiptsSection() {
  const [rows, setRows] = useState<ClientDebitReceiptOut[]>([])
  const [summaryRows, setSummaryRows] = useState<ClientDebitReceiptMonthlySummaryOut[]>([])
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [tab, setTab] = useState<ReceiptTab>('all')
  const [targetMonthFrom, setTargetMonthFrom] = useState('')
  const [targetMonthTo, setTargetMonthTo] = useState('')
  const [companyId, setCompanyId] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  const [year, setYear] = useState(new Date().getFullYear())
  const [companyOptions, setCompanyOptions] = useState<CompanyTaxDetail[]>([])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, idx) => currentYear - 3 + idx)
  }, [])

  const loadCompanies = async () => {
    try {
      const limit = 100
      let pageCursor = 1
      let totalCount = 0
      const merged: CompanyTaxDetail[] = []
      do {
        const res = await fetchClientCompanyTaxList({ page: pageCursor, limit, keyword: '' })
        merged.push(...(res.items || []))
        totalCount = res.total || 0
        pageCursor += 1
      } while (merged.length < totalCount)

      const sorted = [...merged].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
      setCompanyOptions(sorted)
    } catch {
      setCompanyOptions([])
    }
  }

  const loadReceipts = async (nextPage = page) => {
    try {
      setLoading(true)
      const matchedOnly = tab === 'matched'
      const unmatchedOnly = tab === 'unmatched'
      const res = await listDebitReceipts({
        target_month_from: targetMonthFrom.trim() || undefined,
        target_month_to: targetMonthTo.trim() || undefined,
        company_id: typeof companyId === 'number' ? companyId : undefined,
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

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    setPage(1)
    loadReceipts(1)
  }, [tab])

  useEffect(() => {
    loadSummary(year)
  }, [year])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-zinc-900">수금 원장</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/client/bookkeeping/debits/batches"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              업로드 배치 보기
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            className={inputClass}
            placeholder="대상월 시작 (YYYY-MM)"
            value={targetMonthFrom}
            onChange={(e) => setTargetMonthFrom(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="대상월 종료 (YYYY-MM)"
            value={targetMonthTo}
            onChange={(e) => setTargetMonthTo(e.target.value)}
          />
          <select
            className={inputClass}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">전체 회사</option>
            {companyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => loadReceipts(1)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            조회
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-right">ID</th>
              <th className="px-3 py-3 text-center">대상월</th>
              <th className="px-3 py-3 text-left">회사명</th>
              <th className="px-3 py-3 text-left">입금자명</th>
              <th className="px-3 py-3 text-center">출금일</th>
              <th className="px-3 py-3 text-right">출금금액</th>
              <th className="px-3 py-3 text-left">출금상태</th>
              <th className="px-3 py-3 text-center">청구연결</th>
              <th className="px-3 py-3 text-center">배치</th>
              <th className="px-3 py-3 text-center">생성일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-zinc-500">
                  수금 원장 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-right">{row.id}</td>
                  <td className="px-3 py-3 text-center">{row.target_month || '-'}</td>
                  <td className="px-3 py-3 text-left">{row.company_name || '-'}</td>
                  <td className="px-3 py-3 text-left">{row.member_name || '-'}</td>
                  <td className="px-3 py-3 text-center">{formatDate(row.withdraw_date)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.withdraw_amount)}</td>
                  <td className="px-3 py-3 text-left">{row.withdraw_status || '-'}</td>
                  <td className="px-3 py-3 text-center">{row.billing_id ? '매칭완료' : '미매칭'}</td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/client/bookkeeping/debits/batches/${row.batch_id}`}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      {row.batch_id}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => loadReceipts(page - 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          이전
        </button>
        <span className="text-sm text-zinc-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => loadReceipts(page + 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          다음
        </button>
      </div>

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
