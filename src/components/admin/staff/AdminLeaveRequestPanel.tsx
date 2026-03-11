'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  cancelAnnualLeaveRequest,
  createAnnualLeaveRequest,
  fetchMyAnnualLeaveRequests,
  requestCancelAnnualLeaveRequest,
} from '@/services/admin/annualLeaveRequestService'
import { fetchAnnualLeaves } from '@/services/admin/annualLeaveService'
import type { AnnualLeaveCancelStatus, AnnualLeaveRequest, AnnualLeaveRequestStatus } from '@/types/annualLeaveRequest'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function calculateInclusiveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const diff = end.getTime() - start.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}

function getStatusMeta(status: AnnualLeaveRequestStatus) {
  if (status === 'approved') return { label: '승인', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'approved_canceled') return { label: '승인취소', className: 'bg-sky-100 text-sky-700' }
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  return { label: '대기', className: 'bg-amber-100 text-amber-700' }
}

function getCancelStatusMeta(cancelStatus: AnnualLeaveCancelStatus) {
  if (cancelStatus === 'pending') return { label: '취소요청중', className: 'bg-amber-100 text-amber-700' }
  if (cancelStatus === 'approved') return { label: '취소승인', className: 'bg-emerald-100 text-emerald-700' }
  if (cancelStatus === 'rejected') return { label: '취소반려', className: 'bg-rose-100 text-rose-700' }
  return null
}

type RequestListTab = 'mine' | 'approved' | 'cancel_pending' | 'cancel_done'

function getQueryByTab(tab: RequestListTab): {
  status?: AnnualLeaveRequestStatus | ''
  cancel_status?: AnnualLeaveCancelStatus | ''
} {
  if (tab === 'approved') {
    return { status: 'approved', cancel_status: 'none' }
  }
  if (tab === 'cancel_pending') {
    return { status: 'approved', cancel_status: 'pending' }
  }
  if (tab === 'cancel_done') {
    return { status: 'approved_canceled', cancel_status: 'approved' }
  }
  return { status: '', cancel_status: '' }
}

type Props = {
  mode?: 'page' | 'panel'
  onClose?: () => void
  onSubmitted?: () => void | Promise<void>
}

export default function AdminLeaveRequestPanel({ mode = 'page', onClose, onSubmitted }: Props) {
  const [listTab, setListTab] = useState<RequestListTab>('mine')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<AnnualLeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelRequestTarget, setCancelRequestTarget] = useState<AnnualLeaveRequest | null>(null)
  const [cancelRequestReason, setCancelRequestReason] = useState('')
  const [cancelRequestSubmitting, setCancelRequestSubmitting] = useState(false)
  const [remainingDays, setRemainingDays] = useState<number | null>(null)
  const [remainingLoading, setRemainingLoading] = useState(false)
  const [remainingError, setRemainingError] = useState<string | null>(null)
  const [form, setForm] = useState({
    is_half_day: false,
    start_date: '',
    end_date: '',
    reason: '',
  })

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadRequests = async (targetPage = page, targetTab = listTab) => {
    try {
      setLoading(true)
      const offset = (targetPage - 1) * limit
      const query = getQueryByTab(targetTab)
      const res = await fetchMyAnnualLeaveRequests({
        status: query.status,
        cancel_status: query.cancel_status,
        offset,
        limit,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '휴가 신청 내역을 불러오지 못했습니다.')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests(page, listTab)
  }, [listTab, page])

  useEffect(() => {
    setPage(1)
  }, [listTab])

  const loadRemainingDays = async () => {
    try {
      setRemainingLoading(true)
      setRemainingError(null)
      const res = await fetchAnnualLeaves({ offset: 0, limit: 200 })
      const totalRemaining = (res.items || []).reduce((sum, item) => sum + Number(item.remaining_days || 0), 0)
      const normalized = Math.max(0, Math.round(totalRemaining * 10) / 10)
      setRemainingDays(normalized)
    } catch (error: any) {
      setRemainingDays(null)
      setRemainingError(error?.response?.data?.detail || '잔여 휴가를 불러오지 못했습니다.')
    } finally {
      setRemainingLoading(false)
    }
  }

  useEffect(() => {
    void loadRemainingDays()
  }, [])

  const calculatedDays = useMemo(() => {
    if (form.is_half_day) return form.start_date ? 0.5 : 0
    return calculateInclusiveDays(form.start_date, form.end_date)
  }, [form.end_date, form.is_half_day, form.start_date])

  const hasNoRemaining = useMemo(() => remainingDays !== null && remainingDays <= 0, [remainingDays])
  const exceedsRemaining = useMemo(
    () => remainingDays !== null && calculatedDays > 0 && calculatedDays > remainingDays,
    [calculatedDays, remainingDays]
  )
  const expectedRemaining = useMemo(() => {
    if (remainingDays === null) return null
    return Math.round((remainingDays - calculatedDays) * 10) / 10
  }, [calculatedDays, remainingDays])
  const isRequestDisabled = remainingLoading || hasNoRemaining

  const canSubmit = useMemo(() => {
    return Boolean(form.start_date && form.end_date && calculatedDays > 0 && !isRequestDisabled && !exceedsRemaining)
  }, [calculatedDays, exceedsRemaining, form.end_date, form.start_date, isRequestDisabled])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.start_date || !form.end_date) {
      toast.error('휴가 기간을 입력해 주세요.')
      return
    }

    if (remainingLoading) {
      toast.error('잔여 휴가를 확인 중입니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    if (hasNoRemaining) {
      toast.error('남은 휴가가 없어 신청할 수 없습니다.')
      return
    }
    if (exceedsRemaining) {
      toast.error('신청 일수가 남은 휴가보다 많습니다.')
      return
    }

    if (calculatedDays <= 0) {
      toast.error('휴가 일수를 계산할 수 없습니다.')
      return
    }

    try {
      setSubmitting(true)
      await createAnnualLeaveRequest({
        start_date: form.start_date,
        end_date: form.end_date,
        days: calculatedDays,
        reason: form.reason || undefined,
      })
      toast.success('휴가 신청이 등록되었습니다.')
      setForm({
        is_half_day: false,
        start_date: '',
        end_date: '',
        reason: '',
      })
      setPage(1)
      await loadRequests(1, listTab)
      await loadRemainingDays()
      await onSubmitted?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '휴가 신청 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (requestId: number) => {
    try {
      await cancelAnnualLeaveRequest(requestId)
      toast.success('휴가 신청을 취소했습니다.')
      await loadRequests(page, listTab)
      await onSubmitted?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '휴가 신청 취소에 실패했습니다.')
    }
  }

  const handleOpenCancelRequest = (item: AnnualLeaveRequest) => {
    setCancelRequestTarget(item)
    setCancelRequestReason('')
  }

  const handleSubmitCancelRequest = async () => {
    if (!cancelRequestTarget) return
    const reason = cancelRequestReason.trim()
    if (!reason) {
      toast.error('승인취소 요청 사유를 입력해 주세요.')
      return
    }

    try {
      setCancelRequestSubmitting(true)
      await requestCancelAnnualLeaveRequest(cancelRequestTarget.id, { reason })
      toast.success('승인취소 요청을 등록했습니다.')
      setCancelRequestTarget(null)
      setCancelRequestReason('')
      await loadRequests(page, listTab)
      await onSubmitted?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '승인취소 요청 등록에 실패했습니다.')
    } finally {
      setCancelRequestSubmitting(false)
    }
  }

  const content = (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">휴가신청</h1>
            <p className="mt-1 text-sm text-zinc-500">미래 휴가뿐 아니라 지난 날짜 기준 휴가도 신청할 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-2">
            {remainingLoading ? (
              <span className="inline-flex h-8 items-center rounded-full border border-zinc-200 bg-zinc-100 px-3 text-xs text-zinc-600">
                잔여 휴가 확인 중...
              </span>
            ) : hasNoRemaining ? (
              <span className="inline-flex h-8 items-center rounded-full border border-amber-300 bg-amber-100 px-3 text-xs font-medium text-amber-800">
                ⚠ 남은 휴가가 없어요
              </span>
            ) : null}
            {remainingError ? (
              <span className="text-xs text-rose-600">{remainingError}</span>
            ) : null}
          </div>
          {mode === 'panel' && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              닫기
            </button>
          ) : null}
        </div>

        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[120px_220px_220px_120px_minmax(0,1fr)]">
          <div>
            <label className="mb-1 block text-xs text-zinc-600">반차</label>
            <label className="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.is_half_day}
                disabled={isRequestDisabled}
                onChange={(e) =>
                  setForm((prev) => {
                    const nextHalfDay = e.target.checked
                    return {
                      ...prev,
                      is_half_day: nextHalfDay,
                      end_date: nextHalfDay ? prev.start_date : prev.end_date || prev.start_date,
                    }
                  })
                }
              />
              사용
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">시작일</label>
            <input
              type="date"
              className={inputClass}
              value={form.start_date}
              disabled={isRequestDisabled}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  start_date: e.target.value,
                  end_date: prev.is_half_day ? e.target.value : prev.end_date,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">종료일</label>
            <input
              type="date"
              className={
                form.is_half_day
                  ? `${inputClass} cursor-not-allowed bg-zinc-100 text-zinc-500`
                  : inputClass
              }
              value={form.end_date}
              disabled={form.is_half_day || isRequestDisabled}
              onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">사용 일수</label>
            <div className="flex h-10 items-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-700">
              {form.is_half_day ? '반차' : calculatedDays > 0 ? `${calculatedDays}일` : '-'}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">사유</label>
            <input
              type="text"
              className={inputClass}
              value={form.reason}
              disabled={isRequestDisabled}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="예: 병원, 개인 일정"
            />
          </div>
          <div className="xl:col-span-5 flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-4 text-zinc-700">
              <span>
                현재 잔여: <strong>{remainingDays !== null ? `${remainingDays}일` : '-'}</strong>
              </span>
              <span className={expectedRemaining !== null && expectedRemaining < 0 ? 'text-rose-700' : ''}>
                신청 후 예상 잔여: <strong>{expectedRemaining !== null ? `${expectedRemaining}일` : '-'}</strong>
              </span>
            </div>
            {exceedsRemaining ? (
              <span className="text-xs font-medium text-rose-600">신청 일수가 잔여 휴가를 초과했습니다.</span>
            ) : null}
          </div>
          <div className="xl:col-span-5 flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {submitting ? '신청 중...' : '휴가 신청'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">내 신청 내역</h2>
            <p className="mt-1 text-xs text-zinc-500">승인된 건은 승인취소 요청으로 처리됩니다.</p>
          </div>
          <div className="inline-flex h-10 overflow-hidden rounded-md border border-zinc-300 bg-zinc-50">
            <button
              type="button"
              onClick={() => setListTab('mine')}
              className={`px-3 text-sm ${listTab === 'mine' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              내 신청
            </button>
            <button
              type="button"
              onClick={() => setListTab('approved')}
              className={`px-3 text-sm ${listTab === 'approved' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => setListTab('cancel_pending')}
              className={`px-3 text-sm ${listTab === 'cancel_pending' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              취소요청중
            </button>
            <button
              type="button"
              onClick={() => setListTab('cancel_done')}
              className={`px-3 text-sm ${listTab === 'cancel_done' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              취소완료
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-3 text-left">신청일</th>
                <th className="px-3 py-3 text-left">휴가 기간</th>
                <th className="px-3 py-3 text-right">일수</th>
                <th className="px-3 py-3 text-left">사유</th>
                <th className="px-3 py-3 text-center">상태</th>
                <th className="px-3 py-3 text-center">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">신청 내역이 없습니다.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const statusMeta = getStatusMeta(item.status)
                  const cancelMeta = getCancelStatusMeta(item.cancel_status)
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-3 text-left text-zinc-600">{formatDateTime(item.created_at)}</td>
                      <td className="px-3 py-3 text-left text-zinc-900">
                        {formatDate(item.start_date)} ~ {formatDate(item.end_date)}
                      </td>
                      <td className="px-3 py-3 text-right text-zinc-900">{item.days}</td>
                      <td className="px-3 py-3 text-left text-zinc-600">
                        <div>{item.reason || '-'}</div>
                        {item.reject_reason ? <div className="mt-1 text-xs text-rose-600">반려 사유: {item.reject_reason}</div> : null}
                        {item.cancel_reason ? <div className="mt-1 text-xs text-amber-700">취소 요청 사유: {item.cancel_reason}</div> : null}
                        {item.cancel_review_note ? (
                          <div className="mt-1 text-xs text-zinc-600">검토 메모: {item.cancel_review_note}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                          {cancelMeta ? (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cancelMeta.className}`}>
                              {cancelMeta.label}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(item.id)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            신청 취소
                          </button>
                        ) : item.status === 'approved' && (item.cancel_status === 'none' || item.cancel_status === 'rejected') ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCancelRequest(item)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            {item.cancel_status === 'rejected' ? '취소 재요청' : '승인취소 요청'}
                          </button>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>

      {cancelRequestTarget ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">승인취소 요청</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatDate(cancelRequestTarget.start_date)} ~ {formatDate(cancelRequestTarget.end_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cancelRequestSubmitting) return
                  setCancelRequestTarget(null)
                  setCancelRequestReason('')
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <label className="mb-2 block text-xs text-zinc-600">요청 사유</label>
                <textarea
                  rows={6}
                  value={cancelRequestReason}
                  onChange={(e) => setCancelRequestReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  placeholder="예: 일정 변경, 중복 신청, 실제 미사용"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (cancelRequestSubmitting) return
                  setCancelRequestTarget(null)
                  setCancelRequestReason('')
                }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitCancelRequest}
                disabled={cancelRequestSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {cancelRequestSubmitting ? '요청 중...' : '요청 제출'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (mode === 'panel') {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.()
        }}
      >
        <div className="absolute inset-y-0 right-0 w-full max-w-5xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
          <div className="px-6 py-5">{content}</div>
        </div>
      </div>
    )
  }

  return <section>{content}</section>
}
