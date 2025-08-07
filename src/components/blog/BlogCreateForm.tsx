'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import '@toast-ui/editor/dist/toastui-editor.css'

const ToastEditor = dynamic(() => import('@toast-ui/react-editor').then(mod => mod.Editor), { ssr: false })

export default function BlogCreateForm() {
  const editorRef = useRef<any>(null)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [thumbnail, setThumbnail] = useState('')
  const [markdown, setMarkdown] = useState('')

  const handleSubmit = () => {
    const content = editorRef.current?.getInstance().getMarkdown()
    const blogData = {
      title,
      subtitle,
      summary,
      category,
      keywords,
      thumbnail,
      content,
    }
    console.log('입력된 블로그 데이터:', blogData)
  }

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="제목을 입력하세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2 w-full"
      />

      <input
        type="text"
        placeholder="서브 타이틀을 입력하세요"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="border p-2 w-full"
      />

      <textarea
        placeholder="요약(summary)을 입력하세요"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="border p-2 w-full"
        rows={3}
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border p-2 w-full"
      >
        <option value="">카테고리 선택</option>
        <option value="1">세무정보</option>
        <option value="2">사업운영</option>
      </select>

      <input
        type="text"
        placeholder="썸네일 이미지 URL 입력"
        value={thumbnail}
        onChange={(e) => setThumbnail(e.target.value)}
        className="border p-2 w-full"
      />

      <ToastEditor
        ref={editorRef}
        height="400px"
        initialEditType="wysiwyg"
        previewStyle="vertical"
        language="ko-KR"
        useCommandShortcut
        usageStatistics={false}
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        제출하기 (콘솔 확인용)
      </button>
    </div>
  )
}