'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  fetchClientAnnualLeaveRequests,
  getClientAnnualLeaveRequestErrorMessage,
  reviewClientAnnualLeaveRequest,
} from '@/services/client/clientAnnualLeaveRequestService'
import type { AdminOut } from '@/types/admin'
import type { AnnualLeaveRequest, AnnualLeaveRequestStatus } from '@/types/annualLeaveRequest'
import { getClientRoleRank } from '@/utils/roleRank'

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

function getStatusMeta(status: AnnualLeaveRequestStatus) {
  if (status === 'approved') return { label: '승인', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  return { label: '대기', className: 'bg-amber-100 text-amber-700' }
}

export default function ClientLeaveApprovalsPanel() {
  const { session, loading: sessionLoading } = useClientSessionContext()
  const canManage = getClientRoleRank(session) <= 10

  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [items, setItems] = useState<AnnualLeaveRequest[]>([])
  const [status, setStatus] = useState<AnnualLeaveRequestStatus | ''>('pending')
  const [adminId, setAdminId] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<AnnualLeaveRequest | null>(null)
  const [reviewMode, setReviewMode] = useState<'approved' | 'rejected' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadStaffs = async () => {
    try {
      const limit = 200
      let pageCursor = 1
      let totalCount = 0
      const merged: AdminOut[] = []

      do {
        const res = await getClientStaffs(pageCursor, limit)
        merged.push(...(res.items || []))
        totalCount = res.total || 0
        pageCursor += 1
      } while (merged.length < totalCount)

      setStaffs((merged || []).filter((staff) => staff.is_active))
    } catch (error) {
      toast.error('직원 목록을 불러오지 못했습니다.')
      setStaffs([])
    }
  }

  const loadRequests = async (targetPage = page, targetStatus = status, targetAdminId = adminId) => {
    try {
      setLoading(true)
      const offset = (targetPage - 1) * limit
      const res = await fetchClientAnnualLeaveRequests({
        status: targetStatus,
        admin_id: typeof targetAdminId === 'number' ? targetAdminId : undefined,
        offset,
        limit,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (error) {
      toast.error(getClientAnnualLeaveRequestErrorMessage(error))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManage) return
    loadStaffs()
  }, [canManage])

  useEffect(() => {
    if (!canManage) return
    loadRequests(page, status, adminId)
  }, [page, status, adminId, canManage])

  useEffect(() => {
    setPage(1)
  }, [status, adminId])

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items])

  const openReviewPanel = (item: AnnualLeaveRequest, mode: 'approved' | 'rejected') => {
    setSelectedItem(item)
    setReviewMode(mode)
    setRejectReason(item.reject_reason || '')
  }

  const closeReviewPanel = () => {
    if (submitting) return
    setSelectedItem(null)
    setReviewMode(null)
    setRejectReason('')
  }

  const handleReview = async () => {
    if (!selectedItem || !reviewMode) return
    if (reviewMode === 'rejected' && !rejectReason.trim()) {
      toast.error('반려 사유를 입력해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      await reviewClientAnnualLeaveRequest(selectedItem.id, {
        action: reviewMode,
        reject_reason: reviewMode === 'rejected' ? rejectReason.trim() : undefined,
      })
      toast.success(reviewMode === 'approved' ? '휴가 신청을 승인했습니다.' : '휴가 신청을 반려했습니다.')
      closeReviewPanel()
      await loadRequests(page, status, adminId)
    } catch (error) {
      toast.error(getClientAnnualLeaveRequestErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionLoading) {
    return <div className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">권한 확인 중...</div>
  }

  if (!canManage) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">권한이 없습니다.</div>
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">이번 페이지 신청 건수</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">대기 중</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">선택 상태</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {status === '' ? '전체' : getStatusMeta(status).label}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_240px_minmax(0,1fr)]">
          <select className={inputClass} value={status} onChange={(e) => setStatus((e.target.value as AnnualLeaveRequestStatus | '') || '')}>
            <option value="">전체 상태</option>
            <option value="pending">대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="canceled">취소</option>
          </select>
          <select
            className={inputClass}
            value={adminId}
            onChange={(e) => setAdminId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">전체 직원</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
          <div aria-hidden="true" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">신청자</th>
              <th className="px-3 py-3 text-left">휴가 기간</th>
              <th className="px-3 py-3 text-right">일수</th>
              <th className="px-3 py-3 text-left">반영일</th>
              <th className="px-3 py-3 text-left">사유</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">신청일</th>
              <th className="px-3 py-3 text-center">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">신청 내역이 없습니다.</td>
              </tr>
            ) : (
              items.map((item) => {
                const statusMeta = getStatusMeta(item.status)
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-left font-medium text-zinc-900">{item.admin_name || item.admin_id}</td>
                    <td className="px-3 py-3 text-left text-zinc-700">
                      {formatDate(item.start_date)} ~ {formatDate(item.end_date)}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-900">{item.days}</td>
                    <td className="px-3 py-3 text-left text-zinc-700">{formatDate(item.occurred_on)}</td>
                    <td className="px-3 py-3 text-left text-zinc-600">
                      <div>{item.reason || '-'}</div>
                      {item.reject_reason ? <div className="mt-1 text-xs text-rose-600">반려 사유: {item.reject_reason}</div> : null}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.created_at)}</td>
                    <td className="px-3 py-3 text-center">
                      {item.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openReviewPanel(item, 'approved')}
                            className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewPanel(item, 'rejected')}
                            className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            반려
                          </button>
                        </div>
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

      <div className="flex items-center justify-center gap-2">
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

      {selectedItem && reviewMode ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{reviewMode === 'approved' ? '휴가 신청 승인' : '휴가 신청 반려'}</h2>
                <p className="mt-1 text-sm text-zinc-500">{selectedItem.admin_name || selectedItem.admin_id}</p>
              </div>
              <button
                type="button"
                onClick={closeReviewPanel}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500">휴가 기간</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {formatDate(selectedItem.start_date)} ~ {formatDate(selectedItem.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">사용 일수</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{selectedItem.days}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">반영일</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(selectedItem.occurred_on)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">사유</p>
                    <p className="mt-1 text-sm text-zinc-700">{selectedItem.reason || '-'}</p>
                  </div>
                </div>
              </div>

              {reviewMode === 'rejected' ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <label className="mb-2 block text-xs text-zinc-600">반려 사유</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    placeholder="반려 사유를 입력해 주세요."
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  승인 시 서버에서 자동으로 오래된 연차부터 차감하고 ledger_entry_id를 연결합니다.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeReviewPanel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={submitting}
                className={
                  reviewMode === 'approved'
                    ? 'rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60'
                    : 'rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60'
                }
              >
                {submitting ? '처리 중...' : reviewMode === 'approved' ? '승인하기' : '반려하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
