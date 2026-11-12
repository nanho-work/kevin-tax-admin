'use client'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useRef, useState } from 'react'
import PayrollFilePreview from './PayrollFilePreview'
import { fetchAdminDocsEntryDownloadUrl } from '@/services/admin/adminDocsService'
import {
  deleteTaskItemFile, getTaskBoardErrorMessage, listTaskBoardItems, listTaskItemDocs,
  type TaskBoardItem, type TaskItemDocLink, type TaskItemStatus,
} from '@/services/workflowTaskBoard'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'
import { toast } from 'react-hot-toast'

type Props = {
  companyId: number
  companyName: string
  boardId: number
  month: string
  itemId: number
  deliveryLabel?: string
  payrollDelivery?: boolean
  close: () => void
  upload: (itemId: number, files: File[], companyId: number, boardId: number) => Promise<{
    total: number; successCount: number; failedCount: number; firstError?: string; failedIndexes?: number[]
  }>
  saveStatus: (companyId: number, boardId: number, item: TaskBoardItem, status: TaskItemStatus) => Promise<unknown>
  onChanged: () => void
}

export default function TaskWorkPanel({ companyId, companyName, boardId, month, itemId, deliveryLabel = '전달 완료 기록', payrollDelivery = false, close, upload, saveStatus, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const previewContainer = useRef<HTMLDivElement>(null)
  const working = useRef(false)
  const [busy, setBusy] = useState(false)
  const [revision, refresh] = useState(0)
  const [data, setData] = useState<{ item: TaskBoardItem; docs: TaskItemDocLink[] } | null>(null)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    const load = async () => {
      const { items } = await listTaskBoardItems('admin', companyId, boardId)
      const item = items.find(task => task.id === itemId)
      if (!item) throw new Error('업무 항목을 찾을 수 없습니다.')
      const linked = (item.execution_mode_snapshot ?? 'check_only') === 'check_only' && item.source_item_id
      const { items: docs } = await listTaskItemDocs('admin', companyId, boardId, linked || item.id)
      if (active) setData({ item, docs })
    }
    void load().catch(error => { if (active) setError(getTaskBoardErrorMessage(error)) })
    return () => { active = false }
  }, [companyId, boardId, itemId, revision])

  useEffect(() => {
    if (previewId !== null) previewContainer.current?.scrollIntoView?.({ block: 'nearest' })
  }, [previewId])

  const mutate = async (action: () => Promise<boolean>) => {
    if (working.current) return
    working.current = true
    setBusy(true)
    try {
      if (await action()) {
        setData(null)
        refresh(value => value + 1)
        onChanged()
      }
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  const item = data?.item
  const mode = item?.execution_mode_snapshot ?? 'check_only'
  const linked = mode === 'check_only' && Boolean(item?.source_item_id)
  const applicable = Boolean(item && item.target_active !== false && item.status !== 'na')
  const done = item?.status === 'done'
  const canUpload = applicable && !done && mode !== 'check_only' && !payrollDelivery
  const canComplete = applicable && (done || (payrollDelivery ? linked && Boolean(item?.can_deliver && data?.docs.length)
    : linked ? Boolean(item?.can_deliver) : mode === 'check_only' || Boolean(data?.docs.length)))
  const previewDoc = data?.docs.find(doc => doc.id === previewId)
  const requestClose = () => {
    if (!working.current) close()
  }
  const queue = (incoming: FileList | null) => {
    if (canUpload && !working.current && incoming?.length) {
      const added = Array.from(incoming)
      setFiles(previous => [...previous, ...added])
    }
  }
  const completionButton = (className: string) => item && (
    <button type="button" disabled={busy || !canComplete || files.length > 0}
      onClick={() => void mutate(async () => {
        await saveStatus(companyId, boardId, item, done ? 'in_progress' : 'done')
        toast.success(done ? '완료를 취소했습니다.' : '완료 상태를 저장했습니다.')
        return true
      })}
      className={`shrink-0 rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${className}`}>
      {done ? '완료 취소' : payrollDelivery ? '처리완료' : linked || mode === 'file_and_notify' ? deliveryLabel : '완료 처리'}
    </button>
  )

  return (
    <Dialog open onClose={requestClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className={`h-full w-full overflow-y-auto bg-white p-5 shadow-xl ${payrollDelivery ? 'max-w-2xl' : 'max-w-lg'}`}>
          <div className={`flex items-start justify-between gap-4 ${payrollDelivery ? 'sticky top-0 z-10 -mx-5 -mt-5 border-b border-zinc-200 bg-white px-5 pb-3 pt-5' : ''}`}>
            <div>
              <p className="text-xs text-zinc-500">{companyName} · {month} 귀속</p>
              <DialogTitle className="mt-1 text-lg font-semibold">{item?.task_name ?? '업무 파일'}</DialogTitle>
            </div>
            <div className="flex shrink-0 gap-2">
              {payrollDelivery && completionButton('')}
              <button type="button" disabled={busy} onClick={requestClose} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">닫기</button>
            </div>
          </div>

          {error ? (
            <div role="alert" className="mt-5 text-sm text-rose-700">
              {error} <button type="button" className="underline" onClick={() => refresh(value => value + 1)}>다시 불러오기</button>
            </div>
          ) : !data || !item ? <p role="status" className="mt-5 text-sm text-zinc-500">업무와 파일을 불러오는 중…</p> : (
            <>
              <p className="mt-4 text-sm text-zinc-600">{done ? `완료 · ${formatKSTDateTimeAssumeUTC(item.completed_at)}` : applicable ? '미완료' : '해당 없음'}</p>
              {linked && <p className="mt-2 text-sm text-zinc-600">연결된 원본 업무 · {item.source_task_name || '원본 업무'}</p>}
              {(linked || payrollDelivery) && !done && !canComplete && <p className="mt-1 text-sm text-amber-700">{item.blocked_reason || '원본 업무와 파일을 확인해 주세요.'}</p>}

              {canUpload && (
                <div className="mt-4 rounded-lg border border-dashed border-sky-300 bg-sky-50 p-5 text-center text-sm"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => { event.preventDefault(); queue(event.dataTransfer.files) }}>
                  <input ref={fileInput} type="file" multiple className="hidden" disabled={busy}
                    onChange={event => { queue(event.currentTarget.files); event.currentTarget.value = '' }} />
                  <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="rounded border bg-white px-3 py-1.5 font-medium disabled:opacity-50">파일 선택</button>
                  <p className="mt-2 text-zinc-600">또는 여기에 파일을 끌어다 놓으세요.</p>
                </div>
              )}

              {files.length > 0 && canUpload && (
                <div className="mt-3 space-y-2 text-sm">
                  <ul>{files.map((file, index) => (
                    <li key={index} className="flex justify-between gap-2 py-1">
                      <span className="break-all">{file.name}</span>
                      <button type="button" disabled={busy} onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))} className="shrink-0 text-zinc-500">제외</button>
                    </li>
                  ))}</ul>
                  <button type="button" disabled={busy} onClick={() => void mutate(async () => {
                    const result = await upload(item.id, files, companyId, boardId)
                    if (result.failedCount) toast.error(`${result.successCount}/${result.total}건 등록 · ${result.firstError || '일부 파일을 등록하지 못했습니다.'}`)
                    else toast.success(`파일 ${result.successCount}건을 등록했습니다.`)
                    if (result.successCount) {
                      const failed = new Set(result.failedIndexes)
                      setFiles(previous => previous.filter((_, index) => failed.has(index)))
                    }
                    return result.successCount > 0
                  })} className="rounded bg-sky-700 px-3 py-2 text-white disabled:opacity-50">{busy ? '처리 중…' : '업로드'}</button>
                </div>
              )}

              <h3 className="mt-6 text-sm font-semibold">{linked ? '원본 파일' : '등록한 파일'}</h3>
              <ul className="mt-2 divide-y border-y text-sm">
                {data.docs.map(doc => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                    <button type="button" aria-pressed={payrollDelivery ? doc.id === previewId : undefined}
                      className={`min-w-0 break-all rounded px-1 text-left text-sky-700 underline ${payrollDelivery && doc.id === previewId ? 'bg-sky-100' : ''}`} onClick={async () => {
                      if (payrollDelivery) {
                        setPreviewId(doc.id)
                        return
                      }
                      try {
                        const result = await fetchAdminDocsEntryDownloadUrl(doc.docs_entry_id)
                        const link = document.createElement('a')
                        link.href = result.download_url
                        link.target = '_blank'
                        link.rel = 'noopener noreferrer'
                        link.click()
                      } catch (error) { toast.error(getTaskBoardErrorMessage(error)) }
                    }}>{doc.file_name || doc.title || `문서 #${doc.docs_entry_id}`}</button>
                    {canUpload && (deleteId === doc.id ? (
                      <div className="flex shrink-0 gap-2">
                        <button type="button" disabled={busy} onClick={() => setDeleteId(null)}>취소</button>
                        <button type="button" disabled={busy} className="text-rose-700" onClick={() => void mutate(async () => {
                          await deleteTaskItemFile('admin', companyId, boardId, item.id, doc.docs_entry_id)
                          setDeleteId(null)
                          return true
                        })}>삭제 확인</button>
                      </div>
                    ) : (
                      <button type="button" disabled={busy} className="shrink-0 text-rose-700 disabled:opacity-50" onClick={() => setDeleteId(doc.id)}>삭제</button>
                    ))}
                  </li>
                ))}
                {!data.docs.length && <li className="py-3 text-zinc-500">등록된 파일이 없습니다.</li>}
              </ul>

              {payrollDelivery && previewDoc && (
                <div ref={previewContainer} className="scroll-mt-20">
                  <PayrollFilePreview key={previewDoc.id} doc={previewDoc} />
                </div>
              )}
              {!payrollDelivery && completionButton('mt-5')}
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
