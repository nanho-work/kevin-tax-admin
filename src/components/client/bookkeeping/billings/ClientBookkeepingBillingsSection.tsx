'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  createBilling,
  deleteBilling,
  getClientBookkeepingErrorMessage,
  listBillings,
  syncBillingReceipts,
  updateBilling,
  updateBillingStatus,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientBookkeepingBillingCreateRequest,
  ClientBookkeepingBillingOut,
  ClientBookkeepingBillingStatus,
} from '@/types/clientBookkeeping'
import type { CompanyTaxDetail } from '@/types/admin_campany'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

const BILLING_STATUSES: ClientBookkeepingBillingStatus[] = [
  'planned',
  'invoiced',
  'paid',
  'partial',
  'unpaid',
  'canceled',
]

const generatedByLabel: Record<'manual' | 'contract_auto', string> = {
  manual: '수동',
  contract_auto: '계약자동',
}

const statusLabel: Record<ClientBookkeepingBillingStatus, string> = {
  planned: '예정',
  invoiced: '계산서발행',
  paid: '완납',
  partial: '부분수납',
  unpaid: '미수',
  canceled: '취소',
}

type BillingModalState = {
  open: boolean
  mode: 'create' | 'edit'
  target?: ClientBookkeepingBillingOut
}

type BillingViewMode = 'month' | 'unpaid_all'

type BillingFormState = {
  company_id: number
  company_text: string
  target_month: string
  supply_amount: string
  vat_amount: string
  total_amount: string
  invoice_issued_at: string
  cash_received_at: string
  adjustment_amount: string
  receivable_amount: string
  status: ClientBookkeepingBillingStatus
  memo: string
}

function defaultFormState(): BillingFormState {
  return {
    company_id: 0,
    company_text: '',
    target_month: '',
    supply_amount: '',
    vat_amount: '',
    total_amount: '',
    invoice_issued_at: '',
    cash_received_at: '',
    adjustment_amount: '',
    receivable_amount: '',
    status: 'planned',
    memo: '',
  }
}

function mapBillingToForm(target: ClientBookkeepingBillingOut): BillingFormState {
  return {
    company_id: target.company_id,
    company_text: target.company_name || '',
    target_month: target.target_month || '',
    supply_amount: String(target.supply_amount ?? 0),
    vat_amount: String(target.vat_amount ?? 0),
    total_amount: String(target.total_amount ?? 0),
    invoice_issued_at: target.invoice_issued_at || '',
    cash_received_at: target.cash_received_at || '',
    adjustment_amount: String(target.adjustment_amount ?? 0),
    receivable_amount: String(target.receivable_amount ?? 0),
    status: target.status,
    memo: target.memo || '',
  }
}

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(num)) return undefined
  return num
}

function normalizeMonth(value: string): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (/^\d{4}-\d{2}$/.test(v)) return v
  return undefined
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function getCurrentYearMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function shiftYearMonth(value: string, diff: number) {
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return value
  const next = new Date(y, m - 1 + diff, 1)
  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatYearMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  const [year, month] = value.split('-')
  return `${year}. ${month}.`
}

export default function ClientBookkeepingBillingsSection() {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<ClientBookkeepingBillingOut[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusWorkingId, setStatusWorkingId] = useState<number | null>(null)
  const [deleteWorkingId, setDeleteWorkingId] = useState<number | null>(null)
  const [syncWorkingId, setSyncWorkingId] = useState<number | null>(null)
  const [invoiceEditingId, setInvoiceEditingId] = useState<number | null>(null)
  const [invoiceDraft, setInvoiceDraft] = useState('')
  const [invoiceSavingId, setInvoiceSavingId] = useState<number | null>(null)

  const [targetMonthFrom, setTargetMonthFrom] = useState('')
  const [targetMonthTo, setTargetMonthTo] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth())
  const [viewMode, setViewMode] = useState<BillingViewMode>('month')
  const [companyId, setCompanyId] = useState<number | ''>('')
  const [status, setStatus] = useState<ClientBookkeepingBillingStatus | ''>('')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [total, setTotal] = useState(0)

  const [companyOptions, setCompanyOptions] = useState<CompanyTaxDetail[]>([])
  const [modal, setModal] = useState<BillingModalState>({ open: false, mode: 'create' })
  const [form, setForm] = useState<BillingFormState>(defaultFormState())

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  type BillingFiltersSnapshot = {
    targetMonthFrom: string
    targetMonthTo: string
    companyId: number | ''
    status: ClientBookkeepingBillingStatus | ''
    unpaidOnly: boolean
  }

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

  const loadBillings = async (
    nextPage = page,
    overrides?: Partial<BillingFiltersSnapshot>
  ) => {
    const activeFilters: BillingFiltersSnapshot = {
      targetMonthFrom: overrides?.targetMonthFrom ?? targetMonthFrom,
      targetMonthTo: overrides?.targetMonthTo ?? targetMonthTo,
      companyId: overrides?.companyId ?? companyId,
      status: overrides?.status ?? status,
      unpaidOnly: overrides?.unpaidOnly ?? unpaidOnly,
    }
    try {
      setLoading(true)
      const fromMonth = normalizeMonth(activeFilters.targetMonthFrom)
      const toMonth = normalizeMonth(activeFilters.targetMonthTo)
      const res = await listBillings({
        target_month_from: fromMonth,
        target_month_to: toMonth,
        company_id: typeof activeFilters.companyId === 'number' ? activeFilters.companyId : undefined,
        status: activeFilters.status || undefined,
        unpaid_only: activeFilters.unpaidOnly,
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

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    const monthFrom = searchParams.get('target_month_from') || ''
    const monthTo = searchParams.get('target_month_to') || ''
    const nextCompanyId = searchParams.get('company_id')
    const nextStatus = searchParams.get('status')
    const nextUnpaidOnly = searchParams.get('unpaid_only')

    const parsedCompanyId = nextCompanyId ? Number(nextCompanyId) : ''
    const parsedStatus = nextStatus ? (nextStatus as ClientBookkeepingBillingStatus) : ''
    const parsedUnpaidOnly = nextUnpaidOnly === 'true'

    const defaultMonth = getCurrentYearMonth()
    const nextMonthFrom = monthFrom || defaultMonth
    const nextMonthTo = monthTo || defaultMonth
    const nextViewMode: BillingViewMode = parsedUnpaidOnly && !monthFrom && !monthTo ? 'unpaid_all' : 'month'

    setViewMode(nextViewMode)
    setSelectedMonth(monthFrom && monthFrom === monthTo ? monthFrom : defaultMonth)
    setTargetMonthFrom(nextViewMode === 'month' ? nextMonthFrom : '')
    setTargetMonthTo(nextViewMode === 'month' ? nextMonthTo : '')
    setCompanyId(parsedCompanyId)
    setStatus(parsedStatus)
    setUnpaidOnly(nextViewMode === 'unpaid_all')

    loadBillings(1, {
      targetMonthFrom: nextViewMode === 'month' ? nextMonthFrom : '',
      targetMonthTo: nextViewMode === 'month' ? nextMonthTo : '',
      companyId: parsedCompanyId,
      status: parsedStatus,
      unpaidOnly: nextViewMode === 'unpaid_all',
    })
  }, [searchParams])

  const openCreate = () => {
    setModal({ open: true, mode: 'create' })
    setForm(defaultFormState())
  }

  const openEdit = (target: ClientBookkeepingBillingOut) => {
    setModal({ open: true, mode: 'edit', target })
    setForm(mapBillingToForm(target))
  }

  const closeModal = () => {
    if (saving) return
    setModal({ open: false, mode: 'create' })
    setForm(defaultFormState())
  }

  const handleSave = async () => {
    const targetMonth = normalizeMonth(form.target_month)
    if (!form.company_id) {
      toast.error('회사를 선택해 주세요.')
      return
    }
    if (!targetMonth) {
      toast.error('대상월은 YYYY-MM 형식으로 입력해 주세요.')
      return
    }

    const payload: ClientBookkeepingBillingCreateRequest = {
      company_id: form.company_id,
      target_month: targetMonth,
      supply_amount: toOptionalNumber(form.supply_amount) ?? 0,
      vat_amount: toOptionalNumber(form.vat_amount) ?? 0,
      total_amount: toOptionalNumber(form.total_amount) ?? 0,
      invoice_issued_at: form.invoice_issued_at.trim() || undefined,
      cash_received_at: form.cash_received_at.trim() || undefined,
      adjustment_amount: toOptionalNumber(form.adjustment_amount) ?? 0,
      receivable_amount: toOptionalNumber(form.receivable_amount) ?? 0,
      status: form.status,
      memo: form.memo.trim() || undefined,
    }

    try {
      setSaving(true)
      if (modal.mode === 'create') {
        await createBilling(payload)
        toast.success('월 청구가 생성되었습니다.')
        toast.success('자동 매칭 반영됨')
      } else if (modal.target) {
        await updateBilling(modal.target.id, payload)
        toast.success('월 청구가 수정되었습니다.')
      }
      closeModal()
      await loadBillings(1)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (row: ClientBookkeepingBillingOut, next: ClientBookkeepingBillingStatus) => {
    if (row.status === next) return
    try {
      setStatusWorkingId(row.id)
      await updateBillingStatus(row.id, { status: next })
      toast.success('상태가 변경되었습니다.')
      await loadBillings(page)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setStatusWorkingId(null)
    }
  }

  const handleDelete = async (row: ClientBookkeepingBillingOut) => {
    if (!confirm(`${row.company_name || '해당 회사'}의 ${row.target_month} 청구 내역을 삭제하시겠습니까?`)) return
    try {
      setDeleteWorkingId(row.id)
      const result = await deleteBilling(row.id)
      toast.success(result.message || '월별 청구 내역이 삭제되었습니다.')
      setRows((prev) => prev.filter((item) => item.id !== row.id))
      setTotal((prev) => Math.max(0, prev - 1))
      const nextTotal = Math.max(0, total - 1)
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / size))
      const nextPage = Math.min(page, nextTotalPages)
      await loadBillings(nextPage)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setDeleteWorkingId(null)
    }
  }

  const applyMonthView = async (month: string) => {
    setViewMode('month')
    setSelectedMonth(month)
    setTargetMonthFrom(month)
    setTargetMonthTo(month)
    setUnpaidOnly(false)
    await loadBillings(1, {
      targetMonthFrom: month,
      targetMonthTo: month,
      unpaidOnly: false,
    })
  }

  const applyUnpaidAllView = async () => {
    setViewMode('unpaid_all')
    setTargetMonthFrom('')
    setTargetMonthTo('')
    setUnpaidOnly(true)
    await loadBillings(1, {
      targetMonthFrom: '',
      targetMonthTo: '',
      unpaidOnly: true,
    })
  }

  const handleSyncReceipts = async (row: ClientBookkeepingBillingOut) => {
    try {
      setSyncWorkingId(row.id)
      const result = await syncBillingReceipts(row.id)
      toast.success(`${result.message} (연결 ${result.attached_count}건)`)
      await loadBillings(page)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setSyncWorkingId(null)
    }
  }

  const startInvoiceEdit = (row: ClientBookkeepingBillingOut) => {
    setInvoiceEditingId(row.id)
    setInvoiceDraft(row.invoice_issued_at || '')
  }

  const cancelInvoiceEdit = () => {
    if (invoiceSavingId != null) return
    setInvoiceEditingId(null)
    setInvoiceDraft('')
  }

  const saveInvoiceIssuedAt = async (row: ClientBookkeepingBillingOut) => {
    try {
      setInvoiceSavingId(row.id)
      await updateBilling(row.id, {
        invoice_issued_at: invoiceDraft.trim() || null,
      })
      toast.success('계산서 발행일이 저장되었습니다.')
      setInvoiceEditingId(null)
      setInvoiceDraft('')
      await loadBillings(page)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setInvoiceSavingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void applyMonthView(shiftYearMonth(selectedMonth, -1))}
              disabled={viewMode !== 'month'}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              ◀
            </button>
            <button
              type="button"
              disabled={viewMode !== 'month'}
              onClick={() => {
                const el = document.getElementById('billing-month-picker') as HTMLInputElement | null
                el?.showPicker?.()
                el?.focus()
              }}
              className="h-10 min-w-[130px] rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              {formatYearMonthLabel(selectedMonth)}
            </button>
            <button
              type="button"
              onClick={() => void applyMonthView(shiftYearMonth(selectedMonth, 1))}
              disabled={viewMode !== 'month'}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              ▶
            </button>
            <input
              id="billing-month-picker"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                const next = e.target.value
                if (!next) return
                void applyMonthView(next)
              }}
              className="sr-only"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void applyMonthView(selectedMonth)}
              className={`rounded-md px-3 py-2 text-sm ${
                viewMode === 'month' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
              }`}
            >
              월별보기
            </button>
            <button
              type="button"
              onClick={() => void applyUnpaidAllView()}
              className={`rounded-md px-3 py-2 text-sm ${
                viewMode === 'unpaid_all'
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-300 bg-white text-zinc-700'
              }`}
            >
              미수금 전체보기
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              월 청구 생성
            </button>
            <button
              type="button"
              disabled
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-400"
              title="엑셀 다운로드는 다음 단계에서 연결합니다."
            >
              엑셀 다운로드
            </button>
          </div>
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
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus((e.target.value as ClientBookkeepingBillingStatus) || '')}
          >
            <option value="">전체 상태</option>
            {BILLING_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusLabel[item]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              loadBillings(1, {
                targetMonthFrom: viewMode === 'month' ? selectedMonth : '',
                targetMonthTo: viewMode === 'month' ? selectedMonth : '',
                unpaidOnly: viewMode === 'unpaid_all',
              })
            }
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            조회
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1500px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">대상월</th>
              <th className="px-3 py-3 text-center">회사명</th>
              <th className="px-3 py-3 text-center">공급가</th>
              <th className="px-3 py-3 text-center">VAT</th>
              <th className="px-3 py-3 text-center">총액</th>
              <th className="px-3 py-3 text-center">계산서 발행일(TI)</th>
              <th className="px-3 py-3 text-center">현금수취일</th>
              <th className="px-3 py-3 text-center">조정금액</th>
              <th className="px-3 py-3 text-center">미수금액</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">생성구분</th>
              <th className="px-3 py-3 text-center">월 메모</th>
              <th className="px-3 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-zinc-500">
                  월 청구 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-center">{row.target_month}</td>
                  <td className="px-3 py-3 text-center">{row.company_name || '-'}</td>
                  <td className="px-3 py-3 text-center">{formatNumber(row.supply_amount)}</td>
                  <td className="px-3 py-3 text-center">{formatNumber(row.vat_amount)}</td>
                  <td className="px-3 py-3 text-center">{formatNumber(row.total_amount)}</td>
                  <td className="px-3 py-3 text-center">
                    {invoiceEditingId === row.id ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="date"
                          value={invoiceDraft}
                          onChange={(e) => setInvoiceDraft(e.target.value)}
                          className="h-8 rounded border border-zinc-300 px-2 text-xs"
                        />
                        <button
                          type="button"
                          disabled={invoiceSavingId === row.id}
                          onClick={() => void saveInvoiceIssuedAt(row)}
                          className="rounded border border-blue-300 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          disabled={invoiceSavingId === row.id}
                          onClick={cancelInvoiceEdit}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <span>{row.invoice_issued_at || '-'}</span>
                        <button
                          type="button"
                          onClick={() => startInvoiceEdit(row)}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                        >
                          {row.invoice_issued_at ? '수정' : '등록'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">{row.cash_received_at || '-'}</td>
                  <td className="px-3 py-3 text-center">{formatNumber(row.adjustment_amount)}</td>
                  <td className="px-3 py-3 text-center">{formatNumber(row.receivable_amount)}</td>
                  <td className="px-3 py-3 text-center">
                    <select
                      className="h-8 rounded border border-zinc-300 px-2 text-xs"
                      value={row.status}
                      disabled={statusWorkingId === row.id}
                      onChange={(e) => handleStatusChange(row, e.target.value as ClientBookkeepingBillingStatus)}
                    >
                      {BILLING_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {statusLabel[item]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center">{generatedByLabel[row.generated_by] ?? row.generated_by}</td>
                  <td className="px-3 py-3 text-center">
                    {row.memo ? <span className="block max-w-[240px] truncate" title={row.memo}>{row.memo}</span> : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={syncWorkingId === row.id}
                        onClick={() => handleSyncReceipts(row)}
                        className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                      >
                        {syncWorkingId === row.id ? '동기화 중...' : '수금 재동기화'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={deleteWorkingId === row.id}
                        onClick={() => handleDelete(row)}
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        {deleteWorkingId === row.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </td>
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
          onClick={() => loadBillings(page - 1)}
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
          onClick={() => loadBillings(page + 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          다음
        </button>
      </div>

      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.mode === 'create' ? '월 청구 생성' : '월 청구 수정'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                className={inputClass}
                value={form.company_id}
                onChange={(e) => {
                  const selected = Number(e.target.value)
                  const company = companyOptions.find((item) => item.id === selected)
                  setForm((prev) => ({
                    ...prev,
                    company_id: selected,
                    company_text: company?.company_name || '',
                  }))
                }}
              >
                <option value={0}>회사 선택</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                placeholder="대상월 (YYYY-MM)"
                value={form.target_month}
                onChange={(e) => setForm((prev) => ({ ...prev, target_month: e.target.value }))}
              />
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="공급가"
                value={form.supply_amount}
                onChange={(e) => setForm((prev) => ({ ...prev, supply_amount: e.target.value.replace(/[^\d-]/g, '') }))}
              />
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="VAT"
                value={form.vat_amount}
                onChange={(e) => setForm((prev) => ({ ...prev, vat_amount: e.target.value.replace(/[^\d-]/g, '') }))}
              />
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="총액"
                value={form.total_amount}
                onChange={(e) => setForm((prev) => ({ ...prev, total_amount: e.target.value.replace(/[^\d-]/g, '') }))}
              />
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ClientBookkeepingBillingStatus }))}
              >
                {BILLING_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {statusLabel[item]}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                type="date"
                value={form.invoice_issued_at}
                onChange={(e) => setForm((prev) => ({ ...prev, invoice_issued_at: e.target.value }))}
              />
              <input
                className={inputClass}
                type="date"
                value={form.cash_received_at}
                onChange={(e) => setForm((prev) => ({ ...prev, cash_received_at: e.target.value }))}
              />
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="조정금액"
                value={form.adjustment_amount}
                onChange={(e) => setForm((prev) => ({ ...prev, adjustment_amount: e.target.value.replace(/[^\d-]/g, '') }))}
              />
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="미수금액"
                value={form.receivable_amount}
                onChange={(e) => setForm((prev) => ({ ...prev, receivable_amount: e.target.value.replace(/[^\d-]/g, '') }))}
              />
              <textarea
                className="md:col-span-2 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="월 메모"
                value={form.memo}
                onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
