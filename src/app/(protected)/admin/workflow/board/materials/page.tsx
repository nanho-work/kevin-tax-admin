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
  fetchTaskFileArchive,
  getTaskBoardErrorMessage,
  type TaskBoardScope,
  type TaskFileArchiveResponse,
} from '@/services/workflowTaskBoard'

type ViewMode = 'monthly' | 'yearly'

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
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity delay-500 group-hover:opacity-100 group-focus-visible:opacity-100">
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

  const [archive, setArchive] = useState<TaskFileArchiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [annualFiles, setAnnualFiles] = useState(false)
  const [previewingEntryId, setPreviewingEntryId] = useState<number | null>(null)
  const [downloadingEntryId, setDownloadingEntryId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(keyword.trim()); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [keyword])

  const monthParam = viewMode === 'monthly' ? focusMonth : undefined
  const showFiles = viewMode === 'monthly' || annualFiles
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchTaskFileArchive(scope, {
      year: focusYear, month: monthParam,
      company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
      task_name: taskFilter === 'all' ? undefined : taskFilter,
      q: search || undefined, grouped: !showFiles, page, size: PAGE_SIZE,
    }).then(result => {
      if (cancelled) return
      setArchive(result)
      if (result.page !== page) setPage(result.page)
    }).catch(reason => {
      if (!cancelled) setError(getTaskBoardErrorMessage(reason))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [scope, focusYear, monthParam, companyFilter, taskFilter, search, showFiles, page, reload])

  const companyOptions = archive?.companies ?? []
  const taskOptions = ['all', ...Array.from(new Set([...(archive?.tasks ?? []), ...(taskFilter === 'all' ? [] : [taskFilter])]))]
  const yearOptions = Array.from(new Set([kstNow.year, focusYear, ...(archive?.years ?? [])])).sort((a, b) => b - a)
  const rows = archive?.items ?? []
  const yearlyRows = archive?.groups ?? []
  const summary = loading || error ? null : archive?.summary
  const total = archive?.total ?? 0

  const changeView = (mode: ViewMode) => { setViewMode(mode); setAnnualFiles(false); setPage(1) }
  const moveYear = (delta: number) => { setFocusYear(Math.max(1900, Math.min(9999, focusYear + delta))); setPage(1) }
  const moveMonth = (delta: number) => {
    const date = new Date(focusYear, focusMonth - 1 + delta, 1)
    if (date.getFullYear() < 1900 || date.getFullYear() > 9999) return
    setFocusYear(date.getFullYear())
    setFocusMonth(date.getMonth() + 1)
    setPage(1)
  }
  const resetFilters = () => { setCompanyFilter('all'); setTaskFilter('all'); setKeyword(''); setSearch(''); setPage(1); setAnnualFiles(false) }

  const handlePreviewFile = async (docsEntryId: number | null | undefined) => {
    if (!docsEntryId) {
      toast.error('미리보기할 파일 정보가 없습니다.')
      return
    }
    const tab = window.open('about:blank', '_blank')
    if (!tab) { toast.error('팝업을 허용한 후 다시 시도해 주세요.'); return }
    tab.opener = null
    setPreviewingEntryId(docsEntryId)
    try {
      const res = await fetchTaskFilePreviewUrl(scope, docsEntryId)
      if (!res.preview_url) {
        throw new Error('미리보기 URL을 가져오지 못했습니다.')
      }
      tab.location.replace(res.preview_url)
    } catch (error) {
      tab.close()
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
    const tab = window.open('about:blank', '_blank')
    if (!tab) { toast.error('팝업을 허용한 후 다시 시도해 주세요.'); return }
    tab.opener = null
    setDownloadingEntryId(docsEntryId)
    try {
      const res = await fetchTaskFileDownloadUrl(scope, docsEntryId)
      if (!res.download_url) {
        throw new Error('다운로드 URL을 가져오지 못했습니다.')
      }
      tab.location.replace(res.download_url)
    } catch (error) {
      tab.close()
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setDownloadingEntryId(null)
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <section className="bg-white p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">업무자료함</h1>
            <p className="mt-1 text-sm text-zinc-500">업무보드에 연결된 파일을 귀속월 기준으로 조회합니다.</p>
          </div>
          <UiButton onClick={() => setReload(value => value + 1)} disabled={loading}>새로고침</UiButton>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            <button
              type="button"
              onClick={() => changeView('monthly')}
              aria-pressed={viewMode === 'monthly'}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'monthly' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              월별 보기
            </button>
            <button
              type="button"
              onClick={() => changeView('yearly')}
              aria-pressed={viewMode === 'yearly'}
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
                <button type="button" aria-label="이전 연도" onClick={() => moveYear(-1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'<'}
                </button>
                <div className="min-w-[88px] text-center text-sm font-semibold text-zinc-900">{focusYear}</div>
                <button type="button" aria-label="다음 연도" onClick={() => moveYear(1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'>'}
                </button>
              </>
            ) : (
              <>
                <select
                  value={String(focusYear)}
                  aria-label="귀속 연도"
                  onChange={(event) => { setFocusYear(Number(event.target.value)); setPage(1) }}
                  className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label="이전 월" onClick={() => moveMonth(-1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'<'}
                </button>
                <div className="min-w-[54px] text-center text-sm font-semibold text-zinc-900">{pad2(focusMonth)}월</div>
                <button type="button" aria-label="다음 월" onClick={() => moveMonth(1)} className="h-7 rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-white">
                  {'>'}
                </button>
                <span className="text-xs font-medium text-zinc-500">귀속월</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <article className="min-w-[80px] px-3 py-1">
              <div className="text-[11px] text-zinc-500">파일 수</div>
              <div className="text-sm font-semibold text-zinc-900">{summary?.total_files ?? '-'}</div>
            </article>
            <article className="min-w-[96px] px-3 py-1">
              <div className="text-[11px] text-zinc-500">총 용량</div>
              <div className="text-sm font-semibold text-zinc-900">{summary ? formatBytes(Number(summary.total_size_bytes ?? 0)) : '-'}</div>
            </article>
            <article className="min-w-[80px] px-3 py-1">
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
              onChange={(event) => { setCompanyFilter(event.target.value); setPage(1) }}
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
              onChange={(event) => { setTaskFilter(event.target.value); setPage(1) }}
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

      <section className="overflow-hidden bg-white" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 text-sm">
          <span className="text-zinc-500">{focusYear}년 {viewMode === 'monthly' ? `${focusMonth}월` : '전체'} · {showFiles ? '파일 목록' : '업체·업무별 집계'}{!loading && !error ? ` · ${total.toLocaleString()}건` : ''}</span>
          <div className="flex gap-2">
            {viewMode === 'yearly' && <UiButton size="sm" onClick={() => { setAnnualFiles(!annualFiles); setPage(1) }}>{annualFiles ? '연간 집계 보기' : '연간 파일 보기'}</UiButton>}
            <UiButton size="sm" onClick={resetFilters}>필터 초기화</UiButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] table-fixed text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="w-40 px-3 py-2 text-center font-medium">업체</th>
                <th className="w-16 px-3 py-2 text-center font-medium">연도</th>
                {showFiles ? (
                  <>
                    <th className="w-14 px-3 py-2 text-center font-medium">월</th>
                    <th className="w-40 px-3 py-2 text-center font-medium">진행업무</th>
                    <th className="w-64 px-3 py-2 text-left font-medium">파일명</th>
                    <th className="w-28 px-3 py-2 text-center font-medium">등록자</th>
                    <th className="w-36 px-3 py-2 text-center font-medium">업로드일</th>
                  </>
                ) : (
                  <>
                    <th className="w-40 px-3 py-2 text-center font-medium">진행업무</th>
                    <th className="w-20 px-3 py-2 text-center font-medium">파일수</th>
                    <th className="w-40 px-3 py-2 text-center font-medium">최종 업로드</th>
                  </>
                )}
                <th className="w-24 px-3 py-2 text-center font-medium">파일 열기</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan={showFiles ? 8 : 6} className="px-4 py-10 text-center">
                  <p role="alert" className="mb-3 text-rose-600">{error}</p>
                  <UiButton onClick={() => setReload(value => value + 1)}>다시 시도</UiButton>
                </td></tr>
              ) : loading ? (
                <tr>
                  <td colSpan={showFiles ? 8 : 6} className="px-3 py-8 text-center text-sm text-zinc-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : (showFiles ? rows.length : yearlyRows.length) === 0 ? (
                <tr>
                  <td colSpan={showFiles ? 8 : 6} className="px-3 py-8 text-center text-sm text-zinc-500">
                    선택한 조건에 연결된 파일이 없습니다. 기간이나 필터를 변경해 주세요.
                  </td>
                </tr>
              ) : showFiles ? (
                rows.map((row, index) => (
                  <tr key={`${row.docs_entry_id ?? 'na'}-${index}`} className="border-t border-zinc-100 text-zinc-800 hover:bg-zinc-50/70">
                    <td className="truncate px-3 py-2 text-center">{row.company_name || '-'}</td>
                    <td className="px-3 py-2 text-center">{(row.attribution_month || '').slice(0, 4) || '-'}</td>
                    <td className="px-3 py-2 text-center">{(row.attribution_month || '').slice(5, 7) || '-'}</td>
                    <td className="truncate px-3 py-2 text-center">{row.task_name || '-'}</td>
                    <td className="px-3 py-3 text-left">
                      <div className="truncate font-medium" title={row.file_name || row.title || ''}>{row.file_name || row.title || '-'}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500" title={row.title || ''}>
                        {row.title && row.title !== row.file_name ? row.title + ' · ' : ''}{formatBytes(row.size_bytes)}
                      </div>
                    </td>
                    <td className="truncate px-3 py-2 text-center">{row.uploader_name || row.uploaded_by_type || '-'}</td>
                    <td className="px-3 py-2 text-center">{row.uploaded_at ? formatKSTDate(row.uploaded_at) : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canPreviewFile(row.file_name, row.content_type) ? (
                          <IconTooltipButton
                            label={previewingEntryId === row.docs_entry_id ? '불러오는 중...' : '새창 보기'}
                            onClick={() => void handlePreviewFile(row.docs_entry_id)}
                            disabled={!row.docs_entry_id || previewingEntryId !== null}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </IconTooltipButton>
                        ) : null}
                        <IconTooltipButton
                          label={downloadingEntryId === row.docs_entry_id ? '불러오는 중...' : '다운로드'}
                          onClick={() => void handleDownloadFile(row.docs_entry_id)}
                          disabled={!row.docs_entry_id || downloadingEntryId !== null}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </IconTooltipButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                yearlyRows.map((row) => (
                  <tr key={`${row.company_id}:${row.task_name}`} className="border-t border-zinc-100 text-zinc-800 hover:bg-zinc-50/70">
                    <td className="truncate px-3 py-2 text-center">{row.company_name}</td>
                    <td className="px-3 py-2 text-center">{focusYear}</td>
                    <td className="truncate px-3 py-2 text-center">{row.task_name}</td>
                    <td className="px-3 py-2 text-center">{row.file_count}건</td>
                    <td className="px-3 py-2 text-center">{row.latest_uploaded_at ? formatKSTDate(row.latest_uploaded_at) : '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <UiButton size="sm" onClick={() => { setCompanyFilter(String(row.company_id)); setTaskFilter(row.task_name); setAnnualFiles(true); setPage(1) }}>파일 보기</UiButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pt-1">
        {!loading && !error && total > 0 && <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} />}
      </div>
    </div>
  )
}
