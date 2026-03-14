'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

// 서비스 & 타입 임포트
import { blogService } from '@/services/blogService'
import type {
  BlogCategoryResponse,
  KeywordResponse,
  BlogPostCreate,
} from '@/types/blog'

import RichTextEditor from '../editor/RichTextEditor'

// 간단 슬러그 변환 (제목 → slug). 백엔드가 자동 생성한다면 빈 문자열로 넘겨도 됨.
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-가-힣]/g, '') // 허용 문자만 남김(한글 허용)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function BlogCreateForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [keywordIds, setKeywordIds] = useState<number[]>([])
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [content, setContent] = useState('')

  // 보조 데이터
  const [categories, setCategories] = useState<BlogCategoryResponse[]>([])
  const [keywords, setKeywords] = useState<KeywordResponse[]>([])
  const [newKeyword, setNewKeyword] = useState('')

  const [saving, setSaving] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [creatingKeyword, setCreatingKeyword] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [cats, kws] = await Promise.all([
          blogService.listCategories(),
          blogService.listKeywords(),
        ])
        setCategories(cats)
        setKeywords(kws)
      } catch (e) {
        console.error('카테고리/키워드 로드 실패:', e)
      }
    })()
  }, [])

  const handleToggleKeyword = (id: number) => {
    setKeywordIds(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    )
  }

  const handleCreateKeyword = async () => {
    const name = newKeyword.trim()
    if (!name) {
      toast.error('키워드를 입력해 주세요.')
      return
    }

    const existing = keywords.find((keyword) => keyword.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) {
      setKeywordIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]))
      setNewKeyword('')
      toast.success('기존 키워드를 선택했습니다.')
      return
    }

    try {
      setCreatingKeyword(true)
      const created = await blogService.createKeyword({
        name,
        slug: slugify(name),
      })
      setKeywords((prev) => [...prev, created])
      setKeywordIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]))
      setNewKeyword('')
      toast.success('키워드가 추가되었습니다.')
    } catch (error: any) {
      console.error('키워드 생성 실패:', error)
      toast.error(error?.response?.data?.detail || '키워드 추가에 실패했습니다.')
    } finally {
      setCreatingKeyword(false)
    }
  }

  const handleThumbnailFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingThumbnail(true)

      const oldUrl = thumbnailUrl; // 현재 썸네일 URL을 잠깐 보관

      // 1) 새 파일 업로드
      const res = await blogService.uploadThumbnail(file)

      // 2) 성공하면 상태 갱신
      setThumbnailUrl(res.thumbnail_url)
      toast.success('썸네일 업로드 완료')

      // 3) 이전 파일이 있었다면 삭제 시도 (실패해도 UI는 계속 진행)
      if (oldUrl) {
        try {
          await blogService.deleteBodyImages([oldUrl])
        } catch (delErr) {
          console.warn('이전 썸네일 삭제 실패(무시):', delErr)
        }
      }
    } catch (err) {
      console.error('썸네일 업로드 실패:', err)
      toast.error('썸네일 업로드에 실패했습니다.')
    } finally {
      setUploadingThumbnail(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('제목을 입력하세요.')
      return
    }
    if (!categoryId) {
      toast.error('카테고리를 선택하세요.')
      return
    }
    if (!content.trim()) {
      toast.error('본문을 입력하세요.')
      return
    }

    const payload: BlogPostCreate = {
      title,
      content_md: content,
      thumbnail_url: thumbnailUrl || null,
      category_id: Number(categoryId),
      slug: slugify(title) || 'post',
      status: 'draft',
      published_at: null,
      keyword_ids: keywordIds,
    }

    try {
      setSaving(true)
      const created = await blogService.createPost(payload)
      toast.success('블로그 글이 생성되었습니다.')
      router.push(created.slug ? `/client/client-management/blog/${created.slug}` : '/client/client-management/blog/list')
    } catch (err: any) {
      console.error('생성 실패:', err)
      toast.error(err?.response?.data?.detail || err?.message || '생성 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    router.push('/client/client-management/blog/list')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">기본 정보</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-zinc-600">카테고리</label>
            <select
              name="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">카테고리 선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-9">
            <label className="mb-1 block text-xs font-medium text-zinc-600">제목</label>
            <input
              type="text"
              name="title"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div className="md:col-span-12">
            <label className="mb-1 block text-xs font-medium text-zinc-600">썸네일</label>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-100">
                {uploadingThumbnail ? '업로드 중...' : '이미지 선택'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailFile}
                  disabled={uploadingThumbnail}
                />
              </label>
              {thumbnailUrl ? (
                <>
                  <a href={thumbnailUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                    업로드된 썸네일 보기
                  </a>
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl('')}
                    className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                  >
                    썸네일 제거
                  </button>
                </>
              ) : (
                <span className="text-xs text-zinc-500">권장 비율 16:9</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">본문 작성</h2>
          <span className="text-xs text-zinc-500">붙여넣기 이미지 자동 업로드 지원</span>
        </div>
        <RichTextEditor value={content} onChange={setContent} preset="blog" />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">키워드</h2>
          <span className="text-xs text-zinc-500">선택됨 {keywordIds.length}개</span>
        </div>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreateKeyword()
              }
            }}
            placeholder="새 키워드 입력"
            className="h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <button
            type="button"
            onClick={() => void handleCreateKeyword()}
            disabled={creatingKeyword}
            className="h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {creatingKeyword ? '추가 중...' : '키워드 추가'}
          </button>
        </div>
        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => {
              const selected = keywordIds.includes(kw.id)
              return (
                <button
                  key={kw.id}
                  type="button"
                  onClick={() => handleToggleKeyword(kw.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  #{kw.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">등록된 키워드가 없습니다. 새 키워드를 추가해 주세요.</p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={saving || uploadingThumbnail}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
        >
          취소
        </button>
      </div>
    </form>
  )
}
