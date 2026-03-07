'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  fetchClientApprovalDocumentDetail,
  fetchClientApprovalDocuments,
  getClientApprovalAttachmentDownloadUrl,
  getClientApprovalDocumentErrorMessage,
  reviewClientApprovalDocument,
} from '@/services/client/clientApprovalDocumentService'
import type { AdminOut } from '@/types/admin'
import type {
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentStatus,
  ApprovalDocumentType,
} from '@/types/approvalDocument'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

const docTypeLabels: Record<string, string> = {
  leave: '휴가',
  equipment: '비품',
  purchase: '구매',
  report: '보고서',
  draft: '기안',
  expense: '비용',
  general: '일반',
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function getStatusMeta(status: ApprovalDocumentStatus) {
  if (status === 'approved') return { label: '승인', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'rejected') return { label: '반려', className: 'bg-rose-100 text-rose-700' }
  if (status === 'canceled') return { label: '취소', className: 'bg-zinc-200 text-zinc-700' }
  if (status === 'draft') return { label: '임시저장', className: 'bg-zinc-100 text-zinc-700' }
  return { label: '상신', className: 'bg-amber-100 text-amber-700' }
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
  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [items, setItems] = useState<ApprovalDocument[]>([])
  const [status, setStatus] = useState<ApprovalDocumentStatus | ''>('pending')
  const [docType, setDocType] = useState<ApprovalDocumentType | ''>('')
  const [writerAdminId, setWriterAdminId] = useState<number | ''>('')
  const [onlyMyPending, setOnlyMyPending] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ApprovalDocumentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reviewMode, setReviewMode] = useState<'approved' | 'rejected' | null>(null)
  const [comment, setComment] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [rejectedReason, setRejectedReason] = useState('')
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

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * limit
      const res = await fetchClientApprovalDocuments({
        status,
        doc_type: docType,
        writer_admin_id: typeof writerAdminId === 'number' ? writerAdminId : undefined,
        only_my_pending: onlyMyPending,
        offset,
        limit,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (error) {
      toast.error(getClientApprovalDocumentErrorMessage(error))
      setItems([])
      setTotal(0)
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
    loadStaffs()
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [page, status, docType, writerAdminId, onlyMyPending])

  useEffect(() => {
    setPage(1)
  }, [status, docType, writerAdminId, onlyMyPending])

  useEffect(() => {
    if (selectedId == null) return
    loadDetail(selectedId)
  }, [selectedId])

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items])

  const openReviewPanel = (documentId: number, mode: 'approved' | 'rejected') => {
    setSelectedId(documentId)
    setReviewMode(mode)
    setComment('')
    setSignatureText('')
    setRejectedReason('')
  }

  const closePanel = () => {
    if (submitting) return
    setSelectedId(null)
    setDetail(null)
    setReviewMode(null)
    setComment('')
    setSignatureText('')
    setRejectedReason('')
  }

  const handleDownloadAttachment = async (attachmentId: number) => {
    if (!detail) return
    try {
      const res = await getClientApprovalAttachmentDownloadUrl(detail.id, attachmentId)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getClientApprovalDocumentErrorMessage(error))
    }
  }

  const handleReview = async () => {
    if (!detail || !reviewMode) return
    if (reviewMode === 'rejected' && !rejectedReason.trim()) {
      toast.error('반려 사유를 입력해 주세요.')
      return
    }

    try {
      setSubmitting(true)
      await reviewClientApprovalDocument(detail.id, {
        action: reviewMode,
        comment: comment.trim() || undefined,
        signature_text: signatureText.trim() || undefined,
        rejected_reason: reviewMode === 'rejected' ? rejectedReason.trim() : undefined,
      })
      toast.success(reviewMode === 'approved' ? '문서를 승인했습니다.' : '문서를 반려했습니다.')
      closePanel()
      await loadDocuments()
    } catch (error) {
      toast.error(getClientApprovalDocumentErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">이번 페이지 문서 수</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">대기 문서</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">내 대기 문서만</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{onlyMyPending ? '예' : '아니오'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_220px_auto]">
          <select className={inputClass} value={status} onChange={(e) => setStatus((e.target.value as ApprovalDocumentStatus | '') || '')}>
            <option value="">전체 상태</option>
            <option value="pending">상신</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="canceled">취소</option>
          </select>
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
          <label className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700">
            <input type="checkbox" checked={onlyMyPending} onChange={(e) => setOnlyMyPending(e.target.checked)} />
            내 대기 문서만 보기
          </label>
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
              <th className="px-3 py-3 text-center">상신일</th>
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
                const statusMeta = getStatusMeta(item.status)
                const writerName = staffs.find((staff) => staff.id === item.writer_admin_id)?.name || item.writer_admin_id
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-left text-zinc-700">{docTypeLabels[item.doc_type] || item.doc_type}</td>
                    <td className="px-3 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id)
                          setReviewMode(null)
                        }}
                        className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-left text-zinc-700">{writerName}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.submitted_at)}</td>
                    <td className="px-3 py-3 text-center">
                      {item.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openReviewPanel(item.id, 'approved')}
                            className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewPanel(item.id, 'rejected')}
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
          {page} / {Math.max(1, Math.ceil(total / limit))}
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

      {selectedId !== null ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{reviewMode ? '결재 처리' : '결재 문서 상세'}</h2>
                <p className="mt-1 text-sm text-zinc-500">{detail?.title || '불러오는 중...'}</p>
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
              {detailLoading || !detail ? (
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">상세 조회 중...</div>
              ) : (
                <>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                        <p className="text-xs text-zinc-500">상신일</p>
                        <p className="mt-1 text-sm text-zinc-700">{formatDateTime(detail.submitted_at)}</p>
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
                    <div className="mt-3 space-y-2">
                      {detail.approvers.map((approver) => (
                        <div key={approver.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-zinc-900">{approver.step_order}단계</span>
                            <span className="text-zinc-600">{approver.status}</span>
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
                              <p className="truncate text-sm font-medium text-zinc-900">{attachment.file_name}</p>
                              <p className="mt-1 text-xs text-zinc-500">{formatDateTime(attachment.created_at)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(attachment.id)}
                              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              다운로드
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {reviewMode ? (
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
                  ) : null}
                </>
              )}
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
