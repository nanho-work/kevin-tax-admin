'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  cancelApprovalDocument,
  fetchApprovalDocumentDetail,
  fetchMyApprovalDocuments,
  getApprovalDocumentAttachmentDownloadUrl,
  getApprovalDocumentErrorMessage,
} from '@/services/admin/approvalDocumentService'
import type {
  ApprovalDocument,
  ApprovalDocumentDetail,
  ApprovalDocumentStatus,
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

export default function AdminMyDocumentsPage() {
  const [status, setStatus] = useState<ApprovalDocumentStatus | ''>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<ApprovalDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ApprovalDocumentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [canceling, setCanceling] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadDocuments = async (targetPage = page, targetStatus = status) => {
    try {
      setLoading(true)
      const offset = (targetPage - 1) * limit
      const res = await fetchMyApprovalDocuments({
        status: targetStatus,
        offset,
        limit,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
      setItems([])
      setTotal(0)
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
    loadDocuments(page, status)
  }, [page, status])

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    if (selectedId == null) return
    loadDetail(selectedId)
  }, [selectedId])

  const handleDownloadAttachment = async (attachmentId: number) => {
    if (!detail) return
    try {
      const res = await getApprovalDocumentAttachmentDownloadUrl(detail.id, attachmentId)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    }
  }

  const handleCancel = async (documentId: number) => {
    try {
      setCanceling(true)
      await cancelApprovalDocument(documentId)
      toast.success('문서를 취소했습니다.')
      if (selectedId === documentId) {
        setSelectedId(documentId)
        await loadDetail(documentId)
      }
      await loadDocuments(page, status)
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setCanceling(false)
    }
  }

  const draftOrPendingCount = useMemo(
    () => items.filter((item) => item.status === 'draft' || item.status === 'pending').length,
    [items]
  )

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">이번 페이지 문서 수</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">취소 가능 문서</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{draftOrPendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">선택 상태</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{status ? getStatusMeta(status).label : '전체'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <select className={inputClass} value={status} onChange={(e) => setStatus((e.target.value as ApprovalDocumentStatus | '') || '')}>
            <option value="">전체 상태</option>
            <option value="draft">임시저장</option>
            <option value="pending">상신</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="canceled">취소</option>
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
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">작성일</th>
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
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-left text-zinc-700">{docTypeLabels[item.doc_type] || item.doc_type}</td>
                    <td className="px-3 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.created_at)}</td>
                    <td className="px-3 py-3 text-center text-zinc-500">{formatDateTime(item.submitted_at)}</td>
                    <td className="px-3 py-3 text-center">
                      {item.status === 'draft' || item.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleCancel(item.id)}
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

      {selectedId !== null ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">결재 문서 상세</h2>
                <p className="mt-1 text-sm text-zinc-500">{detail?.title || '불러오는 중...'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null)
                  setDetail(null)
                }}
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
                      {detail.approvers.length === 0 ? (
                        <p className="text-sm text-zinc-500">설정된 결재선이 없습니다.</p>
                      ) : (
                        detail.approvers.map((approver) => (
                          <div key={approver.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-zinc-900">{approver.step_order}단계</span>
                              <span className="text-zinc-600">{approver.approver_type === 'client' ? '클라이언트 결재' : '직원 결재'}</span>
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              상태: {approver.status}
                              {approver.acted_at ? ` · 처리일 ${formatDateTime(approver.acted_at)}` : ''}
                            </div>
                            {approver.comment ? <div className="mt-1 text-xs text-zinc-600">의견: {approver.comment}</div> : null}
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
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
