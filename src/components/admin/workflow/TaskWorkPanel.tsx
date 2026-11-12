'use client'

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useRef, useState } from 'react'
import { Check, FileText, X } from 'lucide-react'
import PayrollFilePreview from './PayrollFilePreview'
import { fetchAdminDocsEntryDownloadUrl } from '@/services/admin/adminDocsService'
import {
  deleteTaskItemFile, getTaskBoardErrorMessage, listTaskBoardItems, listTaskItemDocs, taskDocumentKindLabels,
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
  withholdingDelivery?: boolean
  close: () => void
  upload: (itemId: number, files: File[], companyId: number, boardId: number) => Promise<{
    total: number; successCount: number; failedCount: number; firstError?: string; failedIndexes?: number[]
  }>
  saveStatus: (companyId: number, boardId: number, item: TaskBoardItem, status: TaskItemStatus) => Promise<unknown>
  onChanged: () => void
}

const MIN_PAYROLL_PANEL_WIDTH = 672

export default function TaskWorkPanel({ companyId, companyName, boardId, month, itemId, deliveryLabel = '전달 완료 기록', payrollDelivery = false, withholdingDelivery = false, close, upload, saveStatus, onChanged }: Props) {
  const deliveryPanel = payrollDelivery || withholdingDelivery
  const panelTitle = withholdingDelivery ? '납부서 전달' : '급여대장 송부 및 확인'
  const fileInput = useRef<HTMLInputElement>(null)
  const resizeOrigin = useRef<{ pointerId: number; x: number; width: number } | null>(null)
  const working = useRef(false)
  const [busy, setBusy] = useState(false)
  const [revision, refresh] = useState(0)
  const [data, setData] = useState<{ item: TaskBoardItem; docs: TaskItemDocLink[]; priorDeliveryDocs: TaskItemDocLink[] } | null>(null)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [panelWidth, setPanelWidth] = useState(MIN_PAYROLL_PANEL_WIDTH)
  const [viewportWidth, setViewportWidth] = useState(MIN_PAYROLL_PANEL_WIDTH)

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    const load = async () => {
      const { items } = await listTaskBoardItems('admin', companyId, boardId)
      const item = items.find(task => task.id === itemId)
      if (!item) throw new Error('업무 항목을 찾을 수 없습니다.')
      const linked = (item.execution_mode_snapshot ?? 'check_only') === 'check_only' && item.source_item_id
      const [source, priorDelivery] = await Promise.all([
        withholdingDelivery && !linked ? null : listTaskItemDocs('admin', companyId, boardId, linked || item.id),
        withholdingDelivery && item.own_file_count ? listTaskItemDocs('admin', companyId, boardId, item.id) : null,
      ])
      if (active) setData({ item, docs: source?.items ?? [], priorDeliveryDocs: priorDelivery?.items ?? [] })
    }
    void load().catch(error => { if (active) setError(getTaskBoardErrorMessage(error)) })
    return () => { active = false }
  }, [companyId, boardId, itemId, revision, withholdingDelivery])

  useEffect(() => {
    if (!deliveryPanel) return
    const measureViewport = () => setViewportWidth(window.innerWidth)
    measureViewport()
    window.addEventListener('resize', measureViewport)
    return () => window.removeEventListener('resize', measureViewport)
  }, [deliveryPanel])

  const resizePanel = (width: number) => setPanelWidth(Math.max(MIN_PAYROLL_PANEL_WIDTH, Math.min(viewportWidth, width)))

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
  const canUpload = applicable && !done && mode !== 'check_only' && !deliveryPanel
  const canComplete = applicable && (done || (deliveryPanel ? linked && Boolean(item?.can_deliver && data?.docs.some(doc => !withholdingDelivery || doc.document_kind === 'payment_slip'))
    : linked ? Boolean(item?.can_deliver) : mode === 'check_only' || Boolean(data?.docs.length)))
  const previewDoc = data?.docs.find(doc => doc.id === previewId) ?? data?.priorDeliveryDocs.find(doc => doc.id === previewId)
  const sourceDocs = withholdingDelivery && data ? [...data.docs].sort((a, b) =>
    Number(b.document_kind === 'payment_slip') - Number(a.document_kind === 'payment_slip')) : data?.docs ?? []
  const fileGroups = [{ title: withholdingDelivery ? '신고 파일' : '원본 파일', docs: sourceDocs, original: true }]
  if (data?.priorDeliveryDocs.length) fileGroups.push({ title: '기존 전달 첨부', docs: data.priorDeliveryDocs, original: false })
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
      className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${done && deliveryPanel
        ? 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
        : 'bg-sky-700 text-white hover:bg-sky-800'} ${className}`}>
      {done ? '완료 취소' : deliveryPanel ? '처리완료' : linked || mode === 'file_and_notify' ? deliveryLabel : '완료 처리'}
    </button>
  )

  return (
    <Dialog open onClose={requestClose} className={deliveryPanel ? 'relative z-[140]' : 'relative z-50'}>
      <DialogBackdrop className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className={deliveryPanel
          ? 'relative flex h-full max-w-full flex-col border-l border-zinc-200 bg-white shadow-xl'
          : 'h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl'}
          style={deliveryPanel ? { width: Math.min(panelWidth, viewportWidth) } : undefined}>
          {deliveryPanel ? (
            <>
              {viewportWidth > MIN_PAYROLL_PANEL_WIDTH && (
                <div role="separator" aria-label={`${panelTitle} 패널 너비`} aria-orientation="vertical"
                  aria-valuemin={MIN_PAYROLL_PANEL_WIDTH} aria-valuemax={viewportWidth} aria-valuenow={Math.min(panelWidth, viewportWidth)}
                  tabIndex={0} title="끌어서 패널 너비 조절"
                  className="absolute inset-y-0 left-0 z-20 flex w-2 cursor-col-resize touch-none items-center outline-none hover:bg-sky-100 focus-visible:bg-sky-100"
                  onPointerDown={event => {
                    if (event.button !== 0 || resizeOrigin.current) return
                    resizeOrigin.current = { pointerId: event.pointerId, x: event.clientX, width: Math.min(panelWidth, viewportWidth) }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={event => {
                    const origin = resizeOrigin.current
                    if (origin?.pointerId === event.pointerId) resizePanel(origin.width + origin.x - event.clientX)
                  }}
                  onLostPointerCapture={() => { resizeOrigin.current = null }}
                  onKeyDown={event => {
                    const width = Math.min(panelWidth, viewportWidth)
                    const nextWidths: Record<string, number> = {
                      ArrowLeft: width + 32, ArrowRight: width - 32, Home: MIN_PAYROLL_PANEL_WIDTH, End: viewportWidth,
                    }
                    const nextWidth = nextWidths[event.key]
                    if (typeof nextWidth !== 'number') return
                    event.preventDefault()
                    resizePanel(nextWidth)
                  }}>
                  <span aria-hidden="true" className="ml-0.5 h-9 w-0.5 rounded-full bg-zinc-300" />
                </div>
              )}
              <header className="shrink-0 border-b border-zinc-200 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-zinc-500" title={companyName}>{companyName} · {month} 귀속</p>
                    <DialogTitle className="mt-1 text-lg font-semibold text-zinc-900">{panelTitle}</DialogTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {completionButton('')}
                    <button type="button" data-autofocus aria-label="닫기" title="닫기" disabled={busy} onClick={requestClose}
                      className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {item && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}>
                    {done && <Check size={13} aria-hidden="true" />}
                    {done ? '완료' : applicable ? '미완료' : '해당 없음'}
                  </span>
                  {done && item.completed_at && <span className="text-zinc-500">{formatKSTDateTimeAssumeUTC(item.completed_at)}</span>}
                  {!done && !canComplete && <span className="text-amber-800">{item.blocked_reason || '원본 업무와 파일을 확인해 주세요.'}</span>}
                </div>}
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
                {error ? (
                  <div role="alert" className="text-sm text-rose-700">
                    {error} <button type="button" className="underline" onClick={() => refresh(value => value + 1)}>다시 불러오기</button>
                  </div>
                ) : !data ? <p role="status" className="text-sm text-zinc-500">업무와 파일을 불러오는 중…</p> : (
                  <>
                    {fileGroups.map(group => <section key={group.title} aria-label={group.title} className="shrink-0">
                      <h3 title={group.original ? item?.source_task_name || undefined : undefined} className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800">
                        {group.title} <span className="text-xs font-normal tabular-nums text-zinc-500">{group.docs.length}건</span>
                      </h3>
                      <ul className="max-h-28 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                        {group.docs.map(doc => {
                          const name = doc.file_name || doc.title || `문서 #${doc.docs_entry_id}`
                          const selected = doc.id === previewId
                          return (
                            <li key={doc.id}>
                              <button type="button" title={name} aria-pressed={selected} onClick={() => setPreviewId(doc.id)}
                                className={`flex w-full min-w-0 items-center gap-2.5 border-l-2 px-2.5 py-2 text-left text-sm ${selected
                                  ? 'border-sky-500 bg-sky-50 font-medium text-sky-900' : 'border-transparent text-zinc-700 hover:bg-zinc-50'}`}>
                                <FileText size={16} aria-hidden="true" className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate">{name}</span>
                                {withholdingDelivery && group.original && <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${doc.document_kind === 'payment_slip' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                  {doc.document_kind ? taskDocumentKindLabels[doc.document_kind] : '미분류'}
                                </span>}
                                {selected && <Check size={16} aria-hidden="true" className="shrink-0 text-sky-700" />}
                              </button>
                            </li>
                          )
                        })}
                        {!group.docs.length && <li className="px-3 py-3 text-sm text-zinc-500">등록된 파일이 없습니다.</li>}
                      </ul>
                    </section>)}
                    {previewDoc && <PayrollFilePreview key={previewDoc.id} doc={previewDoc} />}
                  </>
                )}
              </div>
            </>
          ) : <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500">{companyName} · {month} 귀속</p>
              <DialogTitle className="mt-1 text-lg font-semibold">{item?.task_name ?? '업무 파일'}</DialogTitle>
            </div>
            <div className="flex shrink-0 gap-2">
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
              {linked && !done && !canComplete && <p className="mt-1 text-sm text-amber-700">{item.blocked_reason || '원본 업무와 파일을 확인해 주세요.'}</p>}

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
                    <button type="button" className="min-w-0 break-all rounded px-1 text-left text-sky-700 underline" onClick={async () => {
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

              {completionButton('mt-5')}
            </>
          )}
          </>}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
