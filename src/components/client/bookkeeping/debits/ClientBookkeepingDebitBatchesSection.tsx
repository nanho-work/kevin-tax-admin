'use client'

import { type DragEventHandler, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  deleteBookkeepingDebitBatch,
  listBookkeepingDebitBatchItems,
  listBookkeepingDebitBatches,
  uploadBookkeepingDebits,
} from '@/services/client/clientBookkeepingService'
import type { ClientDebitUploadBatchOut } from '@/types/clientBookkeeping'

type Props = {
  mode?: 'upload' | 'history'
}

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const ALLOWED_EXCEL_EXTENSIONS = ['.xls', '.xlsx', '.xlsm', '.xltx', '.xltm']

function getCurrentYearMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatAppliedMonth(value?: string | null) {
  if (!value) return '-'
  const normalized = String(value).trim()
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    const [year, month] = normalized.split('-')
    return `${year}.${month}`
  }
  return normalized
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function extractApiDetail(error: unknown): string | null {
  const responseData = (error as any)?.response?.data
  const detail = responseData?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
  return null
}

export default function ClientBookkeepingDebitBatchesSection({ mode = 'history' }: Props) {
  const router = useRouter()
  const isUploadMode = mode === 'upload'
  const isHistoryMode = mode === 'history'

  const [rows, setRows] = useState<ClientDebitUploadBatchOut[]>([])
  const [mappingStatusMap, setMappingStatusMap] = useState<
    Record<number, { total: number; matched: number; unmatched: number; loading: boolean }>
  >({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientDebitUploadBatchOut | null>(null)

  const [sourceName, setSourceName] = useState(getCurrentYearMonth())
  const [memo, setMemo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedBatchId, setUploadedBatchId] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [size] = useState(20)
  const [total, setTotal] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  const loadBatches = async (nextPage = page) => {
    try {
      setLoading(true)
      const res = await listBookkeepingDebitBatches({ page: nextPage, size })
      setRows(res.items || [])
      setTotal(res.total || 0)
      setPage(nextPage)
      const items = res.items || []
      if (items.length > 0) {
        setMappingStatusMap((prev) => {
          const next = { ...prev }
          for (const batch of items) {
            next[batch.id] = next[batch.id] || { total: 0, matched: 0, unmatched: 0, loading: true }
            next[batch.id].loading = true
          }
          return next
        })

        void Promise.all(
          items.map(async (batch) => {
            try {
              const [totalRes, matchedRes] = await Promise.all([
                listBookkeepingDebitBatchItems(batch.id, { matched_only: false, page: 1, size: 1 }),
                listBookkeepingDebitBatchItems(batch.id, { matched_only: true, page: 1, size: 1 }),
              ])
              const totalCount = totalRes.total || 0
              const matchedCount = matchedRes.total || 0
              setMappingStatusMap((prev) => ({
                ...prev,
                [batch.id]: {
                  total: totalCount,
                  matched: matchedCount,
                  unmatched: Math.max(0, totalCount - matchedCount),
                  loading: false,
                },
              }))
            } catch {
              setMappingStatusMap((prev) => ({
                ...prev,
                [batch.id]: { total: 0, matched: 0, unmatched: 0, loading: false },
              }))
            }
          })
        )
      }
    } catch (error) {
      toast.error(extractApiDetail(error) || '배치 목록 조회 중 오류가 발생했습니다.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBatches(1)
  }, [])

  const handleUpload = async () => {
    if (!file) {
      toast.error('업로드할 엑셀 파일을 선택해 주세요.')
      return
    }
    const lowerFileName = file.name.toLowerCase()
    const canUpload = ALLOWED_EXCEL_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))
    if (!canUpload) {
      toast.error('엑셀 파일(.xls, .xlsx, .xlsm, .xltx, .xltm)만 업로드할 수 있습니다.')
      return
    }

    const loadingToastId = toast.loading('업로드 중입니다. 잠시만 기다려 주세요...')
    try {
      setUploading(true)
      const uploaded = await uploadBookkeepingDebits({
        file,
        source_name: sourceName || undefined,
        memo: memo || undefined,
      })
      setUploadedBatchId(uploaded.id)
      toast.dismiss(loadingToastId)
      toast.success('업로드가 완료되었습니다.')
      await loadBatches(1)
      setFile(null)
      setSourceName(getCurrentYearMonth())
      setMemo('')
    } catch (error) {
      toast.dismiss(loadingToastId)
      const code = (error as any)?.code
      const status = (error as any)?.response?.status
      if (code === 'ECONNABORTED') {
        toast.error('업로드 시간이 초과되었습니다. 파일 크기/네트워크 상태를 확인해 주세요.')
      } else if (status === 409) {
        toast.error(
          extractApiDetail(error) || '이전에 업로드한 파일입니다. 기존 배치 데이터를 삭제한 후 다시 업로드해 주세요.'
        )
      } else {
        toast.error(extractApiDetail(error) || '업로드 중 오류가 발생했습니다.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeletingBatchId(deleteTarget.id)
      const res = await deleteBookkeepingDebitBatch(deleteTarget.id)
      toast.success(res.message || '업로드 배치가 삭제되었습니다.')
      setDeleteTarget(null)
      await loadBatches(page)
    } catch (error) {
      toast.error(extractApiDetail(error) || '배치 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingBatchId(null)
    }
  }

  const handleDrop: DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    const droppedFile = event.dataTransfer.files?.[0] || null
    handleFileChange(droppedFile)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-900">
              {isUploadMode ? '자동이체 업로드' : '업로드 이력'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isUploadMode
                ? '은행 자동이체 파일을 올리고, 업로드 결과를 바로 확인합니다.'
                : '업로드된 배치별 처리 결과와 매핑 상태를 확인합니다.'}
            </p>
          </div>
          {isUploadMode ? (
            uploadedBatchId ? (
              <button
                type="button"
                onClick={() => router.push(`/client/bookkeeping/debits/history/${uploadedBatchId}`)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                방금 업로드한 이력 보기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/client/bookkeeping/debits/history')}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                업로드 이력 보기
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => router.push('/client/bookkeeping/debits/upload')}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              새 파일 업로드
            </button>
          )}
        </div>

        {isUploadMode ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input type="month" className={inputClass} value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsDragOver(false)
              }}
              onDrop={handleDrop}
              className={`relative flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-sm transition ${
                isDragOver
                  ? 'border-zinc-500 bg-zinc-100 text-zinc-900'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <input
                type="file"
                accept=".xls,.xlsx,.xlsm,.xltx,.xltm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
              {file ? file.name : '파일을 드래그 하시거나 파일을 선택해주세요'}
            </label>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
            <textarea
              className="md:col-span-3 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              placeholder="업로드 메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className="md:col-span-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              자동매칭은 현재 회원명(member_name)과 회사명(company_name) 정확 일치 기준입니다.
              불일치 시 미매핑으로 저장되며 업로드 이력 상세에서 수동 매핑이 필요합니다.
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800">
          {isHistoryMode ? '업로드 이력 목록' : '최근 업로드 이력'}
        </div>
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">업로드일시</th>
              <th className="px-3 py-3 text-left">적용월</th>
              <th className="px-3 py-3 text-right">총 행수</th>
              <th className="px-3 py-3 text-right">성공</th>
              <th className="px-3 py-3 text-right">실패</th>
              <th className="px-3 py-3 text-center">매핑상태</th>
              <th className="px-3 py-3 text-left">메모</th>
              <th className="px-3 py-3 text-center">상세</th>
              <th className="px-3 py-3 text-center">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  업로드 배치가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-3 text-center">{formatDateTime(row.uploaded_at)}</td>
                  <td className="px-3 py-3 text-left">{formatAppliedMonth(row.source_name)}</td>
                  <td className="px-3 py-3 text-right">{row.total_rows.toLocaleString('ko-KR')}</td>
                  <td className="px-3 py-3 text-right text-emerald-700">{row.success_rows.toLocaleString('ko-KR')}</td>
                  <td className="px-3 py-3 text-right text-rose-700">{row.failed_rows.toLocaleString('ko-KR')}</td>
                  <td className="px-3 py-3 text-center">
                    {mappingStatusMap[row.id]?.loading ? (
                      <span className="text-xs text-zinc-500">확인중...</span>
                    ) : (mappingStatusMap[row.id]?.unmatched || 0) > 0 ? (
                      <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        고객사 미적용 {mappingStatusMap[row.id].unmatched}건
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        고객사 등록 완료
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-left">
                    {row.memo ? <span className="block max-w-[360px] truncate" title={row.memo}>{row.memo}</span> : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => router.push(`/client/bookkeeping/debits/history/${row.id}`)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    >
                      상세보기
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      disabled={deletingBatchId === row.id}
                      onClick={() => setDeleteTarget(row)}
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {deletingBatchId === row.id ? '삭제 중...' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => loadBatches(page - 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          이전
        </button>
        <span className="text-sm text-zinc-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => loadBatches(page + 1)}
          className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-700 disabled:opacity-50"
        >
          다음
        </button>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">배치 삭제 확인</h3>
            <p className="mt-2 text-sm text-zinc-600">삭제 후 복구 불가입니다. 계속하시겠습니까?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingBatchId)}
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={Boolean(deletingBatchId)}
                onClick={handleDelete}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deletingBatchId ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
