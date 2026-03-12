'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  cancelApprovalDocument,
  fetchApprovalDocumentDetail,
  fetchMyApprovalDocuments,
  getApprovalDocumentAttachmentDownloadUrl,
  getApprovalDocumentErrorMessage,
  reviewApprovalDocument,
} from '@/services/admin/approvalDocumentService'
import {
  cancelAnnualLeaveRequest,
  fetchMyAnnualLeaveRequests,
  requestCancelAnnualLeaveRequest,
} from '@/services/admin/annualLeaveRequestService'
import type {
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentStatus,
} from '@/types/approvalDocument'
import type { AnnualLeaveRequest, AnnualLeaveRequestStatus } from '@/types/annualLeaveRequest'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type UnifiedStatus = ApprovalDocumentStatus | AnnualLeaveRequestStatus
type FilterableLeaveStatus = Exclude<AnnualLeaveRequestStatus, 'approved_canceled'>

type UnifiedItem = {
  source: 'document' | 'leave'
  id: number
  document_no: string | null
  doc_type: string
  title: string
  status: UnifiedStatus
  created_at: string
  submitted_at: string | null
  locked_at: string | null
  rawDocument?: ApprovalDocument
  rawLeave?: AnnualLeaveRequest
}

const docTypeLabels: Record<string, string> = {
  leave: '휴가',
  equipment: '비품',
  purchase: '구매',
  report: '보고서',
  draft: '기안',
  expense: '비용',
  general: '일반',
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatDateTime(value?: string | null) {
  return formatKSTDateTimeAssumeUTC(value)
}

function getStatusMeta(status: UnifiedStatus) {
  if (status === 'approved') return { label: '승인', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'approved_canceled') return { label: '승인취소', className: 'bg-sky-100 text-sky-700' }
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  if (status === 'draft') return { label: '임시저장', className: 'bg-zinc-100 text-zinc-700' }
  return { label: '제출', className: 'bg-amber-100 text-amber-700' }
}

function getUnifiedStatusMeta(item: UnifiedItem) {
  if (item.source === 'leave' && item.rawLeave) {
    if (item.rawLeave.cancel_status === 'pending') {
      return { label: '취소요청', className: 'bg-amber-100 text-amber-700' }
    }
    if (item.rawLeave.cancel_status === 'approved' || item.rawLeave.status === 'approved_canceled') {
      return { label: '취소완료', className: 'bg-sky-100 text-sky-700' }
    }
    if (item.rawLeave.cancel_status === 'rejected') {
      return { label: '취소반려', className: 'bg-rose-100 text-rose-700' }
    }
  }
  return getStatusMeta(item.status)
}

function getApproverTypeLabel(type: string) {
  return type === 'client' ? '클라이언트 결재' : '직원 결재'
}

function getApproverStatusLabel(status: string) {
  if (status === 'approved') return '승인'
  if (status === 'rejected') return '반려'
  if (status === 'pending') return '대기'
  if (status === 'skipped') return '건너뜀'
  return status
}

function getShareTypeLabel(shareType: string) {
  return shareType === 'cc' ? '참조(CC)' : shareType === 'viewer' ? '열람자' : shareType
}

function getShareTargetTypeLabel(targetType: string) {
  if (targetType === 'admin') return '직원'
  if (targetType === 'team') return '팀'
  if (targetType === 'client_account') return '클라이언트 계정'
  return targetType
}

function getReceiptRecipientTypeLabel(type: string) {
  return type === 'admin' ? '직원' : type === 'client_account' ? '클라이언트 계정' : type
}

function getReceiptSourceTypeLabel(type: string) {
  if (type === 'writer') return '작성자'
  if (type === 'approver') return '결재자'
  if (type === 'cc') return '참조'
  if (type === 'viewer') return '열람자'
  return '시스템'
}

function isLeaveStatus(value: string): value is FilterableLeaveStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'canceled'
}

function canCancel(item: UnifiedItem, viewMode: 'mine' | 'pending') {
  if (viewMode === 'pending') return false
  if (item.source === 'leave') return item.status === 'pending'
  return item.status === 'draft' || item.status === 'pending'
}

function canRequestLeaveCancel(item: UnifiedItem, viewMode: 'mine' | 'pending') {
  if (viewMode !== 'mine' || item.source !== 'leave' || !item.rawLeave) return false
  return item.rawLeave.status === 'approved' && (item.rawLeave.cancel_status === 'none' || item.rawLeave.cancel_status === 'rejected')
}

function canReview(item: UnifiedItem, viewMode: 'mine' | 'pending') {
  return viewMode === 'pending' && item.source === 'document' && item.status === 'pending'
}

export default function AdminMyDocumentsPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'mine' | 'pending'>('mine')
  const [status, setStatus] = useState<ApprovalDocumentStatus | ''>('')
  const [page, setPage] = useState(1)
  const limit = 20
  const [allItems, setAllItems] = useState<UnifiedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null)
  const [detail, setDetail] = useState<ApprovalDocumentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [leaveCancelRequestTarget, setLeaveCancelRequestTarget] = useState<UnifiedItem | null>(null)
  const [leaveCancelReason, setLeaveCancelReason] = useState('')
  const [leaveCancelSubmitting, setLeaveCancelSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState<'approved' | 'rejected' | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [rejectedReason, setRejectedReason] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const total = allItems.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const items = useMemo(() => allItems.slice((page - 1) * limit, page * limit), [allItems, page])

  const fetchAllDocuments = async () => {
    const merged: ApprovalDocument[] = []
    const pageLimit = 200
    let offset = 0
    let totalCount = 0

    do {
      const res = await fetchMyApprovalDocuments({
        status,
        only_my_pending: viewMode === 'pending',
        offset,
        limit: pageLimit,
      })
      merged.push(...(res.items || []))
      totalCount = res.total || 0
      offset += pageLimit
    } while (merged.length < totalCount)

    return merged
  }

  const fetchAllLeaveRequests = async () => {
    if (viewMode === 'pending') return []
    if (status === 'draft') return []

    const merged: AnnualLeaveRequest[] = []
    const pageLimit = 200
    let offset = 0
    let totalCount = 0
    const leaveStatus = isLeaveStatus(status) ? status : ''

    do {
      const res = await fetchMyAnnualLeaveRequests({
        status: leaveStatus,
        offset,
        limit: pageLimit,
      })
      merged.push(...(res.items || []))
      totalCount = res.total || 0
      offset += pageLimit
    } while (merged.length < totalCount)

    return merged
  }

  const loadItems = async () => {
    try {
      setLoading(true)
      const [documents, leaves] = await Promise.all([
        fetchAllDocuments(),
        viewMode === 'mine' ? fetchAllLeaveRequests() : Promise.resolve([]),
      ])

      const unifiedDocuments: UnifiedItem[] = documents.map((doc) => ({
        source: 'document',
        id: doc.id,
        document_no: doc.document_no,
        doc_type: doc.doc_type,
        title: doc.title,
        status: doc.status,
        created_at: doc.created_at,
        submitted_at: doc.submitted_at,
        locked_at: doc.locked_at,
        rawDocument: doc,
      }))

      const unifiedLeaves: UnifiedItem[] = leaves.map((leave) => ({
        source: 'leave',
        id: leave.id,
        document_no: null,
        doc_type: 'leave',
        title: `휴가 신청 (${formatDate(leave.start_date)} ~ ${formatDate(leave.end_date)})`,
        status: leave.status,
        created_at: leave.created_at,
        submitted_at: leave.created_at,
        locked_at: null,
        rawLeave: leave,
      }))

      const merged = [...unifiedDocuments, ...unifiedLeaves].sort((a, b) => {
        const aTime = new Date(a.submitted_at || a.created_at).getTime()
        const bTime = new Date(b.submitted_at || b.created_at).getTime()
        return bTime - aTime
      })

      setAllItems(merged)
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (documentId: number) => {
    try {
      setDetailLoading(true)
      const res = await fetchApprovalDocumentDetail(documentId)
      setDetail(res)
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [status, viewMode])

  useEffect(() => {
    setPage(1)
  }, [status, viewMode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    setStatus(viewMode === 'pending' ? 'pending' : '')
    setSelectedItem(null)
    setDetail(null)
    setReviewMode(null)
    setReviewComment('')
    setRejectedReason('')
    setLeaveCancelRequestTarget(null)
    setLeaveCancelReason('')
  }, [viewMode])

  useEffect(() => {
    if (!selectedItem || selectedItem.source !== 'document') return
    void loadDetail(selectedItem.id)
  }, [selectedItem])

  const handleOpenAttachment = async (attachmentId: number, action: 'download' | 'preview') => {
    if (!detail) return
    try {
      const res = await getApprovalDocumentAttachmentDownloadUrl(detail.id, attachmentId, action)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    }
  }

  const handleCancel = async (item: UnifiedItem) => {
    try {
      setCanceling(true)
      if (item.source === 'leave') {
        await cancelAnnualLeaveRequest(item.id)
        toast.success('휴가 신청을 취소했습니다.')
      } else {
        await cancelApprovalDocument(item.id)
        toast.success('문서를 취소했습니다.')
      }
      await loadItems()
      if (selectedItem && selectedItem.source === item.source && selectedItem.id === item.id) {
        if (item.source === 'document') {
          await loadDetail(item.id)
        } else {
          setSelectedItem(null)
        }
      }
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setCanceling(false)
    }
  }

  const handleOpenLeaveCancelRequest = (item: UnifiedItem) => {
    setLeaveCancelRequestTarget(item)
    setLeaveCancelReason('')
  }

  const handleSubmitLeaveCancelRequest = async () => {
    if (!leaveCancelRequestTarget) return
    const reason = leaveCancelReason.trim()
    if (!reason) {
      toast.error('승인취소 요청 사유를 입력해 주세요.')
      return
    }

    try {
      setLeaveCancelSubmitting(true)
      await requestCancelAnnualLeaveRequest(leaveCancelRequestTarget.id, { reason })
      toast.success('승인취소 요청을 등록했습니다.')
      setLeaveCancelRequestTarget(null)
      setLeaveCancelReason('')
      await loadItems()
      if (selectedItem?.source === 'leave' && selectedItem.id === leaveCancelRequestTarget.id) {
        setSelectedItem(null)
      }
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setLeaveCancelSubmitting(false)
    }
  }

  const handleReview = async () => {
    if (!selectedItem || selectedItem.source !== 'document' || !detail || !reviewMode) return
    if (reviewMode === 'rejected' && !rejectedReason.trim()) {
      toast.error('반려 사유를 입력해 주세요.')
      return
    }

    try {
      setReviewing(true)
      await reviewApprovalDocument(detail.id, {
        action: reviewMode,
        comment: reviewComment.trim() || undefined,
        rejected_reason: reviewMode === 'rejected' ? rejectedReason.trim() : undefined,
      })
      toast.success(reviewMode === 'approved' ? '문서를 승인했습니다.' : '문서를 반려했습니다.')
      await loadItems()
      setSelectedItem(null)
      setDetail(null)
      setReviewMode(null)
      setReviewComment('')
      setRejectedReason('')
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setReviewing(false)
    }
  }

  const draftOrPendingCount = useMemo(
    () =>
      items.filter((item) =>
        viewMode === 'pending'
          ? canReview(item, viewMode)
          : canCancel(item, viewMode) || canRequestLeaveCancel(item, viewMode)
      ).length,
    [items, viewMode]
  )

  const currentApprover = useMemo(() => {
    if (!detail) return null
    return (
      [...detail.approvers]
        .filter((approver) => approver.status === 'pending')
        .sort((a, b) => a.step_order - b.step_order)[0] || null
    )
  }, [detail])

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">{viewMode === 'pending' ? '결재 대기 문서 수' : '이번 페이지 문서 수'}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">{viewMode === 'pending' ? '처리 가능 문서' : '취소 가능 문서'}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{draftOrPendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">선택 상태</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{status ? getStatusMeta(status).label : '전체'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_220px_minmax(0,1fr)_auto]">
          <div className="inline-flex h-10 overflow-hidden rounded-md border border-zinc-300 bg-zinc-50">
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-3 text-sm ${viewMode === 'mine' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              내 문서함
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pending')}
              className={`px-3 text-sm ${viewMode === 'pending' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              결재대기함
            </button>
          </div>
          <select className={inputClass} value={status} onChange={(e) => setStatus((e.target.value as ApprovalDocumentStatus | '') || '')}>
            <option value="">전체 상태</option>
            {viewMode === 'mine' ? <option value="draft">임시저장</option> : null}
            <option value="pending">제출</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            {viewMode === 'mine' ? <option value="canceled">취소</option> : null}
          </select>
          <div aria-hidden="true" />
          <button
            type="button"
            onClick={() => router.push('/admin/staff/documents/new')}
            className="h-10 rounded-md border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-700 hover:bg-sky-100"
          >
            문서 작성
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">문서 종류</th>
              <th className="px-3 py-3 text-left">제목</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">작성일</th>
              <th className="px-3 py-3 text-center">제출일</th>
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
                <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">문서가 없습니다.</td>
              </tr>
            ) : (
              items.map((item) => {
                const statusMeta = getUnifiedStatusMeta(item)
                return (
                  <tr key={`${item.source}-${item.id}`}>
                    <td className="px-3 py-3 text-left text-zinc-700">{docTypeLabels[item.doc_type] || item.doc_type}</td>
                    <td className="px-3 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item)
                          if (item.source !== 'document') setDetail(null)
                          setReviewMode(null)
                          setReviewComment('')
                          setRejectedReason('')
                        }}
                        className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </button>
                      {item.source === 'document' ? (
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <span>문서번호: {item.document_no || '-'}</span>
                          {item.locked_at ? <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] text-zinc-700">잠금</span> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.created_at)}</td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.submitted_at)}</td>
                    <td className="px-3 py-3 text-center">
                      {canReview(item, viewMode) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item)
                            setDetail(null)
                            setReviewMode('approved')
                          }}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          결재
                        </button>
                      ) : canRequestLeaveCancel(item, viewMode) ? (
                        <button
                          type="button"
                          onClick={() => handleOpenLeaveCancelRequest(item)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          승인취소 요청
                        </button>
                      ) : canCancel(item, viewMode) ? (
                        <button
                          type="button"
                          onClick={() => handleCancel(item)}
                          disabled={canceling}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                        >
                          취소
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

      {selectedItem !== null ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {reviewMode ? '결재 처리' : '결재 상세'}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{selectedItem.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null)
                  setDetail(null)
                  setReviewMode(null)
                  setReviewComment('')
                  setRejectedReason('')
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {selectedItem.source === 'leave' ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-zinc-500">문서 종류</p>
                      <p className="mt-1 text-sm font-medium text-zinc-900">휴가</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">상태</p>
                      <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getUnifiedStatusMeta(selectedItem).className}`}>
                        {getUnifiedStatusMeta(selectedItem).label}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">휴가 기간</p>
                      <p className="mt-1 text-sm text-zinc-700">
                        {formatDate(selectedItem.rawLeave?.start_date)} ~ {formatDate(selectedItem.rawLeave?.end_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">사용 일수</p>
                      <p className="mt-1 text-sm text-zinc-700">{selectedItem.rawLeave?.days ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">반영일</p>
                      <p className="mt-1 text-sm text-zinc-700">{formatDate(selectedItem.rawLeave?.occurred_on)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">신청일</p>
                      <p className="mt-1 text-sm text-zinc-700">{formatDateTime(selectedItem.rawLeave?.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-zinc-500">사유</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{selectedItem.rawLeave?.reason || '-'}</p>
                    {selectedItem.rawLeave?.reject_reason ? (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        반려 사유: {selectedItem.rawLeave.reject_reason}
                      </div>
                    ) : null}
                    {selectedItem.rawLeave?.cancel_reason ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        취소 요청 사유: {selectedItem.rawLeave.cancel_reason}
                      </div>
                    ) : null}
                    {selectedItem.rawLeave?.cancel_review_note ? (
                      <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        취소 검토 메모: {selectedItem.rawLeave.cancel_review_note}
                      </div>
                    ) : null}
                  </div>
                  {canRequestLeaveCancel(selectedItem, viewMode) ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenLeaveCancelRequest(selectedItem)}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                      >
                        승인취소 요청
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : detailLoading || !detail ? (
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">상세 조회 중...</div>
              ) : (
                <>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-zinc-500">문서번호</p>
                        <p className="mt-1 text-sm text-zinc-700">{detail.document_no || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">문서 종류</p>
                        <p className="mt-1 text-sm font-medium text-zinc-900">{docTypeLabels[detail.doc_type] || detail.doc_type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">상태</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusMeta(detail.status).className}`}>
                          {getStatusMeta(detail.status).label}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">작성일</p>
                        <p className="mt-1 text-sm text-zinc-700">{formatDateTime(detail.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">제출일</p>
                        <p className="mt-1 text-sm text-zinc-700">{formatDateTime(detail.submitted_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">잠금 시각</p>
                        <p className="mt-1 text-sm text-zinc-700">{formatDateTime(detail.locked_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">승인본 스냅샷 키</p>
                        <p className="mt-1 break-all text-sm text-zinc-700">{detail.snapshot_file_key || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">작성자</p>
                        <p className="mt-1 text-sm text-zinc-700">{detail.writer_name || `#${detail.writer_admin_id}`}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">작성자 팀</p>
                        <p className="mt-1 text-sm text-zinc-700">{detail.writer_team_name || (detail.writer_team_id ? `#${detail.writer_team_id}` : '-')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">작성자 부서</p>
                        <p className="mt-1 text-sm text-zinc-700">
                          {detail.writer_department_name || (detail.writer_department_id ? `#${detail.writer_department_id}` : '-')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">작성자 직급</p>
                        <p className="mt-1 text-sm text-zinc-700">{detail.writer_role_name || (detail.writer_role_id ? `#${detail.writer_role_id}` : '-')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">본문</p>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{detail.content || '-'}</div>
                    {detail.rejected_reason ? (
                      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        반려 사유: {detail.rejected_reason}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">결재선</p>
                    <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                      현재 단계:{' '}
                      {currentApprover
                        ? `${currentApprover.step_order}단계 · ${getApproverTypeLabel(currentApprover.approver_type)}`
                        : detail.status === 'approved'
                        ? '최종 승인 완료'
                        : detail.status === 'rejected'
                        ? '반려 완료'
                        : detail.status === 'canceled'
                        ? '취소 완료'
                        : '대기 단계 없음'}
                    </div>
                    <div className="mt-3 space-y-2">
                      {detail.approvers.length === 0 ? (
                        <p className="text-sm text-zinc-500">설정된 결재선이 없습니다.</p>
                      ) : (
                        detail.approvers.map((approver) => (
                          <div key={approver.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-zinc-900">{approver.step_order}단계</span>
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-600">{getApproverTypeLabel(approver.approver_type)}</span>
                                {currentApprover?.id === approver.id ? (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">현재 단계</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              상태: {getApproverStatusLabel(approver.status)}
                              {approver.acted_at ? ` · 처리일 ${formatDateTime(approver.acted_at)}` : ''}
                            </div>
                            {approver.comment ? <div className="mt-1 text-xs text-zinc-600">의견: {approver.comment}</div> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">참조/열람 공유</p>
                    <div className="mt-3 space-y-2">
                      {(detail.shares || []).length === 0 ? (
                        <p className="text-sm text-zinc-500">설정된 공유 대상이 없습니다.</p>
                      ) : (
                        (detail.shares || []).map((share) => (
                          <div key={share.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-zinc-900">{getShareTypeLabel(share.share_type)}</span>
                              <span className="text-xs text-zinc-500">{formatDateTime(share.created_at)}</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-600">
                              대상: {getShareTargetTypeLabel(share.target_type)} #{share.target_id}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">읽음 이력</p>
                    <div className="mt-3 space-y-2">
                      {(detail.read_receipts || []).length === 0 ? (
                        <p className="text-sm text-zinc-500">읽음 이력이 없습니다.</p>
                      ) : (
                        [...(detail.read_receipts || [])]
                          .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime())
                          .map((receipt) => (
                            <div key={receipt.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-zinc-900">
                                  {receipt.recipient_name || `${getReceiptRecipientTypeLabel(receipt.recipient_type)} #${receipt.recipient_id}`}
                                </span>
                                <span className="text-xs text-zinc-500">{formatDateTime(receipt.read_at)}</span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-600">권한 출처: {getReceiptSourceTypeLabel(receipt.source_type)}</p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">첨부파일</p>
                    <div className="mt-3 space-y-2">
                      {detail.attachments.length === 0 ? (
                        <p className="text-sm text-zinc-500">첨부파일이 없습니다.</p>
                      ) : (
                        detail.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900">
                                {attachment.file_name}
                                {!attachment.is_active ? (
                                  <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-normal text-zinc-700">이전 버전</span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                v{attachment.version_no} · 업로더 #{attachment.uploaded_by_admin_id ?? '-'} · {formatDateTime(attachment.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(attachment.id, 'preview')}
                                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                              >
                                미리보기
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(attachment.id, 'download')}
                                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                              >
                                다운로드
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {canReview(selectedItem, viewMode) ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewMode('approved')}
                          className={`rounded-md border px-3 py-2 text-sm ${
                            reviewMode === 'approved'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewMode('rejected')}
                          className={`rounded-md border px-3 py-2 text-sm ${
                            reviewMode === 'rejected'
                              ? 'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          반려
                        </button>
                      </div>

                      {reviewMode === 'rejected' ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs text-zinc-600">반려 사유</label>
                          <textarea
                            rows={3}
                            value={rejectedReason}
                            onChange={(e) => setRejectedReason(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            placeholder="반려 사유를 입력해 주세요."
                          />
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <label className="mb-1 block text-xs text-zinc-600">결재 의견</label>
                        <textarea
                          rows={2}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          placeholder="결재 의견을 입력해 주세요."
                        />
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewMode(null)
                            setReviewComment('')
                            setRejectedReason('')
                          }}
                          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          초기화
                        </button>
                        <button
                          type="button"
                          onClick={handleReview}
                          disabled={!reviewMode || reviewing}
                          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          {reviewing ? '처리 중...' : reviewMode === 'approved' ? '승인하기' : reviewMode === 'rejected' ? '반려하기' : '결재하기'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {leaveCancelRequestTarget ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">승인취소 요청</h2>
                <p className="mt-1 text-sm text-zinc-500">{leaveCancelRequestTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (leaveCancelSubmitting) return
                  setLeaveCancelRequestTarget(null)
                  setLeaveCancelReason('')
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
                  value={leaveCancelReason}
                  onChange={(e) => setLeaveCancelReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  placeholder="예: 일정 변경, 중복 신청, 실제 미사용"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (leaveCancelSubmitting) return
                  setLeaveCancelRequestTarget(null)
                  setLeaveCancelReason('')
                }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitLeaveCancelRequest}
                disabled={leaveCancelSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {leaveCancelSubmitting ? '요청 중...' : '요청 제출'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
