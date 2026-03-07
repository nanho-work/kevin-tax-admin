'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  cancelAnnualLeaveRequest,
  createAnnualLeaveRequest,
  fetchMyAnnualLeaveRequests,
} from '@/services/admin/annualLeaveRequestService'
import type { AnnualLeaveRequest, AnnualLeaveRequestStatus } from '@/types/annualLeaveRequest'

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
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  return { label: '대기', className: 'bg-amber-100 text-amber-700' }
}

type Props = {
  mode?: 'page' | 'panel'
  onClose?: () => void
  onSubmitted?: () => void | Promise<void>
}

export default function AdminLeaveRequestPanel({ mode = 'page', onClose, onSubmitted }: Props) {
  const [status, setStatus] = useState<AnnualLeaveRequestStatus | ''>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<AnnualLeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    is_half_day: false,
    start_date: '',
    end_date: '',
    reason: '',
  })

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadRequests = async (targetPage = page, targetStatus = status) => {
    try {
      setLoading(true)
      const offset = (targetPage - 1) * limit
      const res = await fetchMyAnnualLeaveRequests({
        status: targetStatus,
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
    loadRequests(page, status)
  }, [page, status])

  useEffect(() => {
    setPage(1)
  }, [status])

  const calculatedDays = useMemo(() => {
    if (form.is_half_day) return form.start_date ? 0.5 : 0
    return calculateInclusiveDays(form.start_date, form.end_date)
  }, [form.end_date, form.is_half_day, form.start_date])

  const canSubmit = useMemo(() => {
    return form.start_date && form.end_date && calculatedDays > 0
  }, [calculatedDays, form.end_date, form.start_date])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.start_date || !form.end_date) {
      toast.error('휴가 기간을 입력해 주세요.')
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
      await loadRequests(1, status)
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
      await loadRequests(page, status)
      await onSubmitted?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '휴가 신청 취소에 실패했습니다.')
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
              disabled={form.is_half_day}
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
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="예: 병원, 개인 일정"
            />
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
            <p className="mt-1 text-xs text-zinc-500">대기 상태일 때만 신청 취소가 가능합니다.</p>
          </div>
          <div className="w-full md:w-[180px]">
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus((e.target.value as AnnualLeaveRequestStatus | '') || '')}
            >
              <option value="">전체 상태</option>
              <option value="pending">대기</option>
              <option value="approved">승인</option>
              <option value="rejected">반려</option>
              <option value="canceled">취소</option>
            </select>
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
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
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
    </div>
  )

  if (mode === 'panel') {
    return (
      <div className="fixed inset-0 z-50 bg-black/30">
        <div className="absolute inset-y-0 right-0 w-full max-w-5xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
          <div className="px-6 py-5">{content}</div>
        </div>
      </div>
    )
  }

  return <section>{content}</section>
}
