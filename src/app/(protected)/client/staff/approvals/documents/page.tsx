'use client'

import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { toast } from 'react-hot-toast'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  fetchClientApprovalDocumentDetail,
  fetchClientApprovalDocuments,
  getClientApprovalAttachmentDownloadUrl,
  getClientApprovalDocumentErrorMessage,
  reviewClientApprovalDocument,
} from '@/services/client/clientApprovalDocumentService'
import {
  fetchClientAnnualLeaveRequests,
  getClientAnnualLeaveRequestErrorMessage,
  reviewClientAnnualLeaveCancelRequest,
  reviewClientAnnualLeaveRequest,
} from '@/services/client/clientAnnualLeaveRequestService'
import type { AdminOut } from '@/types/admin'
import type {
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentStatus,
  ApprovalDocumentType,
} from '@/types/approvalDocument'
import type { AnnualLeaveRequest, AnnualLeaveRequestStatus } from '@/types/annualLeaveRequest'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type UnifiedStatus = ApprovalDocumentStatus | AnnualLeaveRequestStatus

type UnifiedApprovalItem = {
  source: 'document' | 'leave'
  id: number
  document_no: string | null
  doc_type: string
  title: string
  status: UnifiedStatus
  submitted_at: string | null
  writer_admin_id: number
  created_at: string
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

function toSafeHtmlContent(content?: string | null) {
  const raw = String(content || '').trim()
  if (!raw) return '-'
  const hasTag = /<[^>]+>/.test(raw)
  const normalized = hasTag ? raw : raw.replace(/\n/g, '<br />')
  return DOMPurify.sanitize(normalized)
}

function getStatusMeta(status: UnifiedStatus) {
  if (status === 'approved') return { label: '승인', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'approved_canceled') return { label: '승인취소', className: 'bg-sky-100 text-sky-700' }
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  if (status === 'draft') return { label: '임시저장', className: 'bg-zinc-100 text-zinc-700' }
  return { label: '제출', className: 'bg-amber-100 text-amber-700' }
}

function getUnifiedStatusMeta(item: UnifiedApprovalItem) {
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

function isLeaveStatus(value: string): value is AnnualLeaveRequestStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'canceled' || value === 'approved_canceled'
}

const docTypeOptions: Array<{ value: ApprovalDocumentType | ''; label: string }> = [
  { value: '', label: '전체 문서' },
  { value: 'general', label: '일반 문서' },
  { value: 'report', label: '보고서' },
  { value: 'expense', label: '비용 문서' },
  { value: 'purchase', label: '구매 문서' },
  { value: 'equipment', label: '비품 문서' },
  { value: 'draft', label: '기안 문서' },
  { value: 'leave', label: '휴가 문서' },
]

export default function ClientApprovalDocumentsPage() {
  const [queueTab, setQueueTab] = useState<'my_pending' | 'processing'>('my_pending')
  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [allItems, setAllItems] = useState<UnifiedApprovalItem[]>([])
  const [status, setStatus] = useState<ApprovalDocumentStatus | ''>('pending')
  const [docType, setDocType] = useState<ApprovalDocumentType | ''>('')
  const [writerAdminId, setWriterAdminId] = useState<number | ''>('')
  const [onlyMyPending, setOnlyMyPending] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 20
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UnifiedApprovalItem | null>(null)
  const [detail, setDetail] = useState<ApprovalDocumentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reviewMode, setReviewMode] = useState<'approved' | 'rejected' | null>(null)
  const [comment, setComment] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [rejectedReason, setRejectedReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = allItems.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const items = useMemo(() => allItems.slice((page - 1) * limit, page * limit), [allItems, page])

  const loadStaffs = async () => {
    try {
      const pageLimit = 200
      let pageCursor = 1
      let totalCount = 0
      const merged: AdminOut[] = []

      do {
        const res = await getClientStaffs(pageCursor, pageLimit)
        merged.push(...(res.items || []))
        totalCount = res.total || 0
        pageCursor += 1
      } while (merged.length < totalCount)

      setStaffs((merged || []).filter((staff) => staff.is_active))
    } catch {
      toast.error('직원 목록을 불러오지 못했습니다.')
      setStaffs([])
    }
  }

  const fetchAllDocuments = async () => {
    const merged: ApprovalDocument[] = []
    const pageLimit = 200
    let offset = 0
    let totalCount = 0

    do {
      const res = await fetchClientApprovalDocuments({
        status,
        doc_type: docType === '' || docType === 'leave' ? '' : docType,
        writer_admin_id: typeof writerAdminId === 'number' ? writerAdminId : undefined,
        only_my_pending: onlyMyPending,
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
    if (status === 'draft') return []

    const pageLimit = 200
    const adminIdFilter = typeof writerAdminId === 'number' ? writerAdminId : undefined

    const fetchPaged = async (params: {
      status?: AnnualLeaveRequestStatus | ''
      cancel_status?: 'none' | 'pending' | 'approved' | 'rejected' | ''
    }) => {
      const merged: AnnualLeaveRequest[] = []
      let offset = 0
      let totalCount = 0

      do {
        const res = await fetchClientAnnualLeaveRequests({
          status: params.status || '',
          cancel_status: params.cancel_status || '',
          admin_id: adminIdFilter,
          offset,
          limit: pageLimit,
        })
        merged.push(...(res.items || []))
        totalCount = res.total || 0
        offset += pageLimit
      } while (merged.length < totalCount)

      return merged
    }

    if (status === 'pending') {
      const [pendingRequests, cancelPendingRequests] = await Promise.all([
        fetchPaged({ status: 'pending' }),
        fetchPaged({ status: '', cancel_status: 'pending' }),
      ])
      const deduped = new Map<number, AnnualLeaveRequest>()
      pendingRequests.forEach((item) => deduped.set(item.id, item))
      cancelPendingRequests.forEach((item) => deduped.set(item.id, item))
      return [...deduped.values()]
    }

    const leaveStatus = isLeaveStatus(status) ? status : ''
    return fetchPaged({ status: leaveStatus })
  }

  const loadItems = async () => {
    try {
      setLoading(true)
      const shouldLoadDocuments = docType !== 'leave'
      const shouldLoadLeaves = docType === '' || docType === 'leave'

      const [documents, leaveRequests] = await Promise.all([
        shouldLoadDocuments ? fetchAllDocuments() : Promise.resolve([]),
        shouldLoadLeaves ? fetchAllLeaveRequests() : Promise.resolve([]),
      ])

      const unifiedDocuments: UnifiedApprovalItem[] = documents.map((doc) => ({
        source: 'document',
        id: doc.id,
        document_no: doc.document_no,
        doc_type: doc.doc_type,
        title: doc.title,
        status: doc.status,
        submitted_at: doc.submitted_at ?? doc.created_at,
        writer_admin_id: doc.writer_admin_id,
        created_at: doc.created_at,
        locked_at: doc.locked_at,
        rawDocument: doc,
      }))

      const unifiedLeaves: UnifiedApprovalItem[] = leaveRequests.map((leave) => ({
        source: 'leave',
        id: leave.id,
        document_no: null,
        doc_type: 'leave',
        title: `휴가 신청 (${formatDate(leave.start_date)} ~ ${formatDate(leave.end_date)})`,
        status: leave.status,
        submitted_at: leave.created_at,
        writer_admin_id: leave.admin_id,
        created_at: leave.created_at,
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
      const docMessage = getClientApprovalDocumentErrorMessage(error)
      const leaveMessage = getClientAnnualLeaveRequestErrorMessage(error)
      toast.error(docType === 'leave' ? leaveMessage : docMessage)
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (documentId: number) => {
    try {
      setDetailLoading(true)
      const res = await fetchClientApprovalDocumentDetail(documentId)
      setDetail(res)
    } catch (error) {
      toast.error(getClientApprovalDocumentErrorMessage(error))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadStaffs()
  }, [])

  useEffect(() => {
    void loadItems()
  }, [status, docType, writerAdminId, onlyMyPending])

  useEffect(() => {
    setPage(1)
  }, [status, docType, writerAdminId, onlyMyPending])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!selectedItem || selectedItem.source !== 'document') return
    void loadDetail(selectedItem.id)
  }, [selectedItem])

  useEffect(() => {
    if (queueTab === 'my_pending') {
      setOnlyMyPending(true)
      setStatus('pending')
    } else {
      setOnlyMyPending(false)
      setStatus('pending')
    }
    setPage(1)
  }, [queueTab])

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === 'pending' || (item.source === 'leave' && item.rawLeave?.cancel_status === 'pending')).length,
    [items]
  )

  const currentApprover = useMemo(() => {
    if (!detail) return null
    return (
      [...detail.approvers]
        .filter((approver) => approver.status === 'pending')
        .sort((a, b) => a.step_order - b.step_order)[0] || null
    )
  }, [detail])

  const openReviewPanel = (item: UnifiedApprovalItem, mode: 'approved' | 'rejected') => {
    const isLeaveCancelReview = item.source === 'leave' && item.rawLeave?.cancel_status === 'pending'
    setSelectedItem(item)
    setReviewMode(mode)
    setComment('')
    setSignatureText('')
    setRejectedReason(
      item.source === 'leave'
        ? isLeaveCancelReview
          ? item.rawLeave?.cancel_review_note || ''
          : item.rawLeave?.reject_reason || ''
        : ''
    )
  }

  const closePanel = () => {
    if (submitting) return
    setSelectedItem(null)
    setDetail(null)
    setReviewMode(null)
    setComment('')
    setSignatureText('')
    setRejectedReason('')
  }

  const handleOpenAttachment = async (attachmentId: number, action: 'download' | 'preview') => {
    if (!detail) return
    try {
      const res = await getClientApprovalAttachmentDownloadUrl(detail.id, attachmentId, action)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getClientApprovalDocumentErrorMessage(error))
    }
  }

  const handleReview = async () => {
    if (!selectedItem || !reviewMode) return
    const isLeaveCancelReview = selectedItem.source === 'leave' && selectedItem.rawLeave?.cancel_status === 'pending'
    if (reviewMode === 'rejected' && !rejectedReason.trim()) {
      toast.error(isLeaveCancelReview ? '검토 메모를 입력해 주세요.' : '반려 사유를 입력해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      if (selectedItem.source === 'leave') {
        if (isLeaveCancelReview) {
          await reviewClientAnnualLeaveCancelRequest(selectedItem.id, {
            action: reviewMode,
            review_note: rejectedReason.trim() || undefined,
          })
          toast.success(reviewMode === 'approved' ? '휴가 취소 요청을 승인했습니다.' : '휴가 취소 요청을 반려했습니다.')
        } else {
          await reviewClientAnnualLeaveRequest(selectedItem.id, {
            action: reviewMode,
            reject_reason: reviewMode === 'rejected' ? rejectedReason.trim() : undefined,
          })
          toast.success(reviewMode === 'approved' ? '휴가 신청을 승인했습니다.' : '휴가 신청을 반려했습니다.')
        }
      } else {
        if (!detail) {
          toast.error('문서 상세를 불러온 뒤 다시 시도해 주세요.')
          return
        }
        await reviewClientApprovalDocument(detail.id, {
          action: reviewMode,
          comment: comment.trim() || undefined,
          signature_text: signatureText.trim() || undefined,
          rejected_reason: reviewMode === 'rejected' ? rejectedReason.trim() : undefined,
        })
        toast.success(reviewMode === 'approved' ? '문서를 승인했습니다.' : '문서를 반려했습니다.')
      }
      closePanel()
      await loadItems()
    } catch (error) {
      toast.error(
        selectedItem.source === 'leave'
          ? getClientAnnualLeaveRequestErrorMessage(error)
          : getClientApprovalDocumentErrorMessage(error)
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isSelectedLeaveCancelPending = selectedItem?.source === 'leave' && selectedItem.rawLeave?.cancel_status === 'pending'

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">{queueTab === 'my_pending' ? '내 결재함 문서 수' : '처리중 문서 수'}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">대기 문서</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">조회 모드</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{queueTab === 'my_pending' ? '내 결재함' : '처리중'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_180px_220px_minmax(0,1fr)]">
          <div className="inline-flex h-10 overflow-hidden rounded-md border border-zinc-300 bg-zinc-50">
            <button
              type="button"
              onClick={() => setQueueTab('my_pending')}
              className={`px-3 text-sm ${queueTab === 'my_pending' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              내 결재함
            </button>
            <button
              type="button"
              onClick={() => setQueueTab('processing')}
              className={`px-3 text-sm ${queueTab === 'processing' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
            >
              처리중
            </button>
          </div>
          <select className={inputClass} value={docType} onChange={(e) => setDocType((e.target.value as ApprovalDocumentType | '') || '')}>
            {docTypeOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={writerAdminId}
            onChange={(e) => setWriterAdminId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">전체 작성자</option>
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
              <th className="px-3 py-3 text-left">문서 종류</th>
              <th className="px-3 py-3 text-left">제목</th>
              <th className="px-3 py-3 text-left">작성자</th>
              <th className="px-3 py-3 text-center">상태</th>
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
                const writerName = staffs.find((staff) => staff.id === item.writer_admin_id)?.name || item.writer_admin_id
                const isLeaveCancelPending = item.source === 'leave' && item.rawLeave?.cancel_status === 'pending'
                const canReviewItem = item.status === 'pending' || isLeaveCancelPending
                return (
                  <tr key={`${item.source}-${item.id}`}>
                    <td className="px-3 py-3 text-left text-zinc-700">{docTypeLabels[item.doc_type] || item.doc_type}</td>
                    <td className="px-3 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item)
                          setReviewMode(null)
                          if (item.source !== 'document') setDetail(null)
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
                    <td className="px-3 py-3 text-left text-zinc-700">{writerName}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.submitted_at)}</td>
                    <td className="px-3 py-3 text-center">
                      {canReviewItem ? (
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

      {selectedItem ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {reviewMode ? (isSelectedLeaveCancelPending ? '휴가 취소요청 처리' : '결재 처리') : '결재 상세'}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{selectedItem.title}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
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
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-xs text-zinc-500">본문</p>
                    <div
                      className="mt-2 text-sm text-zinc-800"
                      dangerouslySetInnerHTML={{ __html: toSafeHtmlContent(detail.content) }}
                    />
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
                      {detail.approvers.map((approver) => (
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
                      ))}
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
                </>
              )}

              {reviewMode ? (
                selectedItem.source === 'leave' ? (
                  reviewMode === 'rejected' ? (
                    <div className="rounded-lg border border-zinc-200 bg-white p-4">
                      <label className="mb-1 block text-xs text-zinc-600">
                        {isSelectedLeaveCancelPending ? '검토 메모' : '반려 사유'}
                      </label>
                      <textarea
                        rows={4}
                        value={rejectedReason}
                        onChange={(e) => setRejectedReason(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        placeholder={isSelectedLeaveCancelPending ? '취소요청 반려 사유를 입력해 주세요.' : '반려 사유를 입력해 주세요.'}
                      />
                    </div>
                  ) : (
                    <>
                      {isSelectedLeaveCancelPending ? (
                        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                          승인 시 기존 차감 연차가 자동 복구되고, 원장에 복구 이력이 남습니다.
                        </div>
                      ) : (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          승인 시 서버에서 자동으로 오래된 연차부터 차감합니다.
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-600">결재 의견</label>
                        <textarea
                          rows={4}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          placeholder="결재 의견을 입력해 주세요."
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-600">서명 문구</label>
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          className={inputClass}
                          placeholder="비워두면 계정명으로 처리됩니다."
                        />
                      </div>
                      {reviewMode === 'rejected' ? (
                        <div>
                          <label className="mb-1 block text-xs text-zinc-600">반려 사유</label>
                          <textarea
                            rows={4}
                            value={rejectedReason}
                            onChange={(e) => setRejectedReason(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                            placeholder="반려 사유를 입력해 주세요."
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closePanel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
              {reviewMode ? (
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
