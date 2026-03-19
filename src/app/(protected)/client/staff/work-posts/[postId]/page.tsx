'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import {
  deleteClientWorkPost,
  fetchClientWorkPostDetail,
  fetchClientWorkPostReceipts,
  getClientWorkPostErrorMessage,
  markClientWorkPostView,
} from '@/services/client/clientWorkPostService'
import type { WorkPostDetail, WorkPostReceipt } from '@/types/workPost'
import { getClientRoleRank } from '@/utils/roleRank'

const postTypeLabelMap = {
  notice: '공지사항',
  task: '업무지시',
} as const

const VIEW_MARK_DEDUPE_MS = 2500
const recentViewMarkAtByPostId = new Map<number, number>()

function formatKSTDate(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\.\s?$/, '')
}

export default function ClientWorkPostDetailPage() {
  const params = useParams<{ postId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { session } = useClientSessionContext()
  const postId = Number(params?.postId || '')

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [post, setPost] = useState<WorkPostDetail | null>(null)
  const [receipts, setReceipts] = useState<WorkPostReceipt[]>([])

  const backHref = useMemo(() => {
    const q = new URLSearchParams()
    const postType = (searchParams.get('post_type') || '').toLowerCase()
    if (postType === 'notice' || postType === 'task') q.set('post_type', postType)
    return `/client/staff/work-posts${q.toString() ? `?${q.toString()}` : ''}`
  }, [searchParams])

  const canManagePost = useMemo(() => {
    if (!post || !session) return false
    const isClientSuper = getClientRoleRank(session) === 0
    if (isClientSuper) return true
    return (
      post.created_by_type === 'client_account' &&
      Number(post.created_by_id || 0) === Number(session.account_id || 0)
    )
  }, [post, session])

  useEffect(() => {
    if (!Number.isFinite(postId) || postId <= 0) return
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const [detail, receiptRes] = await Promise.all([
          fetchClientWorkPostDetail(postId),
          fetchClientWorkPostReceipts(postId, { page: 1, size: 100 }),
        ])
        if (!mounted) return
        setPost(detail)
        setReceipts(receiptRes.items || [])
      } catch (error) {
        toast.error(getClientWorkPostErrorMessage(error))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [postId])

  useEffect(() => {
    if (!Number.isFinite(postId) || postId <= 0) return
    const now = Date.now()
    const lastMarkedAt = recentViewMarkAtByPostId.get(postId) || 0
    if (now - lastMarkedAt < VIEW_MARK_DEDUPE_MS) return
    recentViewMarkAtByPostId.set(postId, now)
    void markClientWorkPostView(postId).catch(() => {})
  }, [postId])

  const handleDelete = async () => {
    if (!canManagePost) {
      toast.error('수정/삭제 권한이 없습니다.')
      return
    }
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return
    try {
      setDeleting(true)
      await deleteClientWorkPost(postId)
      toast.success('게시글이 삭제되었습니다.')
      router.push(backHref)
    } catch (error) {
      toast.error(getClientWorkPostErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6 space-y-4">
      <div className="bg-white p-5">
        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : !post ? (
          <p className="text-sm text-zinc-500">게시글을 찾을 수 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {postTypeLabelMap[post.post_type]}
                </span>
                <p className="truncate text-sm font-semibold text-zinc-900">{post.title}</p>
              </div>
              <p className="shrink-0 text-xs text-zinc-600">
                작성일 {formatKSTDate(post.created_at)} | 마감일 {formatKSTDate(post.due_at)}
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

            <div>
              <p className="text-xs font-medium text-zinc-500">수신 현황</p>
              <p className="mt-1 text-sm text-zinc-700">총 {receipts.length}명</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-1">
        <div className="flex items-center justify-between gap-2">
          <UiButton variant="secondary" onClick={() => router.push(backHref)}>
            목록으로
          </UiButton>
          {canManagePost ? (
            <div className="flex items-center gap-2">
              <UiButton
                variant="secondary"
                onClick={() => router.push(`/client/staff/work-posts/${postId}/edit?post_type=${post?.post_type || 'notice'}`)}
              >
                수정
              </UiButton>
              <UiButton variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
                삭제
              </UiButton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
