'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  getAdminWithholding33Detail,
  getAdminWithholding33List,
  reviewAdminWithholding33,
} from '@/services/admin/withholding33Service'
import { fetchCompanyTaxList } from '@/services/admin/company'
import type {
  AdminWithholding33Item,
  WithholdingReviewStatus,
  WithholdingReviewTargetStatus,
} from '@/types/admin_withholding33'
import type { CompanyTaxDetail } from '@/types/admin_campany'
import UiSearchInput from '@/components/common/UiSearchInput'

function toMonthInput(value: string) {
  if (!value) return ''
  if (value.length === 7) return value
  if (value.length === 6) return `${value.slice(0, 4)}-${value.slice(4)}`
  return value
}

function toMonthParam(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.replace('-', '')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function formatMoney(value: number) {
  return value.toLocaleString('ko-KR')
}

function statusLabel(status: WithholdingReviewStatus) {
  if (status === 'draft') return '검토대기'
  if (status === 'reviewed') return '검토완료'
  if (status === 'rejected') return '반려'
  return '신고완료'
}

function statusBadgeClass(status: WithholdingReviewStatus) {
  if (status === 'draft') return 'bg-amber-100 text-amber-800'
  if (status === 'rejected') return 'bg-rose-100 text-rose-700'
  return 'bg-emerald-100 text-emerald-700'
}

function allowedNextStatuses(status: WithholdingReviewStatus): WithholdingReviewTargetStatus[] {
  if (status === 'draft') return ['reviewed', 'rejected']
  if (status === 'reviewed') return ['filed', 'rejected']
  if (status === 'rejected') return ['reviewed']
  return []
}

export default function Withholding33BusinessSection() {
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyKeyword, setCompanyKeyword] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [pendingCountByCompany, setPendingCountByCompany] = useState<Record<number, number>>({})
  const [totalCountByCompany, setTotalCountByCompany] = useState<Record<number, number>>({})
  const [pendingLoading, setPendingLoading] = useState(false)

  const [allRows, setAllRows] = useState<AdminWithholding33Item[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [targetMonth, setTargetMonth] = useState('')
  const [page, setPage] = useState(1)
  const [size] = useState(20)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminWithholding33Item | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [nextStatus, setNextStatus] = useState<'' | WithholdingReviewTargetStatus>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const total = allRows.length
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])
  const pagedRows = useMemo(() => {
    const start = (page - 1) * size
    return allRows.slice(start, start + size)
  }, [allRows, page, size])
  const filteredCompanies = useMemo(() => {
    const keyword = companyKeyword.trim().toLowerCase()
    const base = keyword
      ? companies.filter((company) => company.company_name.toLowerCase().includes(keyword))
      : companies

    return [...base].sort((a, b) => {
      const aPending = (pendingCountByCompany[a.id] ?? 0) > 0 ? 1 : 0
      const bPending = (pendingCountByCompany[b.id] ?? 0) > 0 ? 1 : 0
      if (aPending !== bPending) return bPending - aPending
      return a.company_name.localeCompare(b.company_name, 'ko')
    })
  }, [companies, companyKeyword, pendingCountByCompany])

  const loadCompanies = async () => {
    try {
      setCompanyLoading(true)
      const data = await fetchCompanyTaxList({ page: 1, limit: 100 })
      const sorted = [...data.items].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
      setCompanies(sorted)
    } catch (err: any) {
      const code = err?.response?.status
      if (code === 401) toast.error('로그인이 만료되었습니다.')
      else if (code === 403) toast.error('권한이 없습니다.')
      else toast.error('회사 목록 조회에 실패했습니다.')
      setCompanies([])
    } finally {
      setCompanyLoading(false)
    }
  }

  const loadPendingCounts = async () => {
    try {
      setPendingLoading(true)
      const pendingCounts: Record<number, number> = {}
      const totalCounts: Record<number, number> = {}
      let nextPage = 1
      const pageSize = 100

      while (true) {
        const data = await getAdminWithholding33List({
          page: nextPage,
          size: pageSize,
        })

        data.items.forEach((item) => {
          totalCounts[item.company_id] = (totalCounts[item.company_id] ?? 0) + 1
          if (item.review_status === 'draft') {
            pendingCounts[item.company_id] = (pendingCounts[item.company_id] ?? 0) + 1
          }
        })

        if (nextPage * data.size >= data.total) break
        nextPage += 1
      }

      setPendingCountByCompany(pendingCounts)
      setTotalCountByCompany(totalCounts)
    } catch {
      setPendingCountByCompany({})
      setTotalCountByCompany({})
    } finally {
      setPendingLoading(false)
    }
  }

  const loadList = async (companyId = selectedCompanyId) => {
    if (!companyId) {
      setAllRows([])
      setPage(1)
      return
    }

    try {
      setLoading(true)
      let nextPage = 1
      const pageSize = 100
      const fetched: AdminWithholding33Item[] = []

      while (true) {
        const data = await getAdminWithholding33List({
          company_id: companyId,
          page: nextPage,
          size: pageSize,
          q: q.trim() || undefined,
          target_month: toMonthParam(targetMonth),
        })
        fetched.push(...data.items)
        if (nextPage * data.size >= data.total) break
        nextPage += 1
      }

      const order: Record<WithholdingReviewStatus, number> = {
        draft: 0,
        rejected: 1,
        reviewed: 2,
        filed: 3,
      }

      const filtered = fetched
        .filter((item) => item.review_status === 'draft' || item.review_status === 'rejected' || item.review_status === 'reviewed')
        .sort((a, b) => {
          const byStatus = order[a.review_status] - order[b.review_status]
          if (byStatus !== 0) return byStatus
          const aName = a.contractor_name ?? ''
          const bName = b.contractor_name ?? ''
          return aName.localeCompare(bName, 'ko')
        })

      setAllRows(filtered)
      setPage(1)
    } catch (err: any) {
      const code = err?.response?.status
      if (code === 401) toast.error('로그인이 만료되었습니다.')
      else if (code === 403) toast.error('권한이 없습니다.')
      else if (code === 404) {
        setAllRows([])
      } else toast.error('원천세 목록 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (paymentId: number) => {
    try {
      setDetailLoading(true)
      const data = await getAdminWithholding33Detail(paymentId)
      setDetail(data)
      const allowed = allowedNextStatuses(data.review_status)
      setNextStatus(allowed[0] ?? '')
      setNote(data.review_note ?? '')
    } catch (err: any) {
      const code = err?.response?.status
      if (code === 404) toast.error('지급내역을 찾을 수 없습니다.')
      else toast.error('상세 조회에 실패했습니다.')
      setSelectedId(null)
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
    loadPendingCounts()
  }, [])

  useEffect(() => {
    if (!selectedCompanyId) return
    loadList(selectedCompanyId)
  }, [selectedCompanyId])

  const handleSelectCompany = (companyId: number) => {
    setSelectedCompanyId(companyId)
    setSelectedId(null)
    setDetail(null)
  }

  const handleOpenDetail = async (paymentId: number) => {
    setSelectedId(paymentId)
    await loadDetail(paymentId)
  }

  const handleReviewSave = async () => {
    if (!selectedId || !detail) return
    if (!nextStatus) {
      toast.error('변경할 상태를 선택해 주세요.')
      return
    }
    if (nextStatus === 'rejected' && !note.trim()) {
      toast.error('반려 시 메모는 필수입니다.')
      return
    }
    try {
      setSaving(true)
      await reviewAdminWithholding33(selectedId, {
        status: nextStatus,
        note: note.trim() || undefined,
      })
      toast.success('검토 상태가 저장되었습니다.')
      await Promise.all([loadList(selectedCompanyId), loadDetail(selectedId), loadPendingCounts()])
    } catch (err: any) {
      const code = err?.response?.status
      const detailMsg = err?.response?.data?.detail
      if (code === 409) toast.error(typeof detailMsg === 'string' ? detailMsg : '허용되지 않는 상태 전이입니다.')
      else if (code === 422) toast.error(typeof detailMsg === 'string' ? detailMsg : '입력값을 확인해 주세요.')
      else if (code === 404) toast.error('대상을 찾을 수 없습니다.')
      else toast.error('검토 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">사업신고 (3.3 검토)</h1>
        <p className="mt-1 text-sm text-zinc-500">회사 선택 후 신고대기 지급내역을 검토할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 xl:col-span-1">
          <h2 className="text-sm font-semibold text-zinc-900">회사 목록</h2>
          <div className="mt-3 space-y-2">
            <UiSearchInput
              placeholder="회사명 검색"
              value={companyKeyword}
              onChange={setCompanyKeyword}
            />
            <div className="max-h-[620px] overflow-y-auto rounded-md border border-zinc-200">
              {companyLoading ? (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">회사 목록 조회 중...</div>
              ) : filteredCompanies.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">회사 목록이 없습니다.</div>
              ) : (
                <ul className="divide-y divide-zinc-200">
                  {filteredCompanies.map((company) => {
                    const active = company.id === selectedCompanyId
                    const pendingCount = pendingCountByCompany[company.id] ?? 0
                    const totalCount = totalCountByCompany[company.id] ?? 0
                    return (
                      <li key={company.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectCompany(company.id)}
                          className={`w-full px-3 py-2 text-left text-sm transition ${
                            active ? 'bg-neutral-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium">{company.company_name}</p>
                            {pendingCount > 0 ? (
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  active
                                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                                    : 'animate-pulse border-amber-300 bg-amber-100 text-amber-700'
                                }`}
                              >
                                검토대기 {pendingCount}
                              </span>
                            ) : totalCount > 0 ? (
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                  active
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                    : 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                확인완료
                              </span>
                            ) : null}
                          </div>
                          <p className={`mt-0.5 text-xs ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                            {company.registration_number}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {pendingLoading ? (
                <div className="border-t border-zinc-200 px-3 py-2 text-right text-xs text-zinc-400">
                  검토대기 집계 중...
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                placeholder="대상자명/사업자번호/주민번호"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    loadList(selectedCompanyId)
                  }
                }}
                disabled={!selectedCompanyId}
              />
              <input
                type="month"
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                value={toMonthInput(targetMonth)}
                onChange={(e) => setTargetMonth(e.target.value)}
                disabled={!selectedCompanyId}
              />
              <button
                type="button"
                onClick={() => loadList(selectedCompanyId)}
                className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                disabled={!selectedCompanyId}
              >
                조회
              </button>
              <div className="flex items-center justify-end text-sm text-zinc-500">신고대기 {total}건</div>
            </div>
          </div>

          {!selectedCompanyId ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-16 text-center text-sm text-zinc-500">
              좌측에서 회사를 선택해 주세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-700">
                    <tr>
                      <th className="px-3 py-3 text-center">번호</th>
                      <th className="px-3 py-3 text-center">대상자</th>
                      <th className="px-3 py-3 text-center">주민번호</th>
                      <th className="px-3 py-3 text-right">총지급액</th>
                      <th className="px-3 py-3 text-right">소득세</th>
                      <th className="px-3 py-3 text-right">지방세</th>
                      <th className="px-3 py-3 text-right">실지급액</th>
                      <th className="px-3 py-3 text-center">상태</th>
                      <th className="px-3 py-3 text-center">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
                      </tr>
                    ) : pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">신고대기 지급내역이 없습니다.</td>
                      </tr>
                    ) : (
                      pagedRows.map((row, idx) => (
                        <tr key={row.id} className="even:bg-zinc-50">
                          <td className="px-3 py-3 text-center whitespace-nowrap">{(page - 1) * size + idx + 1}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">{row.contractor_name ?? '-'}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">{row.contractor_rrn ?? '-'}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(row.gross_pay)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(row.income_tax)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(row.local_tax)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{formatMoney(row.net_pay)}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.review_status === 'draft'
                                  ? 'bg-amber-100 text-amber-800'
                                  : row.review_status === 'rejected'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {statusLabel(row.review_status)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(row.id)}
                              className="inline-flex h-7 items-center rounded-md border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              보기
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4 xl:w-[340px]">
                <h2 className="text-sm font-semibold text-zinc-900">검토 작업</h2>
                {selectedId === null ? (
                  <div className="mt-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                    목록에서 항목을 선택해 주세요.
                  </div>
                ) : detailLoading ? (
                  <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                    상세 조회 중...
                  </div>
                ) : detail ? (
                  <div className="mt-3 space-y-4">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-zinc-600">현재 상태</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(detail.review_status)}`}>
                          {statusLabel(detail.review_status)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-zinc-600">
                        <p>대상자: <span className="font-medium text-zinc-800">{detail.contractor_name ?? '-'}</span></p>
                        <p>주민번호: <span className="font-medium text-zinc-800">{detail.contractor_rrn ?? '-'}</span></p>
                        <p>귀속월: <span className="font-medium text-zinc-800">{detail.target_month}</span></p>
                        <p>수정일: <span className="font-medium text-zinc-800">{formatDateTime(detail.updated_at)}</span></p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-zinc-600">변경할 상태</label>
                      <select
                        className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value as '' | WithholdingReviewTargetStatus)}
                        disabled={allowedNextStatuses(detail.review_status).length === 0}
                      >
                        {allowedNextStatuses(detail.review_status).length === 0 ? (
                          <option value="">변경 불가</option>
                        ) : (
                          <>
                            <option value="">선택</option>
                            {allowedNextStatuses(detail.review_status).map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s as WithholdingReviewStatus)}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-zinc-600">검토 메모</label>
                      <textarea
                        rows={5}
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, 500))}
                        placeholder="반려 시 메모 필수"
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                      />
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>현재 메모: {detail.review_note ? '있음' : '없음'}</span>
                        <span>{note.length}/500</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleReviewSave}
                      disabled={saving || allowedNextStatuses(detail.review_status).length === 0}
                      className="h-10 w-full rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {saving ? '저장 중...' : '검토 저장'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || !selectedCompanyId}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
            >
              ◀
            </button>
            <span className="text-sm text-zinc-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || !selectedCompanyId}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm disabled:opacity-50"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
