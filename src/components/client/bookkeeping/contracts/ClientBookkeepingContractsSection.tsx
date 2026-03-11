'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  applyContractBulkUpload,
  createContract,
  generateContractBillings,
  getClientBookkeepingErrorMessage,
  listContracts,
  patchContractActive,
  previewContractBulkUpload,
  updateContract,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientBookkeepingContractBulkApplyResponse,
  ClientBookkeepingContractBulkPreviewResponse,
  ClientBookkeepingContractCreateRequest,
  ClientBookkeepingContractOut,
  ClientBookkeepingGenerateBillingsResponse,
} from '@/types/clientBookkeeping'
import type { CompanyTaxDetail } from '@/types/admin_campany'
import TemplateDownloadButton from '@/components/client/templates/TemplateDownloadButton'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const ALLOWED_EXCEL_EXTENSIONS = ['.xls', '.xlsx', '.xlsm', '.xltx', '.xltm']

type ContractModalState = {
  open: boolean
  mode: 'create' | 'edit'
  target?: ClientBookkeepingContractOut
}

type ContractFormState = {
  company_id: number
  company_text: string
  indefinite: boolean
  start_date: string
  end_date: string
  start_month: string
  end_month: string
  monthly_fee_supply: string
  vat_included: boolean
  change_reason: string
  memo: string
  is_active: boolean
}

function normalizeMonth(value: string): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (/^\d{4}-\d{2}$/.test(v)) return v
  return undefined
}

function formatFlexibleDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

function parseFlexibleDateToIso(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) return trimmed.replace(/\./g, '-')
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`
  if (/^\d{4}\.\d{2}$/.test(trimmed)) return `${trimmed.replace('.', '-')}-01`
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  if (digits.length === 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
  return undefined
}

function toFullDateForSave(value: string): string | undefined {
  return parseFlexibleDateToIso(value)
}

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function formatContractPeriod(row: ClientBookkeepingContractOut) {
  if (row.start_date || row.end_date) {
    return `${row.start_date || '-'} ~ ${row.end_date || '진행중'}`
  }
  if (row.start_month || row.end_month) {
    return `${row.start_month || '-'} ~ ${row.end_month || '진행중'}`
  }
  return '-'
}

function defaultFormState(): ContractFormState {
  return {
    company_id: 0,
    company_text: '',
    indefinite: true,
    start_date: '',
    end_date: '',
    start_month: '',
    end_month: '',
    monthly_fee_supply: '',
    vat_included: false,
    change_reason: '',
    memo: '',
    is_active: true,
  }
}

function mapContractToForm(target: ClientBookkeepingContractOut): ContractFormState {
  const derivedStartMonth = target.start_month || (target.start_date ? target.start_date.slice(0, 7) : '')
  const derivedEndMonth = target.end_month || (target.end_date ? target.end_date.slice(0, 7) : '')
  return {
    company_id: target.company_id,
    company_text: target.company_name || '',
    indefinite: !target.end_date && !target.end_month,
    start_date: target.start_date ? target.start_date.replace(/-/g, '.') : '',
    end_date: target.end_date ? target.end_date.replace(/-/g, '.') : '',
    start_month: derivedStartMonth,
    end_month: derivedEndMonth,
    monthly_fee_supply: target.monthly_fee_supply != null ? String(target.monthly_fee_supply) : '',
    vat_included: Boolean(target.vat_included),
    change_reason: target.change_reason || '',
    memo: target.memo || '',
    is_active: Boolean(target.is_active),
  }
}

export default function ClientBookkeepingContractsSection() {
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null)
  const [rows, setRows] = useState<ClientBookkeepingContractOut[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false)
  const [bulkApplyLoading, setBulkApplyLoading] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkPreview, setBulkPreview] = useState<ClientBookkeepingContractBulkPreviewResponse | null>(null)
  const [bulkApplyResult, setBulkApplyResult] = useState<ClientBookkeepingContractBulkApplyResponse | null>(null)

  const [q, setQ] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  const [companyMap, setCompanyMap] = useState<Record<number, CompanyTaxDetail>>({})
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState<CompanyTaxDetail[]>([])
  const [companyOptionLoading, setCompanyOptionLoading] = useState(false)
  const [isCompanyOptionOpen, setIsCompanyOptionOpen] = useState(false)

  const [memoPreview, setMemoPreview] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [generateResultMap, setGenerateResultMap] = useState<Record<number, ClientBookkeepingGenerateBillingsResponse>>({})
  const [modal, setModal] = useState<ContractModalState>({ open: false, mode: 'create' })
  const [form, setForm] = useState<ContractFormState>(defaultFormState())

  const isActiveFilter = useMemo(() => (includeInactive ? undefined : true), [includeInactive])

  const loadContracts = async () => {
    try {
      setLoading(true)
      const result = await listContracts({
        is_active: isActiveFilter,
        q: q.trim() || undefined,
      })
      setRows(result.items || [])
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadAllCompanies = async () => {
    try {
      const limit = 100
      let page = 1
      let total = 0
      const merged: CompanyTaxDetail[] = []
      do {
        const res = await fetchClientCompanyTaxList({ page, limit, keyword: '' })
        merged.push(...(res.items || []))
        total = res.total || 0
        page += 1
      } while (merged.length < total)

      const map = merged.reduce<Record<number, CompanyTaxDetail>>((acc, item) => {
        acc[item.id] = item
        return acc
      }, {})
      setCompanyMap(map)
    } catch {
      setCompanyMap({})
    }
  }

  const loadCompanyOptions = async (keyword: string) => {
    try {
      setCompanyOptionLoading(true)
      const res = await fetchClientCompanyTaxList({
        page: 1,
        limit: 30,
        keyword: keyword.trim(),
      })
      const sorted = [...(res.items || [])].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
      setCompanyOptions(sorted)
    } catch {
      setCompanyOptions([])
    } finally {
      setCompanyOptionLoading(false)
    }
  }

  useEffect(() => {
    loadContracts()
  }, [isActiveFilter])

  useEffect(() => {
    loadAllCompanies()
  }, [])

  useEffect(() => {
    if (!modal.open) return
    const timer = setTimeout(() => {
      loadCompanyOptions(companyQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [companyQuery, modal.open])

  const openCreate = () => {
    setModal({ open: true, mode: 'create' })
    setForm(defaultFormState())
    setCompanyQuery('')
    setCompanyOptions([])
    setIsCompanyOptionOpen(false)
  }

  const openEdit = (target: ClientBookkeepingContractOut) => {
    setModal({ open: true, mode: 'edit', target })
    setForm(mapContractToForm(target))
    setCompanyQuery(target.company_name || '')
    setCompanyOptions([])
    setIsCompanyOptionOpen(false)
  }

  const closeModal = () => {
    if (saving) return
    setModal({ open: false, mode: 'create' })
    setForm(defaultFormState())
    setCompanyQuery('')
    setCompanyOptions([])
    setIsCompanyOptionOpen(false)
  }

  const selectCompany = (company: CompanyTaxDetail) => {
    setForm((prev) => ({
      ...prev,
      company_id: company.id,
      company_text: company.company_name,
    }))
    setCompanyQuery(company.company_name)
    setIsCompanyOptionOpen(false)
  }

  const handleSave = async () => {
    const startDate = toFullDateForSave(form.start_date)
    const endDate = form.indefinite ? undefined : toFullDateForSave(form.end_date)
    const startMonth = normalizeMonth(form.start_month)
    const endMonth = form.indefinite ? undefined : normalizeMonth(form.end_month)
    const monthlyFeeSupply =
      form.monthly_fee_supply.trim() === '' ? undefined : Number(form.monthly_fee_supply.replace(/,/g, ''))

    if (!form.company_id) {
      toast.error('고객사를 선택해 주세요.')
      return
    }
    if (!startDate && !startMonth) {
      toast.error('시작 기준(start_date 또는 start_month) 중 하나는 입력해 주세요.')
      return
    }
    if (form.start_date.trim() && !startDate) {
      toast.error('계약 시작일 형식이 올바르지 않습니다. (YYYYMM 또는 YYYYMMDD)')
      return
    }
    if (!form.indefinite && form.end_date.trim() && !endDate) {
      toast.error('계약 종료일 형식이 올바르지 않습니다. (YYYYMM 또는 YYYYMMDD)')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error('종료일은 시작일보다 빠를 수 없습니다.')
      return
    }
    if (form.start_month.trim() && !startMonth) {
      toast.error('시작월 형식은 YYYY-MM 이어야 합니다.')
      return
    }
    if (form.end_month.trim() && !endMonth) {
      toast.error('종료월 형식은 YYYY-MM 이어야 합니다.')
      return
    }
    if (monthlyFeeSupply != null && (!Number.isFinite(monthlyFeeSupply) || monthlyFeeSupply < 0)) {
      toast.error('월 기장료(공급가)는 0 이상의 숫자여야 합니다.')
      return
    }

    const changeReason = modal.mode === 'edit' ? form.change_reason.trim() || undefined : undefined
    const payload: ClientBookkeepingContractCreateRequest = {
      company_id: form.company_id,
      start_date: startDate,
      end_date: endDate,
      start_month: startMonth,
      end_month: endMonth,
      monthly_fee_supply: monthlyFeeSupply,
      vat_included: form.vat_included,
      change_reason: changeReason,
      memo: form.memo.trim() || undefined,
      is_active: form.is_active,
    }

    try {
      setSaving(true)
      if (modal.mode === 'create') {
        await createContract(payload)
        toast.success('고객사 계약이 등록되었습니다.')
      } else if (modal.target) {
        await updateContract(modal.target.id, payload)
        toast.success('고객사 계약이 수정되었습니다.')
      }
      closeModal()
      await loadContracts()
    } catch (error) {
      const detail = (error as any)?.response?.data?.detail
      if (typeof detail === 'string' && detail.includes('계약 기간이 중복됩니다')) {
        toast.error('같은 회사의 계약 기간이 중복됩니다.')
      } else {
        toast.error(getClientBookkeepingErrorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (row: ClientBookkeepingContractOut) => {
    try {
      await patchContractActive(row.id, !row.is_active)
      toast.success(row.is_active ? '비활성화되었습니다.' : '활성화되었습니다.')
      await loadContracts()
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    }
  }

  const handleGenerateBillings = async (row: ClientBookkeepingContractOut) => {
    try {
      setGeneratingId(row.id)
      const result = await generateContractBillings(row.id, {})
      setGenerateResultMap((prev) => ({ ...prev, [row.id]: result }))
      toast.success(`생성 ${result.created_count}건 / 스킵 ${result.skipped_count}건`)
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setGeneratingId(null)
    }
  }

  const clearBulkPreview = () => {
    setBulkFile(null)
    setBulkPreview(null)
    setBulkApplyResult(null)
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''
  }

  const handleBulkFileSelect = async (file: File | null) => {
    if (!file) return
    const lowerFileName = file.name.toLowerCase()
    const canUpload = ALLOWED_EXCEL_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))
    if (!canUpload) {
      toast.error('엑셀 파일(.xls, .xlsx, .xlsm, .xltx, .xltm)만 업로드할 수 있습니다.')
      return
    }

    try {
      setBulkPreviewLoading(true)
      setBulkApplyResult(null)
      const preview = await previewContractBulkUpload(file)
      setBulkFile(file)
      setBulkPreview(preview)
      toast.success(`검증 완료: 유효 ${preview.valid_rows}건 / 오류 ${preview.invalid_rows}건`)
    } catch (error) {
      setBulkFile(null)
      setBulkPreview(null)
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setBulkPreviewLoading(false)
    }
  }

  const handleApplyBulk = async () => {
    if (!bulkFile || !bulkPreview) {
      toast.error('먼저 엑셀 검증을 진행해 주세요.')
      return
    }
    try {
      setBulkApplyLoading(true)
      const result = await applyContractBulkUpload(bulkFile)
      setBulkApplyResult(result)
      toast.success(`등록 완료: 생성 ${result.created_count}건 / 실패 ${result.failed_count}건`)
      await loadContracts()
      clearBulkPreview()
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    } finally {
      setBulkApplyLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_auto_auto]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
            >
              고객사 추가
            </button>
            <TemplateDownloadButton code="BOOKKEEPING_CONTRACT_BULK" label="고객사 계약 일괄등록 양식" />
            <button
              type="button"
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={bulkPreviewLoading || bulkApplyLoading}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {bulkPreviewLoading ? '검증 중...' : '엑셀파일 일괄등록'}
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xls,.xlsx,.xlsm,.xltx,.xltm"
              className="hidden"
              onChange={(e) => {
                void handleBulkFileSelect(e.target.files?.[0] || null)
              }}
            />
          </div>
          <input
            className={inputClass}
            placeholder="회사명/사업자번호 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                loadContracts()
              }
            }}
          />
          <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={!includeInactive}
              onChange={(e) => setIncludeInactive(!e.target.checked)}
            />
            활성만
          </label>
          <button
            type="button"
            onClick={loadContracts}
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            조회
          </button>
        </div>
      </div>

      {bulkPreview ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">엑셀 검증 프리뷰</h3>
            <p className="text-xs text-zinc-500">{bulkFile?.name || '-'}</p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              전체 행 <span className="ml-1 font-semibold text-zinc-900">{bulkPreview.total_rows}</span>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              유효 행 <span className="ml-1 font-semibold">{bulkPreview.valid_rows}</span>
            </div>
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              오류 행 <span className="ml-1 font-semibold">{bulkPreview.invalid_rows}</span>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              등록 가능 <span className="ml-1 font-semibold text-zinc-900">{bulkPreview.valid_rows > 0 ? '예' : '아니오'}</span>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            <p>열 순서가 달라도 컬럼명 기준으로 읽습니다.</p>
            <p>사업자번호는 하이픈 유무 상관없이 처리됩니다.</p>
            <p>기간 중복 행은 자동으로 실패 처리됩니다.</p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-[1080px] w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-2 py-2 text-center">행</th>
                  <th className="px-2 py-2 text-center">회사명</th>
                  <th className="px-2 py-2 text-center">사업자번호</th>
                  <th className="px-2 py-2 text-center">시작일</th>
                  <th className="px-2 py-2 text-center">종료일</th>
                  <th className="px-2 py-2 text-right">월기장료</th>
                  <th className="px-2 py-2 text-center">VAT포함</th>
                  <th className="px-2 py-2 text-center">상태</th>
                  <th className="px-2 py-2 text-center">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {bulkPreview.rows.map((row) => {
                  const isValid = row.status === 'valid'
                  return (
                    <tr key={`preview-row-${row.row_no}`} className={isValid ? '' : 'bg-rose-50/40'}>
                      <td className="px-2 py-2 text-center">{row.row_no}</td>
                      <td className="px-2 py-2 text-center">{row.company_name || '-'}</td>
                      <td className="px-2 py-2 text-center">{row.registration_number || '-'}</td>
                      <td className="px-2 py-2 text-center">{row.start_date || '-'}</td>
                      <td className="px-2 py-2 text-center">{row.end_date || '-'}</td>
                      <td className="px-2 py-2 text-right">{typeof row.monthly_fee_supply === 'number' ? row.monthly_fee_supply.toLocaleString('ko-KR') : '-'}</td>
                      <td className="px-2 py-2 text-center">{typeof row.vat_included === 'boolean' ? (row.vat_included ? 'Y' : 'N') : '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`rounded px-2 py-0.5 ${isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">{row.reason || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearBulkPreview}
              disabled={bulkApplyLoading}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApplyBulk}
              disabled={bulkApplyLoading || bulkPreview.valid_rows === 0}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {bulkApplyLoading ? '등록 중...' : '등록'}
            </button>
          </div>

          {bulkApplyResult && bulkApplyResult.failed_count > 0 ? (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-rose-700">등록 실패 행 ({bulkApplyResult.failed_count}건)</h4>
              <div className="mt-2 overflow-x-auto rounded-lg border border-rose-200">
                <table className="min-w-[800px] w-full text-xs">
                  <thead className="bg-rose-50 text-rose-700">
                    <tr>
                      <th className="px-2 py-2 text-center">행</th>
                      <th className="px-2 py-2 text-center">회사명</th>
                      <th className="px-2 py-2 text-center">사업자번호</th>
                      <th className="px-2 py-2 text-center">사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {bulkApplyResult.rows
                      .filter((row) => row.status !== 'valid')
                      .map((row) => (
                        <tr key={`apply-failed-${row.row_no}`}>
                          <td className="px-2 py-2 text-center">{row.row_no}</td>
                          <td className="px-2 py-2 text-center">{row.company_name || '-'}</td>
                          <td className="px-2 py-2 text-center">{row.registration_number || '-'}</td>
                          <td className="px-2 py-2 text-center">{row.reason || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1320px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">회사명</th>
              <th className="px-3 py-3 text-center">사업자번호</th>
              <th className="px-3 py-3 text-center">버전</th>
              <th className="px-3 py-3 text-center">카테고리</th>
              <th className="px-3 py-3 text-right">월 기장료(공급가)</th>
              <th className="px-3 py-3 text-center">VAT 포함</th>
              <th className="px-3 py-3 text-center">계약기간</th>
              <th className="px-3 py-3 text-center">변경 사유</th>
              <th className="px-3 py-3 text-center">고정 메모</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-zinc-500">
                  고객사 계약이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const company = companyMap[row.company_id]
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-3 text-center">{row.company_name || '-'}</td>
                    <td className="px-3 py-3 text-center">{row.registration_number || '-'}</td>
                    <td className="px-3 py-3 text-center">v{row.version_no}</td>
                    <td className="px-3 py-3 text-center">{company?.category || '-'}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(row.monthly_fee_supply)}</td>
                    <td className="px-3 py-3 text-center">{row.vat_included ? '포함' : '별도'}</td>
                    <td className="px-3 py-3 text-center">
                      {formatContractPeriod(row)}
                      {(row.start_date || row.end_date ? row.end_date == null : row.end_month == null) ? (
                        <span className="ml-2 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                          현재 계약
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center">{row.change_reason || '-'}</td>
                    <td className="px-3 py-3 text-center">
                      {row.memo ? (
                        <button
                          type="button"
                          title={row.memo}
                          onClick={() => setMemoPreview(row.memo || '')}
                          className="inline-block max-w-[240px] truncate text-center text-zinc-700 hover:underline"
                        >
                          {row.memo}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">{row.is_active ? '활성' : '비활성'}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={generatingId === row.id}
                          onClick={() => handleGenerateBillings(row)}
                          className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {generatingId === row.id ? '생성 중...' : '자동생성'}
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
                          onClick={() => handleToggleActive(row)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          {row.is_active ? '비활성' : '활성'}
                        </button>
                      </div>
                      {generateResultMap[row.id] ? (
                        <div className="mt-1 text-[11px] text-zinc-500">
                          생성 {generateResultMap[row.id].created_count}건 / 스킵 {generateResultMap[row.id].skipped_count}건
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.mode === 'create' ? '고객사 계약 등록' : '고객사 계약 수정'}
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
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="회사명/사업자번호 검색 후 선택"
                    value={companyQuery}
                    onFocus={() => setIsCompanyOptionOpen(true)}
                    onChange={(e) => {
                      setCompanyQuery(e.target.value)
                      setIsCompanyOptionOpen(true)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (companyOptions.length > 0) {
                          selectCompany(companyOptions[0])
                        }
                      }
                    }}
                  />
                  <label className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={form.indefinite}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          indefinite: e.target.checked,
                          end_date: e.target.checked ? '' : prev.end_date,
                          end_month: e.target.checked ? '' : prev.end_month,
                        }))
                      }
                    />
                    무기한 계약
                  </label>
                </div>
                {isCompanyOptionOpen ? (
                  <div
                    className="mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {companyOptionLoading ? (
                      <div className="px-3 py-2 text-sm text-zinc-500">회사 목록 조회 중...</div>
                    ) : companyOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-500">검색 결과가 없습니다.</div>
                    ) : (
                      companyOptions.map((company) => (
                        <button
                          type="button"
                          key={company.id}
                          onClick={() => selectCompany(company)}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 ${
                            form.company_id === company.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'
                          }`}
                        >
                          {company.company_name} ({company.registration_number})
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-zinc-500">
                  선택된 회사: {form.company_text || '미선택'} (엔터로 첫 검색 결과 선택 가능)
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600">계약 시작일</p>
                <input
                  className={inputClass}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="YYYY.MM.DD"
                  value={form.start_date}
                  onChange={(e) => {
                    const nextStartDate = formatFlexibleDateInput(e.target.value)
                    const parsedStartDate = parseFlexibleDateToIso(nextStartDate)
                    setForm((prev) => ({
                      ...prev,
                      start_date: nextStartDate,
                      start_month: parsedStartDate ? parsedStartDate.slice(0, 7) : '',
                    }))
                  }}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600">시작월(자동)</p>
                <div className="flex h-10 items-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-700">
                  {form.start_month || '-'}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600">계약 종료일</p>
                <input
                  className={`${inputClass} ${form.indefinite ? 'border-zinc-200 bg-zinc-100 text-zinc-400' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="YYYY.MM.DD"
                  disabled={form.indefinite}
                  value={form.end_date}
                  onChange={(e) => {
                    const nextEndDate = formatFlexibleDateInput(e.target.value)
                    const parsedEndDate = parseFlexibleDateToIso(nextEndDate)
                    setForm((prev) => ({
                      ...prev,
                      end_date: nextEndDate,
                      end_month: parsedEndDate ? parsedEndDate.slice(0, 7) : '',
                    }))
                  }}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600">종료월(자동)</p>
                <div
                  className={`flex h-10 items-center rounded-md border px-3 text-sm ${
                    form.indefinite
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-700'
                  }`}
                >
                  {form.end_month || '-'}
                </div>
              </div>
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="월 기장료(공급가)"
                value={form.monthly_fee_supply}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    monthly_fee_supply: e.target.value.replace(/[^\d]/g, ''),
                  }))
                }
              />
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.vat_included}
                  onChange={(e) => setForm((prev) => ({ ...prev, vat_included: e.target.checked }))}
                />
                VAT 포함
              </label>
              {modal.mode === 'edit' ? (
                <>
                  <input
                    className={inputClass}
                    placeholder="변경 사유 (선택)"
                    value={form.change_reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, change_reason: e.target.value }))}
                  />
                  <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    />
                    활성 상태
                  </label>
                </>
              ) : null}
              <textarea
                className="md:col-span-2 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="고정 메모"
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

      {memoPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">고정 메모 전체 보기</h3>
              <button
                type="button"
                onClick={() => setMemoPreview(null)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-zinc-700">{memoPreview}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
