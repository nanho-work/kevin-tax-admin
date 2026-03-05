'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import {
  listBookkeepingDebitBatchItems,
  listBookkeepingDebitBatches,
  patchBookkeepingDebitItemLink,
  rematchBookkeepingDebitBatch,
} from '@/services/client/clientBookkeepingService'
import type {
  ClientDebitBatchRematchResponse,
  ClientDebitUploadBatchOut,
  ClientDebitUploadItemOut,
} from '@/types/clientBookkeeping'
import type { CompanyTaxDetail } from '@/types/admin_campany'

type Props = {
  batchId: number
}

type MappingTab = 'all' | 'unmapped' | 'mapped'

function extractApiDetail(error: unknown): string | null {
  const responseData = (error as any)?.response?.data
  const detail = responseData?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  return null
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function formatCompactDate(value?: string | null) {
  if (!value) return '-'
  const normalized = String(value).trim()
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`
  }
  return normalized
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function isLinkableWithdrawStatus(status?: string | null) {
  if (!status) return true
  const normalized = status.trim().toLowerCase()
  if (!normalized) return true
  if (normalized.includes('실패')) return false
  if (/fail|failed|failure/.test(normalized)) return false
  return true
}

export default function ClientBookkeepingDebitBatchDetailSection({ batchId }: Props) {
  const router = useRouter()
  const [batchMeta, setBatchMeta] = useState<ClientDebitUploadBatchOut | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)

  const [rows, setRows] = useState<ClientDebitUploadItemOut[]>([])
  const [loading, setLoading] = useState(false)
  const [statusWorkingId, setStatusWorkingId] = useState<number | null>(null)

  const [withdrawStatus, setWithdrawStatus] = useState('')
  const [tab, setTab] = useState<MappingTab>('all')
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [rematchLoading, setRematchLoading] = useState(false)
  const [rematchResult, setRematchResult] = useState<ClientDebitBatchRematchResponse | null>(null)

  const [page, setPage] = useState(1)
  const [size] = useState(50)
  const [total, setTotal] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  const [matchStats, setMatchStats] = useState<{ total: number; matched: number; unmatched: number }>({
    total: 0,
    matched: 0,
    unmatched: 0,
  })

  const [companyMap, setCompanyMap] = useState<Record<number, CompanyTaxDetail>>({})
  const [companyOptions, setCompanyOptions] = useState<CompanyTaxDetail[]>([])
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<ClientDebitUploadItemOut | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('')

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aMapped = Boolean(a.company_id)
      const bMapped = Boolean(b.company_id)

      // 1) 미매핑 상단, 매핑 하단
      if (aMapped !== bMapped) return aMapped ? 1 : -1

      // 2) 회사명 가나다순 (미매핑은 member_name fallback)
      const aCompanyName = a.company_id ? (companyMap[a.company_id]?.company_name || '') : ''
      const bCompanyName = b.company_id ? (companyMap[b.company_id]?.company_name || '') : ''
      const aKey = (aCompanyName || a.member_name || '').trim()
      const bKey = (bCompanyName || b.member_name || '').trim()
      const byName = aKey.localeCompare(bKey, 'ko')
      if (byName !== 0) return byName

      return a.id - b.id
    })
  }, [rows, companyMap])

  const filteredRows = useMemo(() => {
    if (tab === 'unmapped') return sortedRows.filter((row) => !row.company_id)
    if (tab === 'mapped') return sortedRows.filter((row) => Boolean(row.company_id))
    return sortedRows
  }, [sortedRows, tab])

  const filteredCompanyOptions = useMemo(() => {
    const keyword = companyQuery.trim().toLowerCase()
    if (!keyword) return companyOptions
    return companyOptions.filter((company) => {
      const name = company.company_name.toLowerCase()
      const reg = company.registration_number.toLowerCase()
      return name.includes(keyword) || reg.includes(keyword)
    })
  }, [companyOptions, companyQuery])

  const visibleCompanyOptions = useMemo(() => filteredCompanyOptions.slice(0, 30), [filteredCompanyOptions])

  const formatCompanyOption = (company: CompanyTaxDetail) => `${company.company_name} (${company.registration_number})`

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
      setCompanyMap(
        sorted.reduce<Record<number, CompanyTaxDetail>>((acc, item) => {
          acc[item.id] = item
          return acc
        }, {})
      )
    } catch {
      setCompanyOptions([])
      setCompanyMap({})
    }
  }

  const loadBatchMeta = async () => {
    try {
      setMetaLoading(true)
      const pageSize = 100
      let currentPage = 1
      let totalCount = 0
      let found: ClientDebitUploadBatchOut | null = null

      do {
        const res = await listBookkeepingDebitBatches({ page: currentPage, size: pageSize })
        totalCount = res.total || 0
        found = (res.items || []).find((item) => item.id === batchId) || null
        if (found) break
        currentPage += 1
      } while ((currentPage - 1) * pageSize < totalCount)

      setBatchMeta(found)
      if (!found) {
        toast.error('배치 정보를 찾을 수 없습니다.')
        router.replace('/client/bookkeeping/debits/batches')
      }
    } catch (error) {
      const status = (error as any)?.response?.status
      if (status === 404) {
        toast.error(extractApiDetail(error) || '배치를 찾을 수 없습니다.')
        router.replace('/client/bookkeeping/debits/batches')
        return
      }
      toast.error(extractApiDetail(error) || '배치 메타 조회 중 오류가 발생했습니다.')
      setBatchMeta(null)
    } finally {
      setMetaLoading(false)
    }
  }

  const loadItems = async (nextPage = page, nextStatus = withdrawStatus, nextTab = tab) => {
    try {
      setLoading(true)
      const matchedOnly = nextTab === 'mapped'
      const [res, totalRes, matchedRes] = await Promise.all([
        listBookkeepingDebitBatchItems(batchId, {
          withdraw_status: nextStatus || undefined,
          matched_only: matchedOnly,
          page: nextPage,
          size,
        }),
        listBookkeepingDebitBatchItems(batchId, {
          withdraw_status: nextStatus || undefined,
          matched_only: false,
          page: 1,
          size: 1,
        }),
        listBookkeepingDebitBatchItems(batchId, {
          withdraw_status: nextStatus || undefined,
          matched_only: true,
          page: 1,
          size: 1,
        }),
      ])

      const items = res.items || []
      setRows(items)
      setTotal(res.total || 0)
      setPage(nextPage)
      setMatchStats({
        total: totalRes.total || 0,
        matched: matchedRes.total || 0,
        unmatched: Math.max(0, (totalRes.total || 0) - (matchedRes.total || 0)),
      })
      setStatusOptions((prev) => {
        const merged = new Set(prev)
        for (const item of items) {
          if (item.withdraw_status) merged.add(item.withdraw_status)
        }
        return Array.from(merged)
      })
    } catch (error) {
      const status = (error as any)?.response?.status
      if (status === 404) {
        toast.error(extractApiDetail(error) || '배치를 찾을 수 없습니다.')
        router.replace('/client/bookkeeping/debits/batches')
        return
      }
      toast.error(extractApiDetail(error) || '배치 아이템 조회 중 오류가 발생했습니다.')
      setRows([])
      setTotal(0)
      setMatchStats({ total: 0, matched: 0, unmatched: 0 })
    } finally {
      setLoading(false)
    }
  }

  const openLinkModal = (row: ClientDebitUploadItemOut) => {
    setLinkTarget(row)
    setSelectedCompanyId('')
    setCompanyQuery('')
    setCompanyDropdownOpen(true)
  }

  const closeLinkModal = () => {
    if (statusWorkingId) return
    setLinkTarget(null)
    setSelectedCompanyId('')
    setCompanyQuery('')
    setCompanyDropdownOpen(false)
  }

  const handleLink = async () => {
    if (!linkTarget) return
    const normalizedQuery = companyQuery.trim()
    const resolvedCompany =
      selectedCompanyId ||
      companyOptions.find(
        (company) => company.company_name === normalizedQuery || company.registration_number === normalizedQuery
      )?.id
    if (!resolvedCompany) {
      toast.error('회사를 선택해 주세요.')
      return
    }

    try {
      setStatusWorkingId(linkTarget.id)
      await patchBookkeepingDebitItemLink(linkTarget.id, {
        company_id: Number(resolvedCompany),
      })
      toast.success('수동 매핑이 완료되었습니다.')
      closeLinkModal()
      await loadItems(page, withdrawStatus, tab)
    } catch (error) {
      toast.error(extractApiDetail(error) || '수동 매핑 처리 중 오류가 발생했습니다.')
    } finally {
      setStatusWorkingId(null)
    }
  }

  const handleRematch = async () => {
    try {
      setRematchLoading(true)
      const result = await rematchBookkeepingDebitBatch(batchId)
      setRematchResult(result)
      toast.success(`재매칭 ${result.rematched_count}건 / 잔여 ${result.still_unmatched_count}건`)
      await loadItems(1, withdrawStatus, tab)
      await loadBatchMeta()
    } catch (error) {
      toast.error(extractApiDetail(error) || '재매칭 처리 중 오류가 발생했습니다.')
    } finally {
      setRematchLoading(false)
    }
  }

  useEffect(() => {
    loadBatchMeta()
    loadCompanies()
  }, [batchId, router])

  useEffect(() => {
    loadItems(1, withdrawStatus, tab)
  }, [batchId, withdrawStatus, tab])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-zinc-900">자동이체 배치 상세</h1>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back()
                return
              }
              router.push('/client/bookkeeping/debits/batches')
            }}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            뒤로가기
          </button>
        </div>
        {metaLoading ? (
          <p className="mt-2 text-sm text-zinc-500">배치 정보 조회 중...</p>
        ) : !batchMeta ? (
          <p className="mt-2 text-sm text-zinc-500">배치 정보를 찾을 수 없습니다.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 md:grid-cols-2 xl:grid-cols-3">
            <div>업로드일시: {formatDateTime(batchMeta.uploaded_at)}</div>
            <div>출처: {batchMeta.source_name || '-'}</div>
            <div>파일명: {batchMeta.file_name || '-'}</div>
            <div>총 행수: {formatNumber(batchMeta.total_rows)}</div>
            <div>성공: {formatNumber(batchMeta.success_rows)}</div>
            <div>실패: {formatNumber(batchMeta.failed_rows)}</div>
            <div className="md:col-span-2 xl:col-span-3">메모: {batchMeta.memo || '-'}</div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setTab('unmapped')}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === 'unmapped' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            미매핑
          </button>
          <button
            type="button"
            onClick={() => setTab('mapped')}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === 'mapped' ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            매핑완료
          </button>
          <select
            className="ml-auto h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            value={withdrawStatus}
            onChange={(e) => setWithdrawStatus(e.target.value)}
          >
            <option value="">전체 출금상태</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={rematchLoading}
            onClick={handleRematch}
            className="h-10 rounded-md border border-blue-300 bg-white px-3 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-60"
          >
            {rematchLoading ? '재매칭 중...' : '미매핑 재매칭'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700">
            전체 {matchStats.total.toLocaleString('ko-KR')}건
          </span>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
            매핑완료 {matchStats.matched.toLocaleString('ko-KR')}건
          </span>
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
            미매핑 {matchStats.unmatched.toLocaleString('ko-KR')}건
          </span>
          {rematchResult ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
              최근 재매칭: {rematchResult.rematched_count}건 / 잔여 {rematchResult.still_unmatched_count}건
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1400px] w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="border-r border-zinc-200 px-3 py-3 text-center">상태</th>
              <th className="w-[190px] border-r border-zinc-200 px-3 py-3 text-center">회사명</th>
              <th className="w-[190px] border-r border-zinc-200 px-3 py-3 text-center">입금자명</th>
              <th className="w-[110px] border-r border-zinc-200 px-3 py-3 text-center">출금일</th>
              <th className="w-[120px] border-r border-zinc-200 px-3 py-3 text-right">출금금액</th>
              <th className="border-r border-zinc-200 px-3 py-3 text-left">출금상태</th>
              <th className="border-r border-zinc-200 px-3 py-3 text-left">메모</th>
              <th className="w-[110px] border-r border-zinc-200 px-3 py-3 text-center">예정일</th>
              <th className="w-[120px] px-3 py-3 text-right">신청금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  아이템이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const mapped = Boolean(row.company_id)
                const linkable = isLinkableWithdrawStatus(row.withdraw_status)
                const failedWithdraw = !linkable
                const companyName = row.company_id ? (companyMap[row.company_id]?.company_name || `회사#${row.company_id}`) : ''
                return (
                  <tr key={row.id} className={failedWithdraw ? 'bg-rose-50/60' : undefined}>
                    <td className="border-r border-zinc-100 px-3 py-3 text-center">{mapped ? '매핑완료' : '미매핑'}</td>
                    <td className="max-w-[190px] border-r border-zinc-100 px-3 py-3 text-center">
                      {mapped ? (
                        <span className="block truncate" title={companyName || '-'}>
                          {companyName || '-'}
                        </span>
                      ) : !linkable ? (
                        <span className="text-xs text-zinc-400">매핑 제외</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openLinkModal(row)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          회사 선택
                        </button>
                      )}
                    </td>
                    <td className="max-w-[190px] border-r border-zinc-100 px-3 py-3 text-center">
                      <span className="block truncate" title={row.member_name || '-'}>
                        {row.member_name || '-'}
                      </span>
                    </td>
                    <td className="w-[110px] border-r border-zinc-100 px-3 py-3 text-center">{formatCompactDate(row.withdraw_date)}</td>
                    <td className="w-[120px] border-r border-zinc-100 px-3 py-3 text-right">{formatNumber(row.withdraw_amount)}</td>
                    <td className="border-r border-zinc-100 px-3 py-3 text-left">{row.withdraw_status || '-'}</td>
                    <td className="border-r border-zinc-100 px-3 py-3 text-left">
                      {row.memo ? <span className="block max-w-[220px] truncate" title={row.memo}>{row.memo}</span> : '-'}
                    </td>
                    <td className="w-[110px] border-r border-zinc-100 px-3 py-3 text-center">{formatCompactDate(row.planned_date)}</td>
                    <td className="w-[120px] px-3 py-3 text-right">{formatNumber(row.requested_amount)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => loadItems(page - 1, withdrawStatus, tab)}
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
          onClick={() => loadItems(page + 1, withdrawStatus, tab)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          다음
        </button>
      </div>

      {linkTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">미매핑 수동 매핑</h2>
              <button
                type="button"
                onClick={closeLinkModal}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              입금자명: <strong>{linkTarget.member_name || '-'}</strong>
            </p>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <input
                  value={companyQuery}
                  onChange={(e) => {
                    setCompanyQuery(e.target.value)
                    setSelectedCompanyId('')
                    setCompanyDropdownOpen(true)
                  }}
                  onFocus={() => setCompanyDropdownOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => setCompanyDropdownOpen(false), 120)
                  }}
                  placeholder="회사 선택 (회사명/사업자번호 입력)"
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
                {companyDropdownOpen ? (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                    {visibleCompanyOptions.length > 0 ? (
                      visibleCompanyOptions.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedCompanyId(company.id)
                            setCompanyQuery(formatCompanyOption(company))
                            setCompanyDropdownOpen(false)
                          }}
                          className="block w-full rounded px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                        >
                          {formatCompanyOption(company)}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-sm text-zinc-500">일치하는 회사가 없습니다.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeLinkModal}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleLink}
                disabled={statusWorkingId === linkTarget.id}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {statusWorkingId === linkTarget.id ? '처리 중...' : '매핑 저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
