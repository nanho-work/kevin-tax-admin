'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  createContract,
  generateContractBillings,
  getClientBookkeepingErrorMessage,
  listContracts,
  patchContractActive,
  updateContract,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientBookkeepingContractCreateRequest,
  ClientBookkeepingContractOut,
  ClientBookkeepingGenerateBillingsResponse,
} from '@/types/clientBookkeeping'
import type { CompanyTaxDetail } from '@/types/admin_campany'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

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
    start_date: target.start_date || '',
    end_date: target.end_date || '',
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
  const [rows, setRows] = useState<ClientBookkeepingContractOut[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
    const startDate = form.start_date.trim() || undefined
    const endDate = form.indefinite ? undefined : form.end_date.trim() || undefined
    const startMonth = normalizeMonth(form.start_month)
    const endMonth = form.indefinite ? undefined : normalizeMonth(form.end_month)
    const monthlyFeeSupply =
      form.monthly_fee_supply.trim() === '' ? undefined : Number(form.monthly_fee_supply.replace(/,/g, ''))

    if (!form.company_id) {
      toast.error('거래처 회사를 선택해 주세요.')
      return
    }
    if (!startDate && !startMonth) {
      toast.error('시작 기준(start_date 또는 start_month) 중 하나는 입력해 주세요.')
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
        toast.success('거래처 계약이 등록되었습니다.')
      } else if (modal.target) {
        await updateContract(modal.target.id, payload)
        toast.success('거래처 계약이 수정되었습니다.')
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

  const handleToggleActive = async (row: ClientBookkeepingContractOut) => {
    try {
      await patchContractActive(row.id, !row.is_active)
      toast.success(row.is_active ? '비활성화되었습니다.' : '활성화되었습니다.')
      await loadContracts()
    } catch (error) {
      toast.error(getClientBookkeepingErrorMessage(error))
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-zinc-900">기장 거래처 관리</h1>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              비활성 포함
            </label>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              거래처 추가
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
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
                  거래처 계약이 없습니다.
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
                {modal.mode === 'create' ? '거래처 계약 등록' : '거래처 계약 수정'}
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
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      start_date: e.target.value,
                      start_month: e.target.value ? e.target.value.slice(0, 7) : '',
                    }))
                  }
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
                  type="date"
                  disabled={form.indefinite}
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      end_date: e.target.value,
                      end_month: e.target.value ? e.target.value.slice(0, 7) : '',
                    }))
                  }
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
