'use client'

import { useEffect, useState } from 'react'

// 서비스 & 타입 임포트
import { blogService } from '@/services/blogService'
import type {
  BlogCategoryResponse,
  KeywordResponse,
  BlogPostCreate,
} from '@/types/blog'

import TiptapEditor from '../editor/TiptapEditor'

// 간단 슬러그 변환 (제목 → slug). 백엔드가 자동 생성한다면 빈 문자열로 넘겨도 됨.
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-가-힣]/g, '') // 허용 문자만 남김(한글 허용)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function BlogCreateForm() {
  // 폼 상태
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [keywordIds, setKeywordIds] = useState<number[]>([])
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [content, setContent] = useState('')

  // 보조 데이터
  const [categories, setCategories] = useState<BlogCategoryResponse[]>([])
  const [keywords, setKeywords] = useState<KeywordResponse[]>([])

  // 진행 상태
  const [loading, setLoading] = useState(false)

  // 초기 로드: 카테고리/키워드 목록 불러오기
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

  // 썸네일 업로드 (S3)
  // 기존 코드 일부
  const handleThumbnailFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setLoading(true)

      const oldUrl = thumbnailUrl; // 현재 썸네일 URL을 잠깐 보관

      // 1) 새 파일 업로드
      const res = await blogService.uploadThumbnail(file)

      // 2) 성공하면 상태 갱신
      setThumbnailUrl(res.thumbnail_url)

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
      alert('썸네일 업로드에 실패했습니다.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('제목을 입력하세요.')
      return
    }
    if (!categoryId) {
      alert('카테고리를 선택하세요.')
      return
    }

    const payload: BlogPostCreate = {
      title,
      subtitle: subtitle || null,
      summary: summary || null,
      content_md: content,
      thumbnail_url: thumbnailUrl || null,
      category_id: Number(categoryId),
      // 백엔드에서 자동 생성 로직이 있다면 빈 문자열로 넘기거나 제거 가능
      slug: slugify(title) || 'post',
      status: 'draft',
      published_at: null,
      keyword_ids: keywordIds,
      // author_name은 서버에서 토큰 기반으로 주입되므로 보내지 않음
    }

    try {
      setLoading(true)
      const created = await blogService.createPost(payload)
      alert('블로그 글이 생성되었습니다.')
      // 초기화
      setTitle('')
      setSubtitle('')
      setSummary('')
      setCategoryId('')
      setKeywordIds([])
      setThumbnailUrl('')
      setContent('')
    } catch (err: any) {
      console.error('생성 실패:', err)
      alert(err?.message || '생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setTitle('')
    setSubtitle('')
    setSummary('')
    setCategoryId('')
    setKeywordIds([])
    setThumbnailUrl('')
    setContent('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 카테고리 선택 (API 연동) */}
      <select
        name="category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
        className="border p-2 w-40"
      >
        <option value="">카테고리 선택</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="title"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2 w-full"
      />

      {/* 썸네일: 파일 업로드 + URL 직접 입력 */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={handleThumbnailFile} />
          {thumbnailUrl && (
            <a href={thumbnailUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
              업로드된 썸네일 보기
            </a>
          )}
        </div>
        <input
          type="hidden"
          name="thumbnailUrl"
          placeholder="썸네일 이미지 URL (직접 입력시 업로드 URL을 덮어씁니다)"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      {/* Tiptap 에디터 */}
      <TiptapEditor value={content} onChange={setContent} />

      {/* 키워드 선택 (체크박스) */}
      {keywords.length > 0 && (
        <div className="border p-3 rounded">
          <div className="mb-2 text-sm text-gray-600">키워드 선택</div>
          <div className="flex flex-wrap gap-3">
            {keywords.map(kw => (
              <label key={kw.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`keyword_${kw.id}`}
                  checked={keywordIds.includes(kw.id)}
                  onChange={() => handleToggleKeyword(kw.id)}
                />
                <span>#{kw.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading ? '처리 중...' : '저장하기'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="bg-gray-300 text-black px-4 py-2 rounded"
        >
          취소
        </button>
      </div>
    </form>
  )
}