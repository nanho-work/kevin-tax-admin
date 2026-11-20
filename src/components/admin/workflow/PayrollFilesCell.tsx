'use client'

import { useEffect, useRef, useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { CircleAlert, Plus, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { fetchAdminDocsEntryDownloadUrl } from '@/services/admin/adminDocsService'
import {
  deleteTaskItemFile, getTaskBoardErrorMessage, listTaskItemDocs, taskDocumentKindLabels, updateTaskBoardItem,
  updateWithholdingDocumentKind, type TaskDocumentKind, type TaskItemDocLink, type TaskItemStatus,
} from '@/services/workflowTaskBoard'
import { formatKSTDateTimeMinute, formatKSTShortDate } from '@/utils/dateTime'
import { workflowCompletionSave } from '@/utils/workflowCompletionSave'

type Props = {
  companyId: number
  companyName: string
  boardId: number
  itemId: number
  documents?: TaskItemDocLink[]
  disabled: boolean
  withholdingFiling?: boolean
  upload: (itemId: number, files: File[], companyId: number, boardId: number) => Promise<{
    successCount: number; failedCount: number; failedIndexes?: number[]; firstError?: string
    failedItems?: { index: number; error: string }[]
  }>
  onChanged: () => void
}

const EMPTY_DOCUMENTS: TaskItemDocLink[] = []

type StatusChange = 'done' | 'from_files'

export default function PayrollFilesCell({ companyId, companyName, boardId, itemId, documents = EMPTY_DOCUMENTS, disabled, withholdingFiling = false, upload, onChanged }: Props) {
  const { confirm } = useConfirmDialog()
  const input = useRef<HTMLInputElement>(null)
  const mutating = useRef(false)
  const [docs, setDocs] = useState(documents)
  const [pendingStatus, setPendingStatus] = useState<StatusChange | null>(null)
  const [uploadFailure, setUploadFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setDocs(documents), [documents])

  const hasFiles = docs.length > 0
  const canEdit = !disabled && !busy

  const mutate = async (action: () => Promise<{ changed: boolean; ok: boolean }>) => {
    if (!canEdit || mutating.current) return
    mutating.current = true
    setBusy(true)
    const request = Promise.resolve(workflowCompletionSave.pending).then(action).then(({ changed, ok }) => {
      if (changed) {
        onChanged()
      }
      return ok
    }).catch(error => {
      toast.error(getTaskBoardErrorMessage(error))
      return false
    }).finally(() => {
      if (workflowCompletionSave.pending === request) workflowCompletionSave.pending = null
      mutating.current = false
      setBusy(false)
    })
    workflowCompletionSave.pending = request
    await request
  }

  const syncStatus = async (reason: StatusChange) => {
    try {
      let status: TaskItemStatus = reason === 'from_files' ? 'done' : reason
      if (reason === 'from_files') {
        const { items } = await listTaskItemDocs('admin', companyId, boardId, itemId)
        setDocs(items)
        if (!items.length) status = 'not_started'
      }
      await updateTaskBoardItem('admin', companyId, boardId, itemId, { status })
      setPendingStatus(null)
      return true
    } catch (error) {
      setPendingStatus(reason)
      toast.error(`업무 상태 저장 실패 · ${getTaskBoardErrorMessage(error)}`)
      return false
    }
  }

  const addFiles = (files: File[]) => {
    if (!files.length) return
    void mutate(async () => {
      setUploadFailure(null)
      let result: Awaited<ReturnType<Props['upload']>>
      try {
        result = await upload(itemId, files, companyId, boardId)
      } catch (error) {
        setUploadFailure(getTaskBoardErrorMessage(error))
        return { changed: true, ok: false }
      }
      if (result.failedCount) {
        const fallback = result.firstError || '일부 파일을 등록하지 못했습니다.'
        const reasons = result.failedItems?.length
          ? result.failedItems.map(({ index, error }) => `${files[index]?.name ?? '파일'} · ${error}`)
          : result.failedIndexes?.map(index => `${files[index]?.name ?? '파일'} · ${fallback}`)
        setUploadFailure(reasons?.length ? reasons.join('\n') : fallback)
        if (result.successCount) setPendingStatus(null)
        return { changed: result.successCount > 0, ok: false }
      }
      if (!result.successCount) return { changed: false, ok: false }
      toast.success(`파일 ${result.successCount}건을 등록했습니다.`)
      return { changed: true, ok: withholdingFiling || await syncStatus('done') }
    })
  }

  const remove = async (doc: TaskItemDocLink, name: string) => {
    if (!await confirm({ title: '파일 삭제', description: name, confirmText: '삭제', cancelText: '취소', variant: 'danger' })) return
    await mutate(async () => {
      await deleteTaskItemFile('admin', companyId, boardId, itemId, doc.docs_entry_id)
      setDocs(previous => previous.filter(item => item.id !== doc.id))
      return { changed: true, ok: withholdingFiling || await syncStatus('from_files') }
    })
  }

  const fileName = (doc: TaskItemDocLink) => doc.file_name || doc.title || `문서 #${doc.docs_entry_id}`
  const primaryDoc = docs.reduce((latest, doc) => doc.created_at > latest.created_at ? doc : latest, docs[0])
  const primaryDate = formatKSTShortDate(primaryDoc?.created_at)
  const classification = (doc: TaskItemDocLink) => (
    <select aria-label={`${fileName(doc)} 분류`} value={doc.document_kind ?? ''} disabled={!canEdit}
      onChange={event => {
        const kind = (event.target.value || null) as TaskDocumentKind | null
        void mutate(async () => {
          await updateWithholdingDocumentKind(companyId, boardId, itemId, doc.docs_entry_id, kind)
          setDocs(previous => previous.map(item => item.id === doc.id ? { ...item, document_kind: kind } : item))
          return { changed: true, ok: true }
        })
      }} className="max-w-full rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs disabled:opacity-50">
      <option value="">미분류</option>
      {Object.entries(taskDocumentKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
    </select>
  )
  const renderFile = (doc: TaskItemDocLink) => {
    const name = fileName(doc)
    return (
      <div className="flex min-w-0 items-center gap-1 rounded">
        <button type="button" title={name} className="min-w-0 flex-1 truncate text-left text-sky-800 hover:underline" onClick={async () => {
          try {
            const { download_url } = await fetchAdminDocsEntryDownloadUrl(doc.docs_entry_id)
            const link = document.createElement('a')
            link.href = download_url
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            link.click()
          } catch (error) { toast.error(getTaskBoardErrorMessage(error)) }
        }}>{name}</button>
        <button type="button" aria-label={`${name} 삭제`} title="파일 삭제" disabled={!canEdit}
          onClick={() => void remove(doc, name)} className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100 disabled:opacity-50">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className={`mx-auto min-h-7 w-[7.5rem] space-y-1 rounded border px-0.5 py-1 text-[11px] ${hasFiles ? 'border-emerald-500 bg-emerald-50' : 'border-dashed border-zinc-200'}`}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = canEdit ? 'copy' : 'none' }}
      onDrop={event => { event.preventDefault(); if (canEdit) addFiles(Array.from(event.dataTransfer.files)) }}>
      {primaryDoc && (
        <>
          <Popover>
              <PopoverButton type="button" title={fileName(primaryDoc)} aria-label={`${companyName} 파일 ${docs.length}건 목록 열기`}
                className="flex w-full min-w-0 items-center justify-center gap-1 rounded text-left text-sky-800 hover:bg-sky-50">
                <span className="min-w-0 truncate">{fileName(primaryDoc)}</span>
                {docs.length > 1 && <span className="shrink-0 whitespace-nowrap">외 {docs.length - 1}건</span>}
              </PopoverButton>
              <PopoverPanel anchor="bottom start" className="z-40 max-h-60 w-72 max-w-[calc(100vw-1rem)] divide-y overflow-auto rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-lg [--anchor-gap:4px]">
                {docs.map(doc => <div key={doc.id} className="py-1">
                  {renderFile(doc)}
                  {withholdingFiling && <div className="px-1 pb-1">{classification(doc)}</div>}
                </div>)}
              </PopoverPanel>
          </Popover>
          <div className="flex items-center justify-center gap-0.5">
            {primaryDate && <span title={`${formatKSTDateTimeMinute(primaryDoc.created_at)} 최종 업로드`}
              className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-500">{primaryDate}</span>}
            {withholdingFiling && <button type="button" title="파일 추가" aria-label={`${companyName} 원천세 신고 파일 추가`}
              disabled={!canEdit} onClick={() => input.current?.click()} className="shrink-0 rounded p-0.5 text-sky-700 hover:bg-sky-50 disabled:opacity-50">
              <Plus size={12} aria-hidden="true" />
            </button>}
          </div>
        </>
      )}
      <input ref={input} type="file" multiple className="hidden" disabled={!canEdit}
        onChange={event => { addFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = '' }} />
      {!hasFiles && <button type="button" disabled={!canEdit} aria-label={`${companyName} ${withholdingFiling ? '원천세 신고' : '급여대장'} 파일 선택`}
        onClick={() => input.current?.click()} className="text-sky-700 disabled:opacity-50">파일 선택 · 드롭</button>}
      {uploadFailure && <div className="flex items-center justify-center gap-1 text-red-700">
        <span role="status" title={uploadFailure} tabIndex={0} className="inline-flex cursor-help items-center gap-1">
          <CircleAlert className="h-3 w-3" aria-hidden="true" />
          실패
          <span className="sr-only"> · {uploadFailure}</span>
        </span>
        <button type="button" aria-label="업로드 실패 표시 닫기" title="닫기"
          onClick={() => setUploadFailure(null)} className="rounded p-0.5 hover:bg-red-100">
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>}
      {pendingStatus && <button type="button" disabled={!canEdit}
        onClick={() => void mutate(async () => ({ changed: true, ok: await syncStatus(pendingStatus) }))}
        className="text-red-700 underline">상태 저장 재시도</button>}
      {busy && <p role="status" className="text-zinc-500">파일 처리 중…</p>}
    </div>
  )
}
