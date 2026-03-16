'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  fetchAdminWorkPostDetail,
  fetchAdminWorkPostInbox,
  getAdminWorkPostErrorMessage,
  setAdminWorkPostHidden,
  updateAdminWorkPostReceiptStatus,
} from '@/services/admin/workPostService'
import type {
  WorkPostDetail,
  WorkPostInboxItem,
  WorkPostReceiptStatus,
  WorkPostType,
} from '@/types/workPost'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

const postTypeOptions: Array<{ value: WorkPostType | ''; label: string }> = [
  { value: '', label: '전체 유형' },
  { value: 'notice', label: '공지' },
  { value: 'task', label: '업무지시' },
]

const receiptStatusOptions: Array<{ value: WorkPostReceiptStatus | ''; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'unread', label: '안읽음' },
  { value: 'read', label: '읽음' },
  { value: 'ack', label: '확인' },
  { value: 'in_progress', label: '진행중' },
  { value: 'done', label: '완료' },
]

const postTypeLabelMap: Record<WorkPostType, string> = {
  notice: '공지',
  task: '업무지시',
}

const receiptStatusLabelMap: Record<WorkPostReceiptStatus, string> = {
  unread: '안읽음',
  read: '읽음',
  ack: '확인',
  in_progress: '진행중',
  done: '완료',
}

const receiptStatusBadgeMap: Record<WorkPostReceiptStatus, string> = {
  unread: 'bg-sky-100 text-sky-700',
  read: 'bg-zinc-100 text-zinc-700',
  ack: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-indigo-100 text-indigo-700',
}

function formatDateTime(value?: string | null): string {
  return formatKSTDateTimeAssumeUTC(value)
}

export default function AdminWorkPostsInboxPage() {
  const searchParams = useSearchParams()

  const sourceType = (searchParams.get('source_type') || '').toLowerCase()
  const sourceId = Number(searchParams.get('source_id') || searchParams.get('post_id') || '')
  const isWorkPostSource =
    !sourceType ||
    sourceType === 'work_post' ||
    sourceType === 'work-post' ||
    sourceType === 'work_posts' ||
    sourceType === 'work-posts'
  const sourcePostId = Number.isFinite(sourceId) && sourceId > 0 && isWorkPostSource ? sourceId : null

  const [postType, setPostType] = useState<WorkPostType | ''>('')
  const [status, setStatus] = useState<WorkPostReceiptStatus | ''>('')
  const [page, setPage] = useState(1)
  const [size] = useState(12)

  const [items, setItems] = useState<WorkPostInboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [selectedPost, setSelectedPost] = useState<WorkPostDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState<Exclude<WorkPostReceiptStatus, 'unread'> | null>(null)
  const [hiding, setHiding] = useState(false)
  const noticeAutoReadReceiptRef = useRef<number | null>(null)

  const selectedInboxItem = useMemo(
    () => items.find((item) => item.post_id === selectedPostId) || null,
    [items, selectedPostId]
  )

  const totalPages = Math.max(1, Math.ceil(total / size))

  const loadInbox = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchAdminWorkPostInbox({
        page,
        size,
        post_type: postType,
        status,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, size, postType, status])

  const loadDetail = useCallback(async (postId: number) => {
    try {
      setDetailLoading(true)
      const detail = await fetchAdminWorkPostDetail(postId)
      setSelectedPost(detail)
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
      setSelectedPost(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    setPage(1)
  }, [postType, status])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!sourcePostId) return
    setSelectedPostId(sourcePostId)
  }, [sourcePostId])

  useEffect(() => {
    if (!selectedPostId) {
      setSelectedPost(null)
      return
    }
    void loadDetail(selectedPostId)
  }, [selectedPostId, loadDetail])

  const handleUpdateStatus = async (
    nextStatus: Exclude<WorkPostReceiptStatus, 'unread'>,
    options?: { silent?: boolean }
  ) => {
    if (!selectedPostId) return
    try {
      setStatusSubmitting(nextStatus)
      await updateAdminWorkPostReceiptStatus(selectedPostId, nextStatus)
      if (!options?.silent) toast.success('상태가 변경되었습니다.')
      await loadInbox()
      await loadDetail(selectedPostId)
    } catch (error) {
      if (!options?.silent) toast.error(getAdminWorkPostErrorMessage(error))
    } finally {
      setStatusSubmitting(null)
    }
  }

  useEffect(() => {
    if (!selectedPostId || !selectedPost || !selectedInboxItem) return
    if (selectedPost.post_type !== 'notice') return
    if (selectedInboxItem.status !== 'unread') return
    if (noticeAutoReadReceiptRef.current === selectedInboxItem.receipt_id) return

    noticeAutoReadReceiptRef.current = selectedInboxItem.receipt_id
    void handleUpdateStatus('read', { silent: true })
  }, [selectedPostId, selectedPost, selectedInboxItem])

  const handleHide = async () => {
    if (!selectedPostId) return
    if (!window.confirm('이 게시글을 수신함에서 숨기시겠습니까?')) return
    try {
      setHiding(true)
      await setAdminWorkPostHidden(selectedPostId, true)
      toast.success('게시글을 숨김 처리했습니다.')
      setSelectedPostId(null)
      setSelectedPost(null)
      await loadInbox()
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
    } finally {
      setHiding(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-neutral-900">공지/업무지시 수신함</h1>
        <p className="mt-1 text-sm text-neutral-500">수신한 공지/업무지시를 확인하고 상태를 변경합니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-2">
              <select className={inputClass} value={postType} onChange={(e) => setPostType(e.target.value as WorkPostType | '')}>
                {postTypeOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as WorkPostReceiptStatus | '')}>
                {receiptStatusOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">불러오는 중...</div>
              ) : items.length === 0 ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  수신한 게시글이 없습니다.
                </div>
              ) : (
                items.map((item) => {
                  const selected = selectedPostId === item.post_id
                  return (
                    <button
                      key={item.receipt_id}
                      type="button"
                      onClick={() => setSelectedPostId(item.post_id)}
                      className={`w-full rounded-md border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-500">{postTypeLabelMap[item.post_type]}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${receiptStatusBadgeMap[item.status]}`}>
                          {receiptStatusLabelMap[item.status]}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm font-semibold text-zinc-900">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">수신일 {formatDateTime(item.created_at)}</p>
                    </button>
                  )
                })
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {page} / {totalPages} 페이지 (총 {total}건)
              </span>
              <div className="flex items-center gap-1">
                <UiButton size="xs" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  이전
                </UiButton>
                <UiButton size="xs" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                  다음
                </UiButton>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {selectedPost?.post_type === 'notice'
                ? '공지글 상세'
                : selectedPost?.post_type === 'task'
                  ? '업무지시 상세'
                  : '게시글 상세'}
            </h2>
            {!selectedPostId ? (
              <p className="mt-2 text-sm text-zinc-500">왼쪽 목록에서 게시글을 선택해 주세요.</p>
            ) : detailLoading ? (
              <p className="mt-2 text-sm text-zinc-500">상세 정보를 불러오는 중...</p>
            ) : !selectedPost ? (
              <p className="mt-2 text-sm text-zinc-500">게시글 상세를 불러오지 못했습니다.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {(() => {
                  const isNoticePost = selectedPost.post_type === 'notice'
                  return (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{postTypeLabelMap[selectedPost.post_type]}</span>
                    {selectedInboxItem ? (
                      <span className={`rounded-full px-2 py-1 text-xs ${receiptStatusBadgeMap[selectedInboxItem.status]}`}>
                        {receiptStatusLabelMap[selectedInboxItem.status]}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {!isNoticePost ? (
                      <>
                        <UiButton size="xs" disabled={statusSubmitting !== null} onClick={() => void handleUpdateStatus('read')}>
                          읽음
                        </UiButton>
                        <UiButton size="xs" disabled={statusSubmitting !== null} onClick={() => void handleUpdateStatus('ack')}>
                          확인
                        </UiButton>
                        <UiButton size="xs" disabled={statusSubmitting !== null} onClick={() => void handleUpdateStatus('in_progress')}>
                          진행중
                        </UiButton>
                        <UiButton size="xs" disabled={statusSubmitting !== null} onClick={() => void handleUpdateStatus('done')}>
                          완료
                        </UiButton>
                      </>
                    ) : null}
                    <UiButton size="xs" variant="danger" disabled={hiding} onClick={() => void handleHide()}>
                      숨김
                    </UiButton>
                  </div>
                </div>
                  )
                })()}

                <div>
                  <p className="text-sm font-semibold text-zinc-900">{selectedPost.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    게시일 {formatDateTime(selectedPost.published_at)} · 마감일 {formatDateTime(selectedPost.due_at)}
                  </p>
                </div>

                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800"
                  dangerouslySetInnerHTML={{ __html: selectedPost.body_html }}
                />

                <div>
                  <p className="text-xs font-medium text-zinc-500">첨부파일</p>
                  <div className="mt-2 space-y-2">
                    {selectedPost.attachments.length === 0 ? (
                      <p className="text-sm text-zinc-500">첨부파일이 없습니다.</p>
                    ) : (
                      selectedPost.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-800">{attachment.file_name}</p>
                            <p className="text-xs text-zinc-500">버전 {attachment.version_no}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <UiButton
                              size="xs"
                              onClick={() => attachment.preview_url && window.open(attachment.preview_url, '_blank', 'noopener,noreferrer')}
                            >
                              미리보기
                            </UiButton>
                            <UiButton
                              size="xs"
                              onClick={() => attachment.download_url && window.open(attachment.download_url, '_blank', 'noopener,noreferrer')}
                            >
                              다운로드
                            </UiButton>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
