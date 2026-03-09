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

type ApproverRow = {
  id: number
  step_order: string
  approver_type: 'admin' | 'client'
  approver_id: string
}

export default function AdminDocumentCreatePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    doc_type: 'general' as ApprovalDocumentType,
    title: '',
    content: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [approvers, setApprovers] = useState<ApproverRow[]>([])
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null)

  const addApproverRow = () => {
    setApprovers((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 10000),
        step_order: String(prev.length + 1),
        approver_type: 'client',
        approver_id: '',
      },
    ])
  }

  const updateApproverRow = (id: number, patch: Partial<ApproverRow>) => {
    setApprovers((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeApproverRow = (id: number) => {
    setApprovers((prev) => prev.filter((row) => row.id !== id))
  }

  const buildApproversPayload = () => {
    if (approvers.length === 0) return undefined

    const parsed = approvers.map((row) => {
      const step = Number(row.step_order)
      const approverId = Number(row.approver_id)
      return {
        raw: row,
        step,
        approverId,
      }
    })

    if (parsed.some((item) => !Number.isInteger(item.step) || item.step <= 0)) {
      toast.error('결재 단계는 1 이상의 정수로 입력해 주세요.')
      return null
    }

    const stepSet = new Set(parsed.map((item) => item.step))
    if (stepSet.size !== parsed.length) {
      toast.error('결재 단계(step_order)는 중복될 수 없습니다.')
      return null
    }

    for (const item of parsed) {
      if (!Number.isInteger(item.approverId) || item.approverId <= 0) {
        toast.error('결재자 ID는 1 이상의 숫자로 입력해 주세요.')
        return null
      }
    }

    return parsed
      .sort((a, b) => a.step - b.step)
      .map((item) =>
        item.raw.approver_type === 'admin'
          ? {
              step_order: item.step,
              approver_type: 'admin' as const,
              approver_admin_id: item.approverId,
            }
          : {
              step_order: item.step,
              approver_type: 'client' as const,
              approver_client_account_id: item.approverId,
            }
      )
  }

  const handleSubmit = async (submit: boolean) => {
    if (!form.title.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }

    const approversPayload = buildApproversPayload()
    if (approversPayload === null) return

    try {
      setSubmitting(submit ? 'submit' : 'draft')
      const created = await createApprovalDocument({
        doc_type: form.doc_type,
        title: form.title.trim(),
        content: form.content.trim() || undefined,
        approvers: approversPayload,
        submit,
      })

      if (files.length > 0) {
        for (const file of files) {
          await uploadApprovalDocumentAttachment(created.id, file)
        }
      }

      toast.success(submit ? '결재 문서를 제출했습니다.' : '문서를 임시저장했습니다.')
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
        <p className="mt-1 text-sm text-neutral-500">결재 문서를 작성하고 첨부를 올린 뒤 임시저장 또는 제출할 수 있습니다.</p>
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

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">결재선</p>
              <p className="mt-1 text-xs text-zinc-500">
                단계, 결재자 유형, 결재자 ID를 입력합니다. 비워두면 기본 결재선(클라이언트 1단계)이 적용됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={addApproverRow}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              결재선 추가
            </button>
          </div>

          {approvers.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-3 text-xs text-zinc-500">
              등록된 결재선이 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {approvers.map((row) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[110px_140px_minmax(0,1fr)_88px]">
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={row.step_order}
                    onChange={(e) => updateApproverRow(row.id, { step_order: e.target.value })}
                    placeholder="단계"
                  />
                  <select
                    className={inputClass}
                    value={row.approver_type}
                    onChange={(e) => updateApproverRow(row.id, { approver_type: e.target.value as 'admin' | 'client' })}
                  >
                    <option value="client">클라이언트</option>
                    <option value="admin">직원</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={row.approver_id}
                    onChange={(e) => updateApproverRow(row.id, { approver_id: e.target.value })}
                    placeholder={row.approver_type === 'admin' ? '직원 ID 입력' : '클라이언트 계정 ID 입력'}
                  />
                  <button
                    type="button"
                    onClick={() => removeApproverRow(row.id)}
                    className="h-10 rounded-md border border-zinc-300 px-3 text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
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
            {submitting === 'submit' ? '제출 중...' : '제출'}
          </button>
        </div>
      </div>
    </section>
  )
}
