'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  adjustClientAnnualLeave,
  fetchClientAnnualLeaves,
  getClientAnnualLeaveErrorMessage,
  useClientAnnualLeave,
} from '@/services/client/clientAnnualLeaveService'
import type { AdminOut } from '@/types/admin'
import type { AnnualLeave } from '@/types/annualLeave'
import { getClientRoleRank } from '@/utils/roleRank'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

type ActionMode = 'use' | 'adjust'

type LeaveSummaryRow = {
  admin_id: number
  admin_name: string
  granted_days: number
  consumed_days: number
  remaining_days: number
  expired_at: string | null
}

type LeaveDetailGroup = {
  key: string
  label: string
  granted_days: number
  consumed_days: number
  remaining_days: number
  rows: AnnualLeave[]
}

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatNumber(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return value.toLocaleString('ko-KR')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatPeriod(start?: string | null, end?: string | null) {
  if (!start && !end) return '-'
  if (!start) return `~ ${formatDate(end)}`
  if (!end) return `${formatDate(start)} ~`
  return `${formatDate(start)} ~ ${formatDate(end)}`
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getCurrentYear() {
  return new Date().getFullYear()
}

function getNearestExpiredAt(current: string | null, next: string | null) {
  if (!current) return next
  if (!next) return current
  return new Date(current).getTime() <= new Date(next).getTime() ? current : next
}

function isNearExpiry(value?: string | null) {
  if (!value) return false
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return false
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isExpired(value?: string | null) {
  if (!value) return false
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return false
  return target.getTime() < new Date().getTime()
}

function getLeaveStatusMeta(row: { remaining_days: number; expired_at: string | null }) {
  if (row.remaining_days <= 0) {
    return { label: '사용 완료', className: 'inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700' }
  }
  if (isExpired(row.expired_at)) {
    return { label: '소멸', className: 'inline-flex rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700' }
  }
  if (row.expired_at && isNearExpiry(row.expired_at)) {
    return { label: '만료 임박', className: 'inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700' }
  }
  if (row.expired_at) {
    return { label: '사용 가능', className: 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700' }
  }
  return { label: '-', className: 'text-zinc-400' }
}

export default function ClientAnnualLeaveManagementSection() {
  const { session, loading: sessionLoading } = useClientSessionContext()
  const canManage = getClientRoleRank(session) <= 10

  const [items, setItems] = useState<AnnualLeave[]>([])
  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [year, setYear] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [actionMode, setActionMode] = useState<ActionMode | null>(null)
  const [selectedRow, setSelectedRow] = useState<LeaveSummaryRow | null>(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [working, setWorking] = useState<'submit' | null>(null)
  const [actionForm, setActionForm] = useState({
    days: '',
    occurred_on: '',
    reason: '',
    memo: '',
  })

  const loadLeaves = async (targetYear: number | '' = year, targetKeyword = keyword) => {
    try {
      setLoading(true)
      const limit = 100
      let offset = 0
      let total = 0
      const merged: AnnualLeave[] = []

      do {
        const res = await fetchClientAnnualLeaves({
          year: typeof targetYear === 'number' ? targetYear : undefined,
          keyword: targetKeyword.trim() || undefined,
          offset,
          limit,
        })
        merged.push(...(res.items || []))
        total = res.total || 0
        offset += limit
      } while (merged.length < total)

      setItems(merged)
    } catch (error) {
      toast.error(getClientAnnualLeaveErrorMessage(error))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadStaffs = async (targetKeyword = keyword) => {
    try {
      const limit = 100
      let pageCursor = 1
      let total = 0
      const merged: AdminOut[] = []

      do {
        const res = await getClientStaffs(pageCursor, limit, targetKeyword.trim() || undefined)
        merged.push(...(res.items || []))
        total = res.total || 0
        pageCursor += 1
      } while (merged.length < total)

      setStaffs((merged || []).filter((staff) => staff.is_active))
    } catch (error) {
      toast.error('직원 목록을 불러오지 못했습니다')
      setStaffs([])
    }
  }

  useEffect(() => {
    if (!canManage) return
    loadLeaves(year, keyword)
    loadStaffs(keyword)
  }, [year, keyword, canManage])

  useEffect(() => {
    setPage(1)
  }, [year, keyword])

  const rows = useMemo(() => {
    const grouped = items.reduce<Record<number, LeaveSummaryRow>>((acc, item) => {
      const grantedDays = toSafeNumber((item as any).granted_days)
      const consumedDays = toSafeNumber((item as any).consumed_days ?? (item as any).used_days)
      const remainingDaysRaw = (item as any).remaining_days
      const remainingDays =
        remainingDaysRaw == null ? Math.max(0, grantedDays - consumedDays) : toSafeNumber(remainingDaysRaw)

      const current = acc[item.admin_id] || {
        admin_id: item.admin_id,
        admin_name: item.admin_name,
        granted_days: 0,
        consumed_days: 0,
        remaining_days: 0,
        expired_at: null,
      }

      current.granted_days += grantedDays
      current.consumed_days += consumedDays
      current.remaining_days += remainingDays
      current.expired_at = getNearestExpiredAt(current.expired_at, item.expired_at)
      acc[item.admin_id] = current
      return acc
    }, {})

    for (const staff of staffs) {
      if (!grouped[staff.id]) {
        grouped[staff.id] = {
          admin_id: staff.id,
          admin_name: staff.name,
          granted_days: 0,
          consumed_days: 0,
          remaining_days: 0,
          expired_at: null,
        }
      }
    }

    return Object.values(grouped).sort((a, b) => a.admin_name.localeCompare(b.admin_name, 'ko'))
  }, [items, staffs])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])

  const yearOptions = useMemo(() => {
    const currentYear = getCurrentYear()
    return Array.from({ length: 7 }, (_, idx) => currentYear - 3 + idx)
  }, [])

  const dashboardStats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.staffCount += 1
        acc.totalRemaining += row.remaining_days
        if (isNearExpiry(row.expired_at)) {
          acc.nearExpiryCount += 1
        }
        return acc
      },
      { staffCount: 0, totalRemaining: 0, nearExpiryCount: 0 }
    )
  }, [rows])

  const summaryRowByAdminId = useMemo(() => {
    return rows.reduce<Record<number, LeaveSummaryRow>>((acc, row) => {
      acc[row.admin_id] = row
      return acc
    }, {})
  }, [rows])

  const detailGroups = useMemo<LeaveDetailGroup[]>(() => {
    if (!selectedRow) return []

    const filteredItems = items.filter((item) => item.admin_id === selectedRow.admin_id)
    const grouped = filteredItems.reduce<Record<string, LeaveDetailGroup>>((acc, item) => {
      const key = item.memo || '기타'
      const grantedDays = toSafeNumber((item as any).granted_days)
      const consumedDays = toSafeNumber((item as any).consumed_days ?? (item as any).used_days)
      const remainingDaysRaw = (item as any).remaining_days
      const remainingDays =
        remainingDaysRaw == null ? Math.max(0, grantedDays - consumedDays) : toSafeNumber(remainingDaysRaw)

      if (!acc[key]) {
        acc[key] = {
          key,
          label: key,
          granted_days: 0,
          consumed_days: 0,
          remaining_days: 0,
          rows: [],
        }
      }

      acc[key].granted_days += grantedDays
      acc[key].consumed_days += consumedDays
      acc[key].remaining_days += remainingDays
      acc[key].rows.push(item)
      return acc
    }, {})

    return Object.values(grouped)
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => {
          const aTime = a.grant_date ? new Date(a.grant_date).getTime() : 0
          const bTime = b.grant_date ? new Date(b.grant_date).getTime() : 0
          return aTime - bTime
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
  }, [items, selectedRow])

  const openActionPanel = (row: LeaveSummaryRow, mode: ActionMode = 'use') => {
    setActionMode(mode)
    setSelectedRow(row)
    const initialGroups = items
      .filter((item) => item.admin_id === row.admin_id)
      .map((item) => item.memo || '기타')
    setExpandedGroups(initialGroups.length > 0 ? [initialGroups[0]] : [])
    setActionForm({
      days: mode === 'adjust' ? '1' : '',
      occurred_on: '',
      reason: '',
      memo: '',
    })
  }

  const closeActionPanel = () => {
    if (working === 'submit') return
    setActionMode(null)
    setSelectedRow(null)
    setExpandedGroups([])
  }

  const handleSubmitAction = async () => {
    if (!selectedRow || !actionMode) return
    const parsedDays = Number(actionForm.days)

    if (!Number.isFinite(parsedDays) || parsedDays === 0) {
      toast.error('일수를 입력해 주세요')
      return
    }

    if (actionMode === 'use' && parsedDays <= 0) {
      toast.error('사용 처리는 양수만 입력할 수 있습니다')
      return
    }

    try {
      setWorking('submit')
      if (actionMode === 'use') {
        await useClientAnnualLeave({
          admin_id: selectedRow.admin_id,
          days: parsedDays,
          occurred_on: actionForm.occurred_on || undefined,
          reason: actionForm.reason || undefined,
          memo: actionForm.memo || undefined,
        })
      } else {
        await adjustClientAnnualLeave({
          admin_id: selectedRow.admin_id,
          days: parsedDays,
          occurred_on: actionForm.occurred_on || undefined,
          reason: actionForm.reason || undefined,
          memo: actionForm.memo || undefined,
        })
      }
      toast.success('연차 처리 완료')
      closeActionPanel()
      await loadLeaves(year, keyword)
    } catch (error) {
      toast.error(getClientAnnualLeaveErrorMessage(error))
    } finally {
      setWorking(null)
    }
  }

  if (sessionLoading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!canManage) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">권한이 없습니다</div>
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">재직 직원</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatNumber(dashboardStats.staffCount)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">총 잔여 연차</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatNumber(dashboardStats.totalRemaining)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm text-rose-600">30일 내 만료 예정</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{formatNumber(dashboardStats.nearExpiryCount)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_320px_minmax(0,1fr)]">
          <select
            className={inputClass}
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">전체 현황</option>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}년
              </option>
            ))}
          </select>
          <UiSearchInput
            placeholder="직원명 검색"
            value={keyword}
            onChange={setKeyword}
            wrapperClassName="w-full md:w-[320px]"
            inputClassName="text-sm text-zinc-900"
          />
          <div aria-hidden="true" />
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <div className="flex items-center justify-between gap-3">
            <p>입사일 기준 자동 부여, 오래된 연차부터 먼저 차감됩니다.</p>
            <UiButton
              onClick={() => setShowPolicy((prev) => !prev)}
              variant="secondary"
              size="xs"
            >
              {showPolicy ? '정책 접기' : '정책 보기'}
            </UiButton>
          </div>
          {showPolicy ? (
            <div className="grid gap-1 text-sm text-zinc-600">
              <p>입사일 기준 월 단위 자동 부여</p>
              <p>1년 미만 월차 최대 11일</p>
              <p>1년 이상 15일, 3년차부터 2년마다 1일 가산(최대 25일)</p>
              <p>만근 가정(출근율 연동 없음)</p>
              <p>차감 순서: 오래된 연차 우선</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-left">이름</th>
              <th className="px-3 py-3 text-right">부여 연차</th>
              <th className="px-3 py-3 text-right">사용 연차</th>
              <th className="px-3 py-3 text-right">잔여 연차</th>
              <th className="px-3 py-3 text-center">가장 가까운 만료일</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  조회된 직원이 없습니다.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.admin_id}>
                  <td className="px-3 py-3 text-left font-medium text-zinc-900">
                    <button
                      type="button"
                      onClick={() => openActionPanel(row)}
                      className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                    >
                      {row.admin_name}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.granted_days)}</td>
                  <td className="px-3 py-3 text-right">{formatNumber(row.consumed_days)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-zinc-900">{formatNumber(row.remaining_days)}</td>
                  <td className="px-3 py-3 text-center text-zinc-600">{formatDate(row.expired_at)}</td>
                  <td className="px-3 py-3 text-center">
                    {(() => {
                      const statusMeta = getLeaveStatusMeta(row)
                      return statusMeta.label === '-' ? (
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      ) : (
                        <span className={statusMeta.className}>{statusMeta.label}</span>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => openActionPanel(summaryRowByAdminId[row.admin_id] ?? row)}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      처리
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} limit={pageSize} onPageChange={setPage} />

      {actionMode && selectedRow ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">연차 처리</h2>
                <p className="mt-1 text-sm text-zinc-500">{selectedRow.admin_name}</p>
              </div>
              <button
                type="button"
                onClick={closeActionPanel}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-zinc-200 bg-white p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openActionPanel(selectedRow, 'use')}
                    className={
                      actionMode === 'use'
                        ? 'rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white'
                        : 'rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100'
                    }
                  >
                    사용 처리
                  </button>
                  <button
                    type="button"
                    onClick={() => openActionPanel(selectedRow, 'adjust')}
                    className={
                      actionMode === 'adjust'
                        ? 'rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white'
                        : 'rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100'
                    }
                  >
                    수동 보정
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-xs text-zinc-500">부여 연차</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">{formatNumber(selectedRow.granted_days)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-xs text-zinc-500">사용 연차</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">{formatNumber(selectedRow.consumed_days)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-xs text-zinc-500">잔여 연차</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">{formatNumber(selectedRow.remaining_days)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-zinc-900">연차 구분별 상세</h3>
                </div>
                <div className="divide-y divide-zinc-200">
                  {detailGroups.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-zinc-500">등록된 연차 상세가 없습니다.</div>
                  ) : (
                    detailGroups.map((group) => (
                      <div key={group.key}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroups((prev) =>
                              prev.includes(group.key) ? prev.filter((key) => key !== group.key) : [...prev, group.key]
                            )
                          }
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{group.label}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              부여 {formatNumber(group.granted_days)} / 사용 {formatNumber(group.consumed_days)} / 잔여 {formatNumber(group.remaining_days)}
                            </p>
                          </div>
                          <span className="text-sm text-zinc-500">{expandedGroups.includes(group.key) ? '접기' : '보기'}</span>
                        </button>
                        {expandedGroups.includes(group.key) ? (
                          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                            <div className="space-y-2">
                              {group.rows.map((item) => {
                                const detailRow = {
                                  remaining_days: toSafeNumber((item as any).remaining_days ?? toSafeNumber((item as any).granted_days) - toSafeNumber((item as any).consumed_days ?? (item as any).used_days)),
                                  expired_at: item.expired_at ?? null,
                                }
                                const statusMeta = getLeaveStatusMeta(detailRow)

                                return (
                                  <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr_90px_90px_90px_100px] md:items-center">
                                      <div>
                                        <p className="text-[11px] text-zinc-500">부여 연차</p>
                                        <p className="text-sm font-medium text-zinc-900">{formatNumber(item.granted_days)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-zinc-500">연차 적용기간</p>
                                        <p className="text-sm text-zinc-700">{formatPeriod(item.grant_date, item.expired_at)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-zinc-500">사용 연차</p>
                                        <p className="text-sm text-zinc-900">{formatNumber(toSafeNumber((item as any).consumed_days ?? (item as any).used_days))}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-zinc-500">잔여 연차</p>
                                        <p className="text-sm font-medium text-zinc-900">{formatNumber(detailRow.remaining_days)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-zinc-500">만료일</p>
                                        <p className="text-sm text-zinc-700">{formatDate(item.expired_at)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-zinc-500">상태</p>
                                        <span className={statusMeta.className}>{statusMeta.label}</span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">일수</label>
                    <input
                      type="number"
                      step="0.5"
                      className={inputClass}
                      value={actionForm.days}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, days: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">처리일</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={actionForm.occurred_on}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, occurred_on: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">사유</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={actionForm.reason}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">메모</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={actionForm.memo}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, memo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  {actionMode === 'use'
                    ? '사용 처리는 양수만 입력할 수 있습니다.'
                    : '+는 잔여 증가, -는 오래된 연차부터 차감됩니다.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeActionPanel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSubmitAction}
                disabled={working === 'submit'}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {working === 'submit' ? '처리 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
