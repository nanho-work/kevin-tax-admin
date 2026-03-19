'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  fetchAdminWorkPostDetail,
  getAdminWorkPostErrorMessage,
  markAdminWorkPostView,
  setAdminWorkPostHidden,
  updateAdminWorkPostReceiptStatus,
} from '@/services/admin/workPostService'
import type { WorkPostDetail, WorkPostReceiptStatus } from '@/types/workPost'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const postTypeLabelMap = {
  notice: '공지사항',
  task: '업무지시',
} as const

const VIEW_MARK_DEDUPE_MS = 2500
const recentViewMarkAtByPostId = new Map<number, number>()

export default function AdminWorkPostDetailPage() {
  const params = useParams<{ postId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const postId = Number(params?.postId || '')

  const [loading, setLoading] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState<Exclude<WorkPostReceiptStatus, 'unread'> | null>(null)
  const [hiding, setHiding] = useState(false)
  const [post, setPost] = useState<WorkPostDetail | null>(null)

  const backHref = useMemo(() => {
    const q = new URLSearchParams()
    const postType = (searchParams.get('post_type') || '').toLowerCase()
    if (postType === 'notice' || postType === 'task') q.set('post_type', postType)
    return `/admin/staff/work-posts${q.toString() ? `?${q.toString()}` : ''}`
  }, [searchParams])

  const loadDetail = async () => {
    if (!Number.isFinite(postId) || postId <= 0) return
    try {
      setLoading(true)
      const detail = await fetchAdminWorkPostDetail(postId)
      setPost(detail)
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDetail()
  }, [postId])

  useEffect(() => {
    if (!post || post.post_type !== 'notice') return
    void updateAdminWorkPostReceiptStatus(postId, 'read').catch(() => {})
  }, [post, postId])

  useEffect(() => {
    if (!Number.isFinite(postId) || postId <= 0) return
    const now = Date.now()
    const lastMarkedAt = recentViewMarkAtByPostId.get(postId) || 0
    if (now - lastMarkedAt < VIEW_MARK_DEDUPE_MS) return
    recentViewMarkAtByPostId.set(postId, now)
    void markAdminWorkPostView(postId).catch(() => {})
  }, [postId])

  const handleUpdateStatus = async (
    nextStatus: Exclude<WorkPostReceiptStatus, 'unread'>,
  ) => {
    try {
      setStatusSubmitting(nextStatus)
      await updateAdminWorkPostReceiptStatus(postId, nextStatus)
      toast.success('상태가 변경되었습니다.')
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
    } finally {
      setStatusSubmitting(null)
    }
  }

  const handleHide = async () => {
    if (!window.confirm('이 게시글을 수신함에서 숨기시겠습니까?')) return
    try {
      setHiding(true)
      await setAdminWorkPostHidden(postId, true)
      toast.success('게시글을 숨김 처리했습니다.')
      router.push(backHref)
    } catch (error) {
      toast.error(getAdminWorkPostErrorMessage(error))
    } finally {
      setHiding(false)
    }
  }

  return (
    <section className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6 space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : !post ? (
          <p className="text-sm text-zinc-500">게시글을 찾을 수 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{postTypeLabelMap[post.post_type]}</span>
            </div>
            {post.post_type === 'task' ? (
              <div className="flex flex-wrap items-center gap-1">
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
              </div>
            ) : null}
            <div className="flex items-center">
              <UiButton size="xs" variant="danger" disabled={hiding} onClick={() => void handleHide()}>
                숨김
              </UiButton>
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-900">{post.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                게시일 {formatKSTDateTimeAssumeUTC(post.published_at)} · 마감일 {formatKSTDateTimeAssumeUTC(post.due_at)}
              </p>
            </div>

            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800"
              dangerouslySetInnerHTML={{ __html: post.body_html }}
            />

            <div>
              <p className="text-xs font-medium text-zinc-500">첨부파일</p>
              <div className="mt-2 space-y-2">
                {post.attachments.length === 0 ? (
                  <p className="text-sm text-zinc-500">첨부파일이 없습니다.</p>
                ) : (
                  post.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <p className="text-sm text-zinc-800">{attachment.file_name}</p>
                      <div className="flex items-center gap-1">
                        <UiButton size="xs" onClick={() => attachment.preview_url && window.open(attachment.preview_url, '_blank', 'noopener,noreferrer')}>
                          미리보기
                        </UiButton>
                        <UiButton size="xs" onClick={() => attachment.download_url && window.open(attachment.download_url, '_blank', 'noopener,noreferrer')}>
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

      <div className="px-1">
        <UiButton variant="secondary" onClick={() => router.push(backHref)}>
          목록으로
        </UiButton>
      </div>
    </section>
  )
}
