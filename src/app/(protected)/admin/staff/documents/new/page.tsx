'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  createApprovalDocument,
  getApprovalDocumentErrorMessage,
  uploadApprovalDocumentAttachment,
} from '@/services/admin/approvalDocumentService'
import type { ApprovalDocumentType } from '@/types/approvalDocument'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

const docTypeOptions: Array<{ value: ApprovalDocumentType; label: string }> = [
  { value: 'general', label: '일반 문서' },
  { value: 'report', label: '보고서' },
  { value: 'expense', label: '비용 문서' },
  { value: 'purchase', label: '구매 문서' },
  { value: 'equipment', label: '비품 문서' },
  { value: 'draft', label: '기안 문서' },
  { value: 'leave', label: '휴가 문서' },
]

export default function AdminDocumentCreatePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    doc_type: 'general' as ApprovalDocumentType,
    title: '',
    content: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null)

  const handleSubmit = async (submit: boolean) => {
    if (!form.title.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }

    try {
      setSubmitting(submit ? 'submit' : 'draft')
      const created = await createApprovalDocument({
        doc_type: form.doc_type,
        title: form.title.trim(),
        content: form.content.trim() || undefined,
        submit,
      })

      if (files.length > 0) {
        for (const file of files) {
          await uploadApprovalDocumentAttachment(created.id, file)
        }
      }

      toast.success(submit ? '결재 문서를 상신했습니다.' : '문서를 임시저장했습니다.')
      router.push('/admin/staff/documents')
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-neutral-900">문서작성</h1>
        <p className="mt-1 text-sm text-neutral-500">결재 문서를 작성하고 첨부를 올린 뒤 임시저장 또는 상신할 수 있습니다.</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-600">문서 종류</label>
            <select
              className={inputClass}
              value={form.doc_type}
              onChange={(e) => setForm((prev) => ({ ...prev, doc_type: e.target.value as ApprovalDocumentType }))}
            >
              {docTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">제목</label>
            <input
              type="text"
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="문서 제목을 입력해 주세요."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-600">본문</label>
          <textarea
            rows={12}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="결재 문서 내용을 입력해 주세요."
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-600">첨부파일</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className={inputClass}
          />
          {files.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((file) => (
                <span key={`${file.name}-${file.size}`} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting !== null}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {submitting === 'draft' ? '저장 중...' : '임시저장'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting !== null}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {submitting === 'submit' ? '상신 중...' : '상신하기'}
          </button>
        </div>
      </div>
    </section>
  )
}
