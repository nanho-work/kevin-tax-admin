'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import FileDropzone from '@/components/common/FileDropzone'
import UiButton from '@/components/common/UiButton'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  createClientWorkPost,
  getClientWorkPostErrorMessage,
  uploadClientWorkPostAttachment,
} from '@/services/client/clientWorkPostService'
import { getTeams } from '@/services/client/teamService'
import type { AdminOut } from '@/types/admin'
import type { TeamOut } from '@/types/team'
import type {
  WorkPostCreatePayload,
  WorkPostTargetIn,
  WorkPostTargetType,
  WorkPostType,
} from '@/types/workPost'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type TargetDraftRow = {
  rowId: string
  target_type: WorkPostTargetType
  target_id: string
}

const targetTypeOptions: Array<{ value: WorkPostTargetType; label: string }> = [
  { value: 'all_admin', label: '전체 직원' },
  { value: 'team', label: '팀' },
  { value: 'admin', label: '직원' },
]
const allowedTargetTypes = new Set<WorkPostTargetType>(targetTypeOptions.map((option) => option.value))

function makeTargetRow(partial?: Partial<TargetDraftRow>): TargetDraftRow {
  return {
    rowId: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    target_type: partial?.target_type || 'all_admin',
    target_id: partial?.target_id || '',
  }
}

function requiresTargetId(type: WorkPostTargetType) {
  return type === 'team' || type === 'admin'
}

function toDueAtEndOfDay(value: string): string | null {
  const date = value.trim()
  if (!date) return null
  return `${date}T23:59:59`
}

export default function ClientWorkPostCreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingFileInputId = useId()

  const queryPostType = (searchParams.get('post_type') || '').toLowerCase()
  const postType: WorkPostType = queryPostType === 'task' ? 'task' : 'notice'

  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [targets, setTargets] = useState<TargetDraftRow[]>([makeTargetRow()])
  const [teams, setTeams] = useState<TeamOut[]>([])
  const [staffs, setStaffs] = useState<AdminOut[]>([])

  const backHref = useMemo(() => {
    const q = new URLSearchParams()
    q.set('post_type', postType)
    return `/client/staff/work-posts?${q.toString()}`
  }, [postType])

  const appendPendingFiles = useCallback((list: FileList | File[] | null) => {
    if (!list) return
    const incoming = Array.from(list)
    if (incoming.length === 0) return
    setPendingFiles((prev) => {
      const dedupe = new Set(prev.map((f) => `${f.name}:${f.size}:${f.type}:${f.lastModified}`))
      const next = [...prev]
      for (const file of incoming) {
        const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        next.push(file)
      }
      return next
    })
  }, [])

  const loadReferences = useCallback(async () => {
    try {
      const [teamList, staffList] = await Promise.all([
        getTeams(),
        getClientStaffs(1, 200),
      ])
      setTeams(teamList || [])
      setStaffs((staffList.items || []).filter((staff) => staff.is_active))
    } catch {
      toast.error('참조 데이터를 불러오지 못했습니다. 일부 대상 선택이 제한될 수 있습니다.')
    }
  }, [])

  useEffect(() => {
    if (postType !== 'task') return
    void loadReferences()
  }, [loadReferences, postType])

  const updateTargetRow = (rowId: string, patch: Partial<TargetDraftRow>) => {
    setTargets((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row
        const nextTargetType = patch.target_type || row.target_type
        return {
          ...row,
          ...patch,
          target_id: requiresTargetId(nextTargetType) ? patch.target_id ?? row.target_id : '',
        }
      })
    )
  }

  const removeTargetRow = (rowId: string) => {
    setTargets((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.rowId !== rowId)
    })
  }

  const buildTargetsPayload = (): WorkPostTargetIn[] | null => {
    const normalized: WorkPostTargetIn[] = []
    const dedupe = new Set<string>()
    const activeStaffIdSet = new Set(staffs.filter((staff) => staff.is_active).map((staff) => Number(staff.id)))

    for (const row of targets) {
      if (!allowedTargetTypes.has(row.target_type)) continue
      if (!row.target_type) continue
      if (requiresTargetId(row.target_type)) {
        const parsed = Number(row.target_id)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          toast.error('대상 ID가 필요한 항목은 값을 선택해 주세요.')
          return null
        }
        if (row.target_type === 'admin' && !activeStaffIdSet.has(parsed)) {
          toast.error('비활성(퇴사) 직원은 수신 대상으로 선택할 수 없습니다.')
          return null
        }
        const key = `${row.target_type}:${parsed}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        normalized.push({ target_type: row.target_type, target_id: parsed })
      } else {
        const key = `${row.target_type}:null`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        normalized.push({ target_type: row.target_type })
      }
    }

    return normalized
  }

  const handleSubmit = async (mode: 'published' | 'draft') => {
    const trimmedTitle = title.trim()
    const trimmedBody = bodyHtml.trim()

    if (mode === 'published') {
      if (!trimmedTitle) {
        toast.error('제목을 입력해 주세요.')
        return
      }
      if (!trimmedBody) {
        toast.error('본문을 입력해 주세요.')
        return
      }
    }

    const targetsPayload =
      postType === 'task' ? buildTargetsPayload() : ([{ target_type: 'all_admin' }] as WorkPostTargetIn[])
    if (targetsPayload === null) return

    const payload: WorkPostCreatePayload = {
      post_type: postType,
      title: trimmedTitle || '임시저장',
      body_html: trimmedBody || '<p></p>',
      status: mode,
      priority: 'normal',
      due_at: toDueAtEndOfDay(dueDate),
      targets: targetsPayload,
    }

    try {
      setSubmitting(true)
      const saved = await createClientWorkPost(payload)
      for (const file of pendingFiles) {
        await uploadClientWorkPostAttachment(saved.id, file)
      }
      toast.success(mode === 'draft' ? '임시저장되었습니다.' : '게시글이 등록되었습니다.')
      const q = new URLSearchParams()
      q.set('post_type', postType)
      router.push(`/client/staff/work-posts/${saved.id}?${q.toString()}`)
    } catch (error) {
      toast.error(getClientWorkPostErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6 space-y-4">
      <div className="flex items-center">
        <h1 className="text-base font-semibold text-zinc-900">{postType === 'task' ? '새 업무지시 작성' : '새 공지 작성'}</h1>
      </div>

      <div className="bg-white p-4">
        <input
          id={pendingFileInputId}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            appendPendingFiles(e.target.files)
            e.currentTarget.value = ''
          }}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-10 md:items-end">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs text-zinc-600">제목</label>
            <input
              type="text"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력해 주세요."
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-zinc-600">마감일(선택)</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="hidden md:block md:col-span-1" />
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs text-zinc-600">첨부파일</label>
            <div className="flex items-center gap-2">
              <FileDropzone
                onFilesDrop={appendPendingFiles}
                className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-dashed px-3 text-xs transition"
                idleClassName="border-zinc-300 bg-white text-zinc-500"
                activeClassName="border-zinc-500 bg-zinc-50 text-zinc-800"
              >
                파일 드래그
              </FileDropzone>
              <label
                htmlFor={pendingFileInputId}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                선택
              </label>
            </div>
          </div>
        </div>

        {pendingFiles.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingFiles.map((file, index) => (
              <button
                key={`${file.name}-${file.size}-${index}`}
                type="button"
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700"
                onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
              >
                {file.name} ×
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3">
          <label className="mb-1 block text-xs text-zinc-600">본문</label>
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} preset="workPost" />
        </div>

        {postType === 'task' ? (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-900">대상 설정</p>
              <UiButton size="xs" onClick={() => setTargets((prev) => [...prev, makeTargetRow()])}>
                대상 추가
              </UiButton>
            </div>
            <div className="space-y-2">
              {targets.map((row) => (
                <div key={row.rowId} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <select
                      className={inputClass}
                      value={row.target_type}
                      onChange={(e) =>
                        updateTargetRow(row.rowId, {
                          target_type: e.target.value as WorkPostTargetType,
                          target_id: '',
                        })
                      }
                    >
                      {targetTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    {row.target_type === 'team' ? (
                      <select
                        className={inputClass}
                        value={row.target_id}
                        onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                      >
                        <option value="">팀 선택</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    ) : row.target_type === 'admin' ? (
                      <select
                        className={inputClass}
                        value={row.target_id}
                        onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                      >
                        <option value="">직원 선택</option>
                        {staffs
                          .filter((staff) => staff.is_active)
                          .map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.name} ({staff.login_id || staff.email})
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input type="text" className={inputClass} value="대상 ID 없음" disabled />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <UiButton
                      className="w-full"
                      size="md"
                      variant="danger"
                      disabled={targets.length <= 1}
                      onClick={() => removeTargetRow(row.rowId)}
                    >
                      삭제
                    </UiButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-200 pt-4">
          <UiButton variant="secondary" disabled={submitting} onClick={() => void handleSubmit('draft')}>
            임시저장
          </UiButton>
          <UiButton variant="secondary" onClick={() => router.push(backHref)}>
            취소
          </UiButton>
          <UiButton variant="primary" disabled={submitting} onClick={() => void handleSubmit('published')}>
            {submitting ? '저장 중...' : '게시'}
          </UiButton>
        </div>
      </div>

    </section>
  )
}
