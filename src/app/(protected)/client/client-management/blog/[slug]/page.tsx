'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BlogDetail from '@/components/blog/BlogDetail'
import { blogService } from '@/services/blogService'
import type { BlogPostResponse } from '@/types/blog'

export default function ClientBlogDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const [post, setPost] = useState<BlogPostResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const response = await blogService.getPostBySlug(slug)
        setPost(response)
      } catch (error) {
        console.error('블로그 상세 조회 실패:', error)
        setPost(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [slug])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">포스트를 불러오는 중입니다.</h1>
      </div>
    )
  }

  if (!slug) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">잘못된 경로입니다.</h1>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">포스트를 찾을 수 없습니다.</h1>
      </div>
    )
  }

  return (
    <div className="p-6">
      <BlogDetail post={post} />
    </div>
  )
}
