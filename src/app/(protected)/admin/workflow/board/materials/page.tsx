'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Download, Eye } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import { formatKSTDate } from '@/utils/dateTime'
import {
  fetchTaskFileDownloadUrl,
  fetchTaskFilePreviewUrl,
  fetchTaskFilesSummary,
  getTaskBoardErrorMessage,
  listAllTaskFiles,
  listCompanyTaskFiles,
  listTaskBoards,
  type TaskBoardListItem,
  type TaskBoardScope,
  type TaskBoardFileItem,
  type TaskBoardFilesSummaryResponse,
} from '@/services/workflowTaskBoard'

type ViewMode = 'monthly' | 'yearly'

type CompanyOption = {
  id: number
  name: string
}

type YearlyRow = {
  key: string
  companyName: string
  year: string
  taskName: string
  fileCount: number
  latestUploadedAt: string
}

const PAGE_SIZE = 20

function getKstNowParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year')?.value || '2026')
  const month = Number(parts.find((part) => part.type === 'month')?.value || '1')
  return {
    year: Number.isFinite(year) ? year : 2026,
    month: Number.isFinite(month) ? month : 1,
  }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function nextYm(year: number, month: number): string {
  if (month === 12) return `${year + 1}-01`
  return `${year}-${pad2(month + 1)}`
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

function getFileExtension(fileName?: string | null): string {
  if (!fileName) return ''
  const idx = fileName.lastIndexOf('.')
  if (idx < 0) return ''
  return fileName.slice(idx + 1).toLowerCase()
}

function canPreviewFile(fileName?: string | null, contentType?: string | null): boolean {
  const ext = getFileExtension(fileName)
  const previewExts = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff'])
  if (previewExts.has(ext)) return true
  const type = (contentType || '').toLowerCase()
  if (type === 'application/pdf') return true
  if (type.startsWith('image/')) return true
  return false
}

function IconTooltipButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={label}
    >
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity delay-500 group-hover:opacity-100">
        {label}
      </span>
    </button>
  )
}

export default function WorkflowBoardMaterialsPage() {
  const pathname = usePathname()
  const scope: TaskBoardScope = pathname.startsWith('/client') ? 'client' : 'admin'

  const kstNow = useMemo(() => getKstNowParts(), [])
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [focusYear, setFocusYear] = useState(kstNow.year)
  const [focusMonth, setFocusMonth] = useState(kstNow.month)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([])
  const [rows, setRows] = useState<TaskBoardFileItem[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<TaskBoardFilesSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewingEntryId, setPreviewingEntryId] = useState<number | null>(null)
  const [downloadingEntryId, setDownloadingEntryId] = useState<number | null>(null)

  const monthParam = viewMode === 'monthly' ? focusMonth : undefined
  const yearParam = focusYear
  const taskNameParam = taskFilter === 'all' ? undefined : taskFilter
  const keywordParam = keyword.trim() || undefined

  useEffect(() => {
    setPage(1)
  }, [viewMode, focusYear, focusMonth, companyFilter, taskFilter, keyword])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const attribution = `${focusYear}-${pad2(monthParam ?? 1)}`
        const report = nextYm(focusYear, monthParam ?? 1)
        const res = await listTaskBoards(scope, {
          attribution_month: attribution,
          report_month: report,
          include_excluded: true,
          incomplete_only: false,
          page: 1,
          size: 100,
        })
        if (cancelled) return
        const options: CompanyOption[] = res.items.map((item: TaskBoardListItem) => ({
          id: item.company_id,
          name: item.company_name,
        }))
        setCompanyOptions(options)
      } catch {
        if (!cancelled) setCompanyOptions([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [focusYear, monthParam, scope])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = {
          year: yearParam,
          month: monthParam,
          task_name: taskNameParam,
          q: keywordParam,
          page,
          size: PAGE_SIZE,
        }
        const fileRes =
          companyFilter === 'all'
            ? await listAllTaskFiles(scope, params)
            : await listCompanyTaskFiles(scope, Number(companyFilter), params)
        const summaryRes = await fetchTaskFilesSummary(scope, {
          year: yearParam,
          month: monthParam,
          task_name: taskNameParam,
          q: keywordParam,
        })
        if (cancelled) return
        setRows(fileRes.items || [])
        setTotal(fileRes.total || 0)
        setSummary(summaryRes)
      } catch (error) {
        if (!cancelled) {
          setRows([])
          setTotal(0)
          setSummary(null)
          toast.error(getTaskBoardErrorMessage(error))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [companyFilter, keywordParam, monthParam, page, scope, taskNameParam, yearParam])

  const taskOptions = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((row) => row.task_name).filter(Boolean) as string[]))],
    [rows]
  )

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(rows.map((row) => Number((row.attribution_month || '').slice(0, 4))).filter((year) => Number.isFinite(year)))
    ) as number[]
    const base = years.length > 0 ? years : [focusYear]
    return base.sort((a, b) => a - b).map((year) => String(year))
  }, [focusYear, rows])

  const yearlyRows = useMemo<YearlyRow[]>(() => {
    const grouped = new Map<string, YearlyRow>()
    rows.forEach((row) => {
      const year = (row.attribution_month || '').slice(0, 4) || String(focusYear)
      const taskName = row.task_name || '-'
      const companyName = row.company_name || '-'
      const key = `${companyName}:${year}:${taskName}`
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, {
          key,
          companyName,
          year,
          taskName,
          fileCount: 1,
          latestUploadedAt: row.uploaded_at || '-',
        })
        return
      }
      existing.fileCount += 1
      if ((row.uploaded_at || '') > existing.latestUploadedAt) {
        existing.latestUploadedAt = row.uploaded_at || existing.latestUploadedAt
      }
    })
    return Array.from(grouped.values())
  }, [focusYear, rows])

  const moveYear = (delta: number) => setFocusYear((prev) => prev + delta)
  const moveMonth = (delta: number) => {
    setFocusMonth((prevMonth) => {
      const next = prevMonth + delta
      if (next < 1) {
        setFocusYear((prevYear) => prevYear - 1)
        return 12
      }
      if (next > 12) {
        setFocusYear((prevYear) => prevYear + 1)
        return 1
      }
      return next
    })
  }

  const handlePreviewFile = async (docsEntryId: number | null | undefined) => {
    if (!docsEntryId) {
      toast.error('미리보기할 파일 정보가 없습니다.')
      return
    }
    setPreviewingEntryId(docsEntryId)
    try {
      const res = await fetchTaskFilePreviewUrl(scope, docsEntryId)
      if (!res.preview_url) {
        toast.error('미리보기 URL을 가져오지 못했습니다.')
        return
      }
      window.open(res.preview_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setPreviewingEntryId(null)
    }
  }

  const handleDownloadFile = async (docsEntryId: number | null | undefined) => {
    if (!docsEntryId) {
      toast.error('다운로드할 파일 정보가 없습니다.')
      return
    }
    setDownloadingEntryId(docsEntryId)
    try {
      const res = await fetchTaskFileDownloadUrl(scope, docsEntryId)
      if (!res.download_url) {
        toast.error('다운로드 URL을 가져오지 못했습니다.')
        return
      }
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setDownloadingEntryId(null)
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'monthly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              월별 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'yearly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              연도별 보기
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            {viewMode === 'yearly' ? (
              <>
                <button type="button" onClick={() => moveYear(-1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'<'}
                </button>
                <div className="min-w-[88px] text-center text-sm font-semibold text-zinc-900">{focusYear}</div>
                <button type="button" onClick={() => moveYear(1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'>'}
                </button>
              </>
            ) : (
              <>
                <select
                  value={String(focusYear)}
                  onChange={(event) => setFocusYear(Number(event.target.value))}
                  className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => moveMonth(-1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'<'}
                </button>
                <div className="min-w-[54px] text-center text-sm font-semibold text-zinc-900">{pad2(focusMonth)}월</div>
                <button type="button" onClick={() => moveMonth(1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'>'}
                </button>
                <span className="text-xs font-medium text-zinc-500">귀속월</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <article className="min-w-[88px] rounded-md border border-zinc-200 bg-white px-2 py-1">
              <div className="text-[11px] text-zinc-500">파일 수</div>
              <div className="text-sm font-semibold text-zinc-900">{summary?.total_files ?? '-'}</div>
            </article>
            <article className="min-w-[96px] rounded-md border border-zinc-200 bg-white px-2 py-1">
              <div className="text-[11px] text-zinc-500">총 용량</div>
              <div className="text-sm font-semibold text-zinc-900">{formatBytes(Number(summary?.total_size_bytes ?? 0))}</div>
            </article>
            <article className="min-w-[88px] rounded-md border border-zinc-200 bg-white px-2 py-1">
              <div className="text-[11px] text-zinc-500">업체 수</div>
              <div className="text-sm font-semibold text-zinc-900">{summary?.companies_count ?? '-'}</div>
            </article>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            업체
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="h-9 rounded-md border border-zinc-300 px-2 text-sm text-zinc-800"
            >
              <option value="all">전체 업체</option>
              {companyOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            진행업무
            <select
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
              className="h-9 rounded-md border border-zinc-300 px-2 text-sm text-zinc-800"
            >
              {taskOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? '전체 진행업무' : option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            검색
            <UiSearchInput value={keyword} onChange={setKeyword} placeholder="파일명/제목 검색" className="h-9" />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-zinc-100 text-zinc-700">
              <tr>
                <th className="w-40 px-3 py-2 text-center font-medium">업체</th>
                <th className="w-16 px-3 py-2 text-center font-medium">연도</th>
                {viewMode === 'monthly' ? (
                  <>
                    <th className="w-14 px-3 py-2 text-center font-medium">월</th>
                    <th className="w-52 px-3 py-2 text-center font-medium">진행업무</th>
                    <th className="px-3 py-2 text-center font-medium">업로드</th>
                    <th className="w-28 px-3 py-2 text-center font-medium">업로더</th>
                    <th className="w-36 px-3 py-2 text-center font-medium">업로드일</th>
                  </>
                ) : (
                  <>
                    <th className="w-52 px-3 py-2 text-center font-medium">진행업무</th>
                    <th className="w-20 px-3 py-2 text-center font-medium">파일수</th>
                    <th className="w-40 px-3 py-2 text-center font-medium">최종 업로드</th>
                  </>
                )}
                <th className="w-36 px-3 py-2 text-center font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={viewMode === 'monthly' ? 8 : 7} className="px-3 py-8 text-center text-sm text-zinc-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : (viewMode === 'monthly' ? rows.length : yearlyRows.length) === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'monthly' ? 8 : 7} className="px-3 py-8 text-center text-sm text-zinc-500">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : viewMode === 'monthly' ? (
                rows.map((row, index) => (
                  <tr key={`${row.docs_entry_id ?? 'na'}-${index}`} className="border-t border-zinc-100 text-zinc-800">
                    <td className="truncate px-3 py-2 text-center">{row.company_name || '-'}</td>
                    <td className="px-3 py-2 text-center">{(row.attribution_month || '').slice(0, 4) || '-'}</td>
                    <td className="px-3 py-2 text-center">{(row.attribution_month || '').slice(5, 7) || '-'}</td>
                    <td className="truncate px-3 py-2 text-center">{row.task_name || '-'}</td>
                    <td className="truncate px-3 py-2 text-center" title={row.file_name || row.title || ''}>
                      {row.file_name || row.title || '-'}
                    </td>
                    <td className="truncate px-3 py-2 text-center">{row.uploader_name || row.uploaded_by_type || '-'}</td>
                    <td className="px-3 py-2 text-center">{row.uploaded_at ? formatKSTDate(row.uploaded_at) : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canPreviewFile(row.file_name, row.content_type) ? (
                          <IconTooltipButton
                            label={previewingEntryId === row.docs_entry_id ? '불러오는 중...' : '새창 보기'}
                            onClick={() => void handlePreviewFile(row.docs_entry_id)}
                            disabled={!row.docs_entry_id || previewingEntryId === row.docs_entry_id}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </IconTooltipButton>
                        ) : null}
                        <IconTooltipButton
                          label={downloadingEntryId === row.docs_entry_id ? '불러오는 중...' : '다운로드'}
                          onClick={() => void handleDownloadFile(row.docs_entry_id)}
                          disabled={!row.docs_entry_id || downloadingEntryId === row.docs_entry_id}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </IconTooltipButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                yearlyRows.map((row) => (
                  <tr key={row.key} className="border-t border-zinc-100 text-zinc-800">
                    <td className="truncate px-3 py-2 text-center">{row.companyName}</td>
                    <td className="px-3 py-2 text-center">{row.year}</td>
                    <td className="truncate px-3 py-2 text-center">{row.taskName}</td>
                    <td className="px-3 py-2 text-center">{row.fileCount}건</td>
                    <td className="px-3 py-2 text-center">{row.latestUploadedAt}</td>
                    <td className="px-3 py-2 text-center">
                      -
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pt-1">
        <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
