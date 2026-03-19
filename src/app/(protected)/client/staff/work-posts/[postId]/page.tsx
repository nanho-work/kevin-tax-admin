'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  fetchClientWorkPostDetail,
  fetchClientWorkPostReceipts,
  getClientWorkPostErrorMessage,
} from '@/services/client/clientWorkPostService'
import type { WorkPostDetail, WorkPostReceipt } from '@/types/workPost'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const postTypeLabelMap = {
  notice: '공지사항',
  task: '업무지시',
} as const

const priorityLabelMap = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  critical: '긴급',
} as const

export default function ClientWorkPostDetailPage() {
  const params = useParams<{ postId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const postId = Number(params?.postId || '')

  const [loading, setLoading] = useState(false)
  const [post, setPost] = useState<WorkPostDetail | null>(null)
  const [receipts, setReceipts] = useState<WorkPostReceipt[]>([])

  const backHref = useMemo(() => {
    const q = new URLSearchParams()
    const postType = (searchParams.get('post_type') || '').toLowerCase()
    if (postType === 'notice' || postType === 'task') q.set('post_type', postType)
    return `/client/staff/work-posts${q.toString() ? `?${q.toString()}` : ''}`
  }, [searchParams])

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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">게시글 상세</h1>
          <p className="mt-1 text-sm text-neutral-500">게시글 내용을 확인합니다.</p>
        </div>
        <UiButton variant="secondary" onClick={() => router.push(backHref)}>
          목록으로
        </UiButton>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {loading ? (
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        ) : !post ? (
          <p className="text-sm text-zinc-500">게시글을 찾을 수 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <p className="text-zinc-600">유형: <span className="font-medium text-zinc-900">{postTypeLabelMap[post.post_type]}</span></p>
              <p className="text-zinc-600">우선순위: <span className="font-medium text-zinc-900">{priorityLabelMap[post.priority]}</span></p>
              <p className="text-zinc-600">작성일: <span className="font-medium text-zinc-900">{formatKSTDateTimeAssumeUTC(post.created_at)}</span></p>
              <p className="text-zinc-600">게시일: <span className="font-medium text-zinc-900">{formatKSTDateTimeAssumeUTC(post.published_at)}</span></p>
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-900">{post.title}</p>
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
    </section>
  )
}

