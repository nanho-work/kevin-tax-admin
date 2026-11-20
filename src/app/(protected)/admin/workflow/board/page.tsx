'use client'

import styles from './board.module.css'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { getAdminAccessToken, getClientAccessToken } from '@/services/http'
import Link from 'next/link'

import { getMonthlyWorkPeriod } from '@/utils/monthlyWorkProgress'
import { Fragment, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Link2, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { workflowCompletionSave } from '@/utils/workflowCompletionSave'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import PayrollFilesCell from '@/components/admin/workflow/PayrollFilesCell'
import StatementTrackingControls from '@/components/admin/workflow/StatementTrackingControls'
import TaskWorkPanel from '@/components/admin/workflow/TaskWorkPanel'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { formatKSTDate, formatKSTShortDate } from '@/utils/dateTime'
import {
  bulkUploadTaskItemFiles,
  bulkUpsertTaskBoardItems,
  createTaskTemplate,
  deleteTaskBoardItem,
  archiveGlobalBaseTaskTemplate,
  deliverTaskBoardItem,
  ensureTaskBoard,
  getTaskBoardErrorMessage,
  importMonthTaskDefaultsForCompanies,
  listGlobalTaskTemplates,
  listTaskBoardItems,
  listTaskBoards,
  getTaskBoardPreference,
  saveTaskBoardPreference,
  type TaskBoardPageSize,
  type TaskTargetMode,
  listTaskTemplates,
  patchTaskBoardExclude,
  patchTaskBoardExcludeByMonth,
  patchTaskBoardNote,
  patchStatementIncome,
  patchStatementTracking,
  type StatementIncomeKind,
  type StatementTrackingChange,
  type TaskBoardStatement,
  type DailyWorkPresence,
  patchTaskBoardReportCycle,
  updateTaskBoardItem,
  reorderGlobalTaskTemplates,
  uploadTaskItemFile,
  type TaskBoardItem,
  type TaskBoardKind,
  type TaskBoardListItem,
  type TaskBoardListResponse,
  type TaskItemDocLink,
  type TaskBoardScope,
  type TaskBoardSortBy,
  type TaskBoardSortOrder,
  type TaskItemStatus,
  type TaskExecutionMode,
} from '@/services/workflowTaskBoard'

type CompanyKind = '법인' | '개인' | '미분류'
type CustomColumn = { id: string; name: string }
type ColumnCatalogItem = { id: string; name: string; templateId: number; sortOrder: number }
type MajorColumn = { id: string; name: string }
type ProcessDisplayColumn = MajorColumn & { heading?: string; statementKey?: string }

const WAGE_STATEMENT_NAME = '근로소득 간이지급명세서'
const WAGE_STATEMENT_ALIASES = ['간이지급명세서(근로소득)']

const STATEMENT_HEADINGS = [
  { name: WAGE_STATEMENT_NAME, aliases: WAGE_STATEMENT_ALIASES },
  { name: '사업소득 간이지급명세서' },
  { name: '근로내용 확인서', aliases: ['근로내용 확인신고서'] },
  { name: '일용직 지급 명세서', aliases: ['일용근로소득 지급명세서', '일용근로 지급명세서'] },
  { name: '기타소득 지급명세서' },
  { name: '배당소득 지급명세서', heading: '이자·배당소득 지급명세서', aliases: ['이자·배당소득 지급명세서', '이자배당소득 지급명세서'] },
  { name: '퇴직소득 지급명세서' },
  { name: '사업소득 지급명세서' },
  { name: '기타소득 간이지급명세서', aliases: ['기소득간이지급명세서'] },
  { name: '보수총액신고', aliases: ['보수총액신고서'] },
]
type ProcessTemplateCatalogItem = {
  id: string
  name: string
  templateId: number
  executionMode: TaskExecutionMode
  sortOrder: number
  sourceTaskName?: string | null
}
type AssigneeOption = { id: number; name: string }

const STATUS_LABEL: Record<TaskItemStatus, string> = {
  not_started: '미시작',
  in_progress: '진행중',
  done: '완료',
  na: '해당없음',
}

const STATUS_CLASS: Record<TaskItemStatus, string> = {
  not_started: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  in_progress: 'border-sky-300 bg-sky-50 text-sky-700',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  na: 'border-zinc-200 bg-zinc-100 text-zinc-500',
}

function mapCompanyKindToLabel(kind: string): CompanyKind {
  if (kind === 'corporate') return '법인'
  if (kind === 'individual') return '개인'
  return '미분류'
}

function mapReportCycleLabel(value?: 'monthly' | 'semiannual' | null) {
  if (value === 'monthly') return '매월'
  if (value === 'semiannual') return '반기'
  return '-'
}

function getReportCycleClass(value?: 'monthly' | 'semiannual' | null) {
  if (value === 'monthly') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (value === 'semiannual') return 'border-amber-300 bg-amber-50 text-amber-700'
  return 'border-zinc-200 bg-zinc-50 text-zinc-500'
}

function mapPayrollBasisLabel(value?: 'current_month' | 'previous_month' | null) {
  if (value === 'current_month') return '당월'
  if (value === 'previous_month') return '전월'
  return '-'
}

function monthShift(value: string, delta: number): string {
  const [yearRaw, monthRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const MONTHLY_INCOME_COLUMNS = [
  { id: 'wage-income-presence', name: '근로', kind: 'wage', aliases: ['근로소득'] },
  { id: 'business-income-presence', name: '사업', kind: 'business', aliases: ['사업소득'] },
  { id: 'retirement-income-presence', name: '퇴직', kind: 'retirement', aliases: ['퇴직소득'] },
  { id: 'other-income-presence', name: '기타', kind: 'other', aliases: ['기타(인적용역)', '기타소득', '기타소득(인적용역)'] },
  { id: 'daily-work-presence', name: '일용', kind: 'daily', aliases: ['일용직', '일용근로', '일용근로소득'] },
  { id: 'interest-income-presence', name: '이자', kind: 'interest', aliases: ['이자소득'] },
  { id: 'dividend-income-presence', name: '배당', kind: 'dividend', aliases: ['배당소득'] },
] as const

const getMonthlyIncomeColumn = (name: string) => MONTHLY_INCOME_COLUMNS.find(column =>
  [column.name, ...column.aliases].some(alias => normalizeText(alias) === normalizeText(name)))

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function splitByChars(value: string, chunkSize: number): string[] {
  const chars = Array.from(value.trim())
  if (chars.length <= chunkSize) return [value.trim()]
  const chunks: string[] = []
  for (let i = 0; i < chars.length; i += chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize).join(''))
  }
  return chunks
}



function getExecutionModeLabel(mode: TaskExecutionMode) {
  if (mode === 'file_only') return '파일 필수'
  if (mode === 'file_and_notify') return '파일+송부'
  return '체크만'
}

const TEMPLATE_COLUMN_PREFIX = 'template-col-'
const TASK_BOARD_EDIT_PAGE_SIZE = 100

function seedCustomColumns(): CustomColumn[] {
  return []
}

function seedColumnCatalog(): ColumnCatalogItem[] {
  return []
}

export default function WorkflowBoardPage() {
  const pathname = usePathname()
  const scope: TaskBoardScope = pathname.startsWith('/client') ? 'client' : 'admin'
  const { confirm } = useConfirmDialog()

  const [attributionMonth, setAttributionMonth] = useState(() => getMonthlyWorkPeriod().attribution)
  const latestAttributionMonth = monthShift(getMonthlyWorkPeriod().report, 1)
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({ withholding: true, statements: false })
  const [kindFilter, setKindFilter] = useState<TaskBoardKind>('all')
  const [assigneeFilterId, setAssigneeFilterId] = useState('all')
  const [sortBy, setSortBy] = useState<TaskBoardSortBy | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<TaskBoardSortOrder | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const deferredKeyword = useDeferredValue(keyword)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const month = params.get('attribution_month')
    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setAttributionMonth(month > latestAttributionMonth ? latestAttributionMonth : month)
    }
    const company = params.get('q')
    if (company) setKeyword(company)
  }, [])


  const [listRowsApi, setListRowsApi] = useState<TaskBoardListItem[]>([])
  const [statementColumnKeys, setStatementColumnKeys] = useState<string[] | null>(null)
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [pageSize, setPageSize] = useState<TaskBoardPageSize>('all')
  const [preferenceReady, setPreferenceReady] = useState(false)
  const [preferenceSaving, setPreferenceSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPreferenceReady(false)
    setPageSize('all')
    setListPage(1)
    getTaskBoardPreference(scope).then(result => {
      if (!cancelled) { setPageSize(result.page_size); setListPage(1) }
    }).catch(() => {
      if (!cancelled) toast.error('목록 보기 설정을 불러오지 못했습니다. 전체 목록으로 표시합니다.')
    }).finally(() => { if (!cancelled) setPreferenceReady(true) })
    return () => { cancelled = true }
  }, [scope])

  const changePageSize = async (value: TaskBoardPageSize) => {
    if (preferenceSaving) return
    setPreferenceSaving(true)
    try {
      await saveTaskBoardPreference(scope, value)
      setListPage(1)
      setPageSize(value)
    } catch {
      toast.error('보기 설정을 저장하지 못했습니다. 다시 선택해 주세요.')
    } finally { setPreferenceSaving(false) }
  }
  const [listLoading, setListLoading] = useState(false)
  const [listLoaded, setListLoaded] = useState(false)
  const [listPeriod, setListPeriod] = useState('')
  const [earliestRegistrationMonth, setEarliestRegistrationMonth] = useState<string | null>(null)
  const [baseCatalogReady, setBaseCatalogReady] = useState(false)
  const [processCatalogReady, setProcessCatalogReady] = useState(false)
  const [listReloadKey, setListReloadKey] = useState(0)
  const [completionRefreshKey, setCompletionRefreshKey] = useState(0)
  const completionRefreshQueued = useRef(false)
  const monthCache = useRef(new Map<string, TaskBoardListResponse>())
  const displayedListRequest = useRef('')
  const [monthItems, setMonthItems] = useState<Record<number, TaskBoardItem[]>>({})
  const [monthDocuments, setMonthDocuments] = useState<Record<number, TaskItemDocLink[]>>({})
  const [monthColumnNames, setMonthColumnNames] = useState<TaskBoardListResponse['month_column_names']>(null)
  const completionRevision = useRef(0)

  const [savedCustomColumns, setCustomColumns] = useState<CustomColumn[]>(() => seedCustomColumns())
  const [columnCatalog, setColumnCatalog] = useState<ColumnCatalogItem[]>(() => seedColumnCatalog())
  const [companyColumnChecks, setCompanyColumnChecks] = useState<Record<string, boolean>>({})
  const [, setManualMajorColumns] = useState<MajorColumn[]>([])
  const [processTemplateCatalog, setProcessTemplateCatalog] = useState<ProcessTemplateCatalogItem[]>([])
  const [companyMajorChecks, setCompanyMajorChecks] = useState<Record<string, boolean>>({})
  const [isEditMode, setIsEditMode] = useState(false)
  const [importingDefaultsFor, setImportingDefaultsFor] = useState<number | 'all' | null>(null)
  const [isMajorColumnModalOpen, setIsMajorColumnModalOpen] = useState(false)
  const [newMajorColumnName, setNewMajorColumnName] = useState('')
  const [newMajorExecutionMode, setNewMajorExecutionMode] = useState<TaskExecutionMode>('check_only')
  const [newMajorSourceTemplateId, setNewMajorSourceTemplateId] = useState('')
  const [isCreatingMajorColumn, setIsCreatingMajorColumn] = useState(false)
  const [isUpdatingMajorCatalog, setIsUpdatingMajorCatalog] = useState(false)
  const [selectedMajorTemplateIds, setSelectedMajorTemplateIds] = useState<string[]>([])
  const [pendingMajorSelection, setPendingMajorSelection] = useState<string[]>([])

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [pendingColumnSelection, setPendingColumnSelection] = useState<string[]>([])
  const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [isCreatingColumn, setIsCreatingColumn] = useState(false)
  const [isUpdatingCatalog, setIsUpdatingCatalog] = useState(false)
  const [isSavingChecklist, setIsSavingChecklist] = useState(false)
  const [editModeNotice, setEditModeNotice] = useState('')
  const [editingReportCycleCompanyId, setEditingReportCycleCompanyId] = useState<number | null>(null)
  const [updatingReportCycleCompanyId, setUpdatingReportCycleCompanyId] = useState<number | null>(null)
  const editNoticeTimerRef = useRef<number | null>(null)

  const requestIdentity = scope === 'admin' ? getAdminAccessToken() : getClientAccessToken()
  const boardViewportRef = useRef<HTMLDivElement>(null)
  const [boardViewportHeight, setBoardViewportHeight] = useState<number>()

  useEffect(() => {
    const main = boardViewportRef.current?.closest('main')
    if (!main) return
    const updateHeight = () => {
      const css = getComputedStyle(main)
      setBoardViewportHeight(main.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom))
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(main)
    return () => observer.disconnect()
  }, [])

  const panelOpenRequest = useRef(0)
  const [quickWork, setQuickWork] = useState<{
    companyId: number; companyName: string; boardId: number; itemId?: number; month: string; payrollDelivery?: boolean; withholdingDelivery?: boolean
  } | null>(null)
  const reportMonth = monthShift(attributionMonth, 1)
  const notePeriod = `${scope}:${attributionMonth}`
  const visibleNotePeriod = useRef(notePeriod)
  const [editingNote, setEditingNote] = useState<{ companyId: number; text: string; period: string } | null>(null)
  const [isSavingNote, setIsSavingNote] = useState(false)
  useEffect(() => {
    visibleNotePeriod.current = notePeriod
    setEditingNote(null)
  }, [notePeriod])

  const getColumnCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`
  const getMajorCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`

  const listRows = useMemo(() => [...listRowsApi], [listRowsApi])

  const customColumns = useMemo<CustomColumn[]>(() =>
    columnCatalog.map(item => ({ id: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`, name: item.name })), [columnCatalog])
  const visibleBaseColumns = scope === 'admin' ? [
    ...MONTHLY_INCOME_COLUMNS.map(income => customColumns.find(column => getMonthlyIncomeColumn(column.name) === income) ?? income),
    ...customColumns.filter(column => !getMonthlyIncomeColumn(column.name)),
  ] : customColumns
  const [statementIncomePending, setStatementIncomePending] = useState<Record<string, DailyWorkPresence>>({})
  const [targetModes, setTargetModes] = useState<Record<string, TaskTargetMode>>({})
  const [monthlyItems, setMonthlyItems] = useState<Record<string, TaskBoardItem>>({})
  const dirtyCompanies = useRef(new Set<number>())
  const router = useRouter()
  const [pendingCompletion, setPendingCompletion] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const waitBeforeNavigation = (event: MouseEvent) => {
      const pending = workflowCompletionSave.pending
      if (!pending || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.origin !== location.origin || link.pathname === location.pathname || link.download || (link.target && link.target !== '_self')) return
      event.preventDefault()
      const href = link.pathname + link.search + link.hash
      void pending.then(saved => { if (saved) router.push(href) })
    }
    document.addEventListener('click', waitBeforeNavigation, true)
    return () => document.removeEventListener('click', waitBeforeNavigation, true)
  }, [router])

  const completingKeys = useRef(new Set<string>())
  useEffect(() => {
    dirtyCompanies.current.clear()
    setTargetModes({})
    setMonthlyItems({})
  }, [attributionMonth, scope])

  const [checksReady, setChecksReady] = useState(false)
  const [targetingReady, setTargetingReady] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [checksMonth, setChecksMonth] = useState('')
  const checklistBlocked = !targetingReady || listPeriod !== attributionMonth || !baseCatalogReady || !processCatalogReady || !checksReady || checksMonth !== attributionMonth || isSavingChecklist || importingDefaultsFor !== null

  const majorColumns = useMemo<MajorColumn[]>(
    () =>
      processTemplateCatalog

        .map((item) => ({ id: item.id, name: item.name })),
    [processTemplateCatalog]
  )

  const processFileOnlyTemplateOptions = useMemo(
    () =>
      processTemplateCatalog
        .filter((item) => item.executionMode === 'file_only')
        .map((item) => ({ id: item.id, name: item.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [processTemplateCatalog]
  )

  const templateSourceCompanyId = useMemo(() => {
    const ids = listRows
      .map((row) => Number(row.company_id))
      .filter((id) => Number.isFinite(id))
      .sort((a, b) => a - b)
    return ids[0] ?? null
  }, [listRows])

  const loadAllRowsForDefaultsImport = async () => (await listTaskBoards(scope, {
    attribution_month: attributionMonth, report_month: reportMonth, kind: 'all',
    include_excluded: true, all_rows: true,
  })).items

  const assignees = useMemo<AssigneeOption[]>(() => {
    const map = new Map<number, string>()
    listRowsApi.forEach((item) => {
      if (item.assignee_id && item.assignee_name) map.set(Number(item.assignee_id), item.assignee_name)
    })
    const entries = Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    if (assigneeFilterId !== 'all') {
      const currentId = Number(assigneeFilterId)
      if (!Number.isNaN(currentId) && !entries.some((entry) => entry.id === currentId)) {
        entries.unshift({ id: currentId, name: `담당자 #${currentId}` })
      }
    }
    return entries
  }, [assigneeFilterId, listRowsApi])

  const groupedHeaders = scope === 'admin'
  const headerRowSpan = groupedHeaders ? 2 : undefined
  const baseColumnCount = Math.max(1, visibleBaseColumns.length)
  const allStatementColumns = useMemo<ProcessDisplayColumn[]>(() => {
    if (!groupedHeaders) return []
    const remaining = new Map(majorColumns.map(column => [column.id, column]))
    const visibleKeys = new Set(statementColumnKeys ?? [])
    const columns = STATEMENT_HEADINGS.map(({ name, heading = name, aliases = [] }) => {
      const names = [name, ...aliases].map(normalizeText)
      const statementKey = normalizeText(name)
      const existing = majorColumns.find(column => remaining.has(column.id) && names.includes(normalizeText(column.name)))
      if (!existing) return { id: `statement:${statementKey}`, name, heading, statementKey }
      remaining.delete(existing.id)
      return { ...existing, heading, statementKey }
    })
    const additional: ProcessDisplayColumn[] = [...remaining.values()]
      .filter(column => normalizeText(column.name).includes('지급명세서'))
      .map(column => ({ ...column, statementKey: normalizeText(column.name) }))
    for (const key of visibleKeys) {
      if ([...columns, ...additional].some(column => column.statementKey === key)) continue
      const name = listRows.find(row => row.statement_tasks?.some(task => task.key === key))
        ?.statement_tasks?.find(task => task.key === key)?.item_name ?? key
      additional.push({ id: `statement:${key}`, name, statementKey: key })
    }
    return [...columns, ...additional]
  }, [groupedHeaders, majorColumns, statementColumnKeys, listRows])
  const statementIds = new Set(allStatementColumns.map(column => column.id))
  const visibleStatementKeys = new Set(listPeriod === attributionMonth ? statementColumnKeys : null)
  const statementColumns = allStatementColumns.filter(column => statementColumnKeys === null
    ? majorColumns.some(existing => existing.id === column.id)
    : visibleStatementKeys.has(column.statementKey ?? ''))
  const withholdingColumns: ProcessDisplayColumn[] = majorColumns.filter(column => !statementIds.has(column.id))
  const processGroups = [
    {
      key: 'withholding' as const,
      label: '원천세 업무',
      shortLabel: '원',
      fallbackTitle: '업무진행',
      columns: withholdingColumns,
      expanded: !groupedHeaders || expandedGroups.withholding,
    },
    ...(groupedHeaders ? [{
      key: 'statements' as const,
      label: '지급명세서 업무',
      shortLabel: '지',
      fallbackTitle: '표시할 업무 없음',
      columns: statementColumns,
      expanded: expandedGroups.statements,
    }] : []),
  ]
  const processColumnCount = processGroups.reduce((count, group) => count + (group.expanded ? Math.max(1, group.columns.length) : 1), 0)
  const showProgressColumns = !groupedHeaders
  const tableColumnCount = 8 + baseColumnCount + processColumnCount + Number(isEditMode) + (showProgressColumns ? 2 : 0)
  const columnAllCheckedMap = useMemo(() => {
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const map: Record<string, boolean> = {}
    customColumns.forEach((column) => {
      map[column.id] =
        activeRows.length > 0 && activeRows.every((row) => companyColumnChecks[getColumnCheckKey(row.company_id, column.id)])
    })
    return map
  }, [listRows, customColumns, companyColumnChecks])

  const majorColumnAllCheckedMap = useMemo(() => {
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const map: Record<string, boolean> = {}
    majorColumns.forEach((column) => {
      map[column.id] =
        activeRows.length > 0 && activeRows.every((row) => companyMajorChecks[getMajorCheckKey(row.company_id, column.id)])
    })
    return map
  }, [listRows, majorColumns, companyMajorChecks])

  useEffect(() => {
    setListPage(1)
  }, [scope, attributionMonth, reportMonth, deferredKeyword, kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, sortBy, sortOrder])

  const listRequest = JSON.stringify([
    scope, requestIdentity, attributionMonth, reportMonth, deferredKeyword,
    kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, sortBy, sortOrder, listPage, pageSize,
  ])

  const applyMonthResponse = useCallback((response: TaskBoardListResponse, month: string) => {
    setTargetingReady(response.targeting_version === 1)
    setListPeriod(month)
    setStatementColumnKeys(response.statement_columns ?? null)
    setMonthItems(response.month_items ?? {})
    setMonthDocuments(response.month_documents ?? {})
    setMonthColumnNames(response.month_column_names)
    setEarliestRegistrationMonth(response.earliest_registration_month ?? null)
    setListRowsApi(response.items)
    setListTotal(response.total)
    setListLoaded(true)
    setCheckError('')
  }, [])

  useLayoutEffect(() => {
    if (!preferenceReady || displayedListRequest.current === listRequest) return
    const cached = monthCache.current.get(listRequest)
    if (cached) {
      displayedListRequest.current = listRequest
      applyMonthResponse(cached, attributionMonth)
      setListLoading(false)
    }
  }, [applyMonthResponse, attributionMonth, listRequest, preferenceReady])

  useEffect(() => {
    let cancelled = false
    if (!preferenceReady) return
    const background = displayedListRequest.current === listRequest
    const loadList = async () => {
      if (!background) setListLoading(true)
      try {
        await workflowCompletionSave.pending
        if (cancelled) return
        const revision = completionRevision.current
        const loadAll = pageSize === 'all'
        const response = await listTaskBoards(scope, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          q: deferredKeyword.trim() || undefined,
          kind: kindFilter,
          assignee_id: assigneeFilterId !== 'all' ? Number(assigneeFilterId) : undefined,
          incomplete_only: incompleteOnly,
          include_excluded: includeExcluded,
          include_statement_tasks: scope === 'admin' || undefined,
          include_month_items: true,
          all_rows: loadAll || undefined,
          sort_by: sortBy,
          order: sortOrder,
          page: loadAll ? 1 : listPage,
          size: loadAll ? TASK_BOARD_EDIT_PAGE_SIZE : Number(pageSize),
        })
        if (cancelled || (background && completionRevision.current !== revision)) return
        if (!response.month_items || !response.month_column_names) {
          throw new Error('서버에 월별 업무표 변경 사항을 배포한 후 다시 불러와 주세요.')
        }
        const cache = monthCache.current
        cache.delete(listRequest)
        cache.set(listRequest, response)
        const oldest = cache.keys().next()
        if (cache.size > 12 && !oldest.done) cache.delete(oldest.value)
        displayedListRequest.current = listRequest
        applyMonthResponse(response, attributionMonth)
      } catch (error) {
        if (cancelled) return
        if (!background) {
          displayedListRequest.current = ''
          setListPeriod('')
          setListRowsApi([])
          setMonthItems({})
          setMonthDocuments({})
          setMonthColumnNames(null)
          setStatementColumnKeys(null)
          setListTotal(0)
          setListLoaded(true)
          toast.error(getTaskBoardErrorMessage(error))
        } else {
          setCheckError('최신 업무표를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')
        }
      } finally {
        if (!cancelled && !background) setListLoading(false)
      }
    }
    void loadList()
    return () => { cancelled = true }
  }, [applyMonthResponse, listRequest, scope, attributionMonth, reportMonth, deferredKeyword, kindFilter,
    assigneeFilterId, incompleteOnly, includeExcluded, sortBy, sortOrder, listPage, listReloadKey,
    pageSize, preferenceReady, completionRefreshKey])

  useEffect(() => {
    let cancelled = false
    const loadTemplateCatalog = async () => {
      setBaseCatalogReady(false)
      try {
        const res = await listGlobalTaskTemplates(scope, {
          includeInactive: false,
          templateKind: 'base',
        })
        if (cancelled) return
        setBaseCatalogReady(true)
        setColumnCatalog(
          (res.items || []).map((item) => ({
            id: `template-${item.id}`,
            name: item.task_name,
            templateId: item.id,
            sortOrder: item.sort_order ?? 100,
          }))
        )
      } catch {
        if (cancelled) return
        setColumnCatalog([])
        toast.error('기준업무 목록을 불러오지 못했습니다. 새로고침해 주세요.')
      }
    }
    void loadTemplateCatalog()
    return () => {
      cancelled = true
    }
  }, [scope, templateSourceCompanyId])

  useEffect(() => {
    let cancelled = false
    const loadProcessTemplateCatalog = async () => {
      setProcessCatalogReady(false)
      try {
        const res = await listGlobalTaskTemplates(scope, {
          includeInactive: false,
          templateKind: 'process',
        })
        if (cancelled) return
        const templateNameById = new Map<number, string>()
        ;(res.items || []).forEach((item) => templateNameById.set(item.id, item.task_name))
        const mapped = (res.items || []).map((item) => ({
          id: `process-template-${item.id}`,
          name: item.task_name,
          templateId: item.id,
          executionMode: item.execution_mode ?? 'check_only',
          sortOrder: item.sort_order ?? 100,
          sourceTaskName:
            item.source_task_name?.trim() ||
            item.source_template_name?.trim() ||
            (item.source_template_id ? templateNameById.get(item.source_template_id)?.trim() || null : null),
        }))
        const sorted = mapped.sort((a, b) => (a.sortOrder === b.sortOrder ? a.name.localeCompare(b.name, 'ko') : a.sortOrder - b.sortOrder))
        setProcessCatalogReady(true)
        setProcessTemplateCatalog(sorted)
        setManualMajorColumns(sorted.map((item) => ({ id: item.id, name: item.name })))
      } catch {
        if (cancelled) return
        setProcessTemplateCatalog([])
        toast.error('업무진행 목록을 불러오지 못했습니다. 새로고침해 주세요.')
      }
    }
    void loadProcessTemplateCatalog()
    return () => {
      cancelled = true
    }
  }, [scope, templateSourceCompanyId])

  useEffect(() => {
    const validIds = processTemplateCatalog.map((item) => item.id)
    setSelectedMajorTemplateIds((prev) => {
      return prev.filter((id) => validIds.includes(id))
    })
    setPendingMajorSelection((prev) => prev.filter((id) => validIds.includes(id)))
  }, [processTemplateCatalog])

  useLayoutEffect(() => {
    if (listPeriod !== attributionMonth || !monthColumnNames) return
    const baseNames = new Set(monthColumnNames.base.map(normalizeText))
    const processNames = new Set(monthColumnNames.process.map(normalizeText))
    setCustomColumns(columnCatalog
      .filter(item => baseNames.has(normalizeText(item.name)))
      .map(item => ({ id: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`, name: item.name })))
    setSelectedMajorTemplateIds(processTemplateCatalog
      .filter(item => processNames.has(normalizeText(item.name)))
      .map(item => item.id))
  }, [attributionMonth, listPeriod, monthColumnNames, columnCatalog, processTemplateCatalog])

  useLayoutEffect(() => {
    if (listPeriod !== attributionMonth) return
    const nextModes: Record<string, TaskTargetMode> = {}
    const nextItems: Record<string, TaskBoardItem> = {}
    const nextColumnChecks: Record<string, boolean> = {}
    const nextMajorChecks: Record<string, boolean> = {}

    for (const row of listRowsApi) {
      const itemsByName = new Map((monthItems[row.board_id ?? -1] ?? []).map(item => [normalizeText(item.task_name), item]))
      for (const [name, item] of itemsByName) nextItems[`${row.company_id}:${name}`] = item
      for (const column of customColumns) {
        const item = itemsByName.get(normalizeText(column.name))
        nextColumnChecks[getColumnCheckKey(row.company_id, column.id)] = Boolean(item && item.target_active !== false && item.status !== 'na')
      }
      for (const column of majorColumns) {
        const key = getMajorCheckKey(row.company_id, column.id)
        const item = itemsByName.get(normalizeText(column.name))
        nextMajorChecks[key] = Boolean(item && item.target_active !== false && item.status !== 'na')
        nextModes[key] = item?.target_mode ?? 'auto'
      }
    }

    const preserveDirty = <T,>(previous: Record<string, T>, next: Record<string, T>) => ({
      ...next,
      ...Object.fromEntries(Object.entries(previous).filter(([key]) => dirtyCompanies.current.has(Number(key.split(':')[0])))),
    })
    setTargetModes(previous => preserveDirty(previous, nextModes))
    setMonthlyItems(nextItems)
    setCompanyColumnChecks(previous => preserveDirty(previous, nextColumnChecks))
    setCompanyMajorChecks(previous => preserveDirty(previous, nextMajorChecks))
    setChecksMonth(attributionMonth)
    setChecksReady(true)
  }, [attributionMonth, listPeriod, listRowsApi, monthItems, customColumns, majorColumns])

  useEffect(() => {
    if (listPeriod !== attributionMonth || !processTemplateCatalog.length) return
    const sourceByTaskNorm = new Map<string, string>()
    for (const row of listRowsApi) {
      for (const item of monthItems[row.board_id ?? -1] ?? []) {
        const task = normalizeText(item.task_name)
        const source = item.source_task_name?.trim()
        if (task && source && !sourceByTaskNorm.has(task)) sourceByTaskNorm.set(task, source)
      }
    }
    if (!sourceByTaskNorm.size) return
    setProcessTemplateCatalog(previous => previous.map(item => {
      const source = sourceByTaskNorm.get(normalizeText(item.name))
      return source && source !== item.sourceTaskName ? { ...item, sourceTaskName: source } : item
    }))
  }, [attributionMonth, listPeriod, listRowsApi, monthItems, processTemplateCatalog.length])

  const renderStatus = (status: TaskItemStatus) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )

  const getProgressBarClass = (percent: number) => {
    if (percent <= 0) return 'bg-zinc-300'
    if (percent >= 100) return 'bg-emerald-600'
    if (percent >= 60) return 'bg-emerald-500'
    return 'bg-emerald-300'
  }

  useLayoutEffect(() => {
    if (attributionMonth > latestAttributionMonth) {
      setListPage(1)
      setAttributionMonth(latestAttributionMonth)
    } else if (earliestRegistrationMonth && earliestRegistrationMonth <= latestAttributionMonth && attributionMonth < earliestRegistrationMonth) {
      setListPage(1)
      setAttributionMonth(earliestRegistrationMonth)
    }
  }, [attributionMonth, earliestRegistrationMonth, latestAttributionMonth])

  const changeBoardMonth = (month: string) => {
    if (month > latestAttributionMonth || (earliestRegistrationMonth && month < earliestRegistrationMonth)) return
    setListPage(1)
    setAttributionMonth(month)
  }

  const handleToggleSort = (field: TaskBoardSortBy) => {
    if (sortBy !== field) {
      setSortBy(field)
      setSortOrder('desc')
      setListPage(1)
      return
    }
    if (sortOrder === 'desc') {
      setSortOrder('asc')
      setListPage(1)
      return
    }
    setSortBy(undefined)
    setSortOrder(undefined)
    setListPage(1)
  }

  const renderSortIcon = (field: TaskBoardSortBy) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 text-zinc-400" aria-hidden="true" />
    if (sortOrder === 'asc') return <ChevronUp className="h-3 w-3 text-sky-700" aria-hidden="true" />
    return <ChevronDown className="h-3 w-3 text-sky-700" aria-hidden="true" />
  }

  const refreshAfterCompletion = () => {
    if (completionRefreshQueued.current) return
    completionRefreshQueued.current = true
    const refreshWhenIdle = () => {
      const pending = workflowCompletionSave.pending
      if (pending) {
        void pending.then(refreshWhenIdle, refreshWhenIdle)
        return
      }
      completionRefreshQueued.current = false
      setCompletionRefreshKey(previous => previous + 1)
    }
    refreshWhenIdle()
  }

  const queueStatementSave = (update: () => Promise<void>) => {
    const save = Promise.resolve(workflowCompletionSave.pending).then(async () => {
      try {
        await update()
        refreshAfterCompletion()
        return true
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
        return false
      } finally {
        if (workflowCompletionSave.pending === save) workflowCompletionSave.pending = null
      }
    })
    workflowCompletionSave.pending = save
    return save
  }

  const saveStatementIncome = async (row: TaskBoardListItem, kind: StatementIncomeKind, value: DailyWorkPresence) => {
    const key = `${attributionMonth}:${row.company_id}:${kind}`
    if (checklistBlocked || row.is_excluded || statementIncomePending[key] !== undefined) return
    setStatementIncomePending(previous => ({ ...previous, [key]: value }))
    await queueStatementSave(async () => {
      await patchStatementIncome(row.company_id, {
        income_kind: kind, presence: value, attribution_month: attributionMonth, report_month: reportMonth,
      })
      if (visibleNotePeriod.current === notePeriod) {
        const field = kind === 'daily' ? 'daily_work_presence' : `${kind}_income_presence`
        setListRowsApi(rows => rows.map(item => item.company_id === row.company_id
          ? { ...item, [field]: value } : item))
      }
    })
    setStatementIncomePending(previous => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  const saveStatementTracking = (row: TaskBoardListItem, statement: TaskBoardStatement, change: StatementTrackingChange) => {
    if (checklistBlocked || !statement.editable) return Promise.resolve(false)
    const sourceMonth = statement.source_attribution_month ?? attributionMonth
    return queueStatementSave(async () => {
      const saved = await patchStatementTracking(row.company_id, {
        attribution_month: sourceMonth,
        report_month: monthShift(sourceMonth, 1),
        key: statement.key,
        item_id: statement.item_id,
        ...change,
      })
      if (visibleNotePeriod.current === notePeriod) {
        setListRowsApi(rows => rows.map(item => item.company_id === row.company_id ? {
          ...item,
          statement_tasks: item.statement_tasks?.map(task => task.key === statement.key ? {
            ...task,
            item_id: saved.item_id,
            status: saved.status === 'done' ? 'submitted' : task.status === 'submitted' ? 'due' : task.status,
            work_status: saved.status,
            processed_on: saved.processed_on,
          } : task),
        } : item))
      }
    })
  }

  const saveBoardNote = (row: TaskBoardListItem) => {
    const draft = editingNote
    if (!draft || draft.companyId !== row.company_id || draft.period !== notePeriod || isSavingNote) return
    const note = draft.text.trim() || null
    if (note === (row.note || null)) {
      setEditingNote(null)
      return
    }
    if (isSavingChecklist) {
      toast('저장 중인 작업이 끝난 뒤 다시 저장해 주세요.')
      return
    }

    setIsSavingNote(true)
    const previousSave = workflowCompletionSave.pending
    const save = Promise.resolve(previousSave).then(async () => {
      try {
        const period = { attribution_month: attributionMonth, report_month: reportMonth }
        const boardId = row.board_id ?? (await ensureTaskBoard(scope, row.company_id, {
          ...period,
          copy_from_previous: true,
        })).board.id
        const saved = await patchTaskBoardNote(scope, row.company_id, { ...period, note })
        if (visibleNotePeriod.current === draft.period) {
          setListRowsApi(rows => rows.map(item => item.company_id === row.company_id
            ? { ...item, board_id: boardId, note: saved.note }
            : item))
          setEditingNote(current => current === draft ? null : current)
        }
        setListReloadKey(previous => previous + 1)
        toast.success('비고를 저장했습니다.')
        return true
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
        return false
      } finally {
        setIsSavingNote(false)
        if (workflowCompletionSave.pending === save) workflowCompletionSave.pending = null
      }
    })
    workflowCompletionSave.pending = save
  }

  const handleToggleExclude = async (row: TaskBoardListItem) => {
    try {
      const nextExcluded = !row.is_excluded
      if (row.board_id) {
        await patchTaskBoardExclude(scope, row.company_id, row.board_id, nextExcluded)
      } else {
        await patchTaskBoardExcludeByMonth(scope, row.company_id, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          is_excluded: nextExcluded,
        })
      }
      toast.success('제외 상태를 변경했습니다.')
      setListReloadKey((prev) => prev + 1)
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    }
  }

  const toggleCompanyColumnValue = (companyId: number, columnId: string) => {
    if (!isEditMode || checklistBlocked) return
    dirtyCompanies.current.add(companyId)
    const key = getColumnCheckKey(companyId, columnId)
    setCompanyColumnChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleColumnAll = (columnId: string) => {
    if (!isEditMode || checklistBlocked) return
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const allChecked = activeRows.length > 0 && activeRows.every((row) => companyColumnChecks[getColumnCheckKey(row.company_id, columnId)])
    setCompanyColumnChecks((prev) => {
      const next = { ...prev }
      activeRows.forEach((row) => {
        dirtyCompanies.current.add(row.company_id)
        next[getColumnCheckKey(row.company_id, columnId)] = !allChecked
      })
      return next
    })
    toast.success(allChecked ? '열 전체 선택을 해제했습니다.' : '열 전체 선택을 적용했습니다.')
  }

  const toggleCompanyMajorValue = (companyId: number, columnId: string) => {
    if (!isEditMode || checklistBlocked) return
    const key = getMajorCheckKey(companyId, columnId)
    setCompanyMajorChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleMajorColumnAll = (columnId: string) => {
    if (!isEditMode || checklistBlocked) return
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const allChecked =
      activeRows.length > 0 && activeRows.every((row) => companyMajorChecks[getMajorCheckKey(row.company_id, columnId)])
    setCompanyMajorChecks((prev) => {
      const next = { ...prev }
      activeRows.forEach((row) => {
        next[getMajorCheckKey(row.company_id, columnId)] = !allChecked
      })
      return next
    })
    toast.success(allChecked ? '열 전체 선택을 해제했습니다.' : '열 전체 선택을 적용했습니다.')
  }

  const addMajorColumn = () => {
    if (isCreatingMajorColumn) return
    const name = newMajorColumnName.trim()
    if (!name) {
      toast.error('주요업무명을 입력해 주세요.')
      return
    }
    const id = `major-${normalizeText(name)}`
    if (majorColumns.some((column) => column.id === id)) {
      toast.error('이미 등록된 주요업무입니다.')
      return
    }
    if (!templateSourceCompanyId) {
      toast.error('업체 리스트를 먼저 불러와 주세요.')
      return
    }

    void (async () => {
      try {
        setIsCreatingMajorColumn(true)
        const selectedSourceTemplate =
          newMajorExecutionMode === 'check_only'
            ? processTemplateCatalog.find((item) => item.id === newMajorSourceTemplateId) ?? null
            : null
        const nextSortOrder =
          processTemplateCatalog.length > 0
            ? Math.max(...processTemplateCatalog.map((item) => item.sortOrder || 0)) + 10
            : 10
        const created = await createTaskTemplate(scope, templateSourceCompanyId, {
          task_name: name,
          sort_order: nextSortOrder,
          template_kind: 'process',
          execution_mode: newMajorExecutionMode,
          source_template_id:
            newMajorExecutionMode === 'check_only' && selectedSourceTemplate
              ? selectedSourceTemplate.templateId
              : null,
        })
        const nextCatalogItem: ProcessTemplateCatalogItem = {
          id: `process-template-${created.id}`,
          name: created.task_name,
          templateId: created.id,
          executionMode: created.execution_mode ?? newMajorExecutionMode,
          sortOrder: created.sort_order ?? nextSortOrder,
          sourceTaskName: selectedSourceTemplate?.name ?? null,
        }
        setProcessTemplateCatalog((prev) =>
          [...prev, nextCatalogItem].sort((a, b) => (a.sortOrder === b.sortOrder ? a.name.localeCompare(b.name, 'ko') : a.sortOrder - b.sortOrder))
        )
        setManualMajorColumns((prev) => [...prev, { id: nextCatalogItem.id, name: nextCatalogItem.name }])
        setNewMajorColumnName('')
        setNewMajorExecutionMode('check_only')
        setNewMajorSourceTemplateId('')
        toast.success('업무진행 템플릿이 등록되었습니다.')
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
      } finally {
        setIsCreatingMajorColumn(false)
      }
    })()
  }

  const saveTaskStatus = (companyId: number, boardId: number, taskId: number, status: TaskItemStatus, item?: TaskBoardItem) => {
    const mode = item?.execution_mode_snapshot ?? 'check_only'
    if (status === 'done' && (mode === 'file_and_notify' || (mode === 'check_only' && item?.source_item_id))) {
      return deliverTaskBoardItem(scope, companyId, boardId, taskId)
    }
    return updateTaskBoardItem(scope, companyId, boardId, taskId, { status })
  }

  const getDefaultTitleFromFile = (fileName: string) => {
    const idx = fileName.lastIndexOf('.')
    if (idx <= 0) return fileName
    return fileName.slice(0, idx)
  }

  const uploadTaskFilesWithFallback = async (taskId: number, files: File[], companyId: number, boardId: number) => {
    if (!companyId || !boardId) {
      return { total: files.length, successCount: 0, failedCount: files.length, firstError: '업체/보드 정보가 없습니다.' }
    }
    try {
      const res = await bulkUploadTaskItemFiles(scope, companyId, boardId, taskId, {
        files,
        titles: files.map((file) => getDefaultTitleFromFile(file.name)),
      })
      return {
        total: res.total,
        successCount: res.success_count,
        failedCount: res.failed_count,
        firstError: res.failed_items?.[0]?.error,
        failedIndexes: res.failed_items.map(item => item.index),
        failedItems: res.failed_items,
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status !== 422) throw error

      let successCount = 0
      let failedCount = 0
      let firstError = ''
      const failedIndexes: number[] = []
      const failedItems: { index: number; error: string }[] = []
      for (const [index, file] of files.entries()) {
        try {
          await uploadTaskItemFile(scope, companyId, boardId, taskId, {
            file,
            title: getDefaultTitleFromFile(file.name),
          })
          successCount += 1
        } catch (singleError) {
          failedCount += 1
          failedIndexes.push(index)
          const reason = getTaskBoardErrorMessage(singleError)
          failedItems.push({ index, error: reason })
          if (!firstError) firstError = reason
        }
      }
      return { total: files.length, successCount, failedCount, firstError, failedIndexes, failedItems }
    }
  }

  const applySelectedColumns = () => {
    const selectedCatalogItems = columnCatalog.filter((item) => pendingColumnSelection.includes(item.id))
    const nextColumns = selectedCatalogItems.map((item) => ({
      id: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`,
      name: item.name,
    }))

    setCustomColumns(nextColumns)
    setCompanyColumnChecks((prev) => {
      const next: Record<string, boolean> = {}
      nextColumns.forEach((column) => {
        listRows.forEach((row) => {
          const key = getColumnCheckKey(row.company_id, column.id)
          next[key] = prev[key] ?? false
        })
      })
      return next
    })
    setPendingColumnSelection([])
    setIsColumnModalOpen(false)
    toast.success('업무 컬럼을 반영했습니다.')
  }

  const applySelectedMajorColumns = () => {
    const selectedIds = processTemplateCatalog
      .filter((item) => pendingMajorSelection.includes(item.id))
      .map((item) => item.id)

    setSelectedMajorTemplateIds(selectedIds)
    setPendingMajorSelection(selectedIds)
    setIsMajorColumnModalOpen(false)
    toast.success('업무진행 컬럼을 반영했습니다.')
  }

  const createCatalogColumn = () => {
    if (isCreatingColumn) return
    const trimmed = newColumnName.trim()
    if (!trimmed) {
      toast.error('컬럼명을 입력해 주세요.')
      return
    }

    const duplicatedInCatalog = columnCatalog.some((item) => normalizeText(item.name) === normalizeText(trimmed))
    if (duplicatedInCatalog) {
      toast.error('이미 존재하는 컬럼명입니다.')
      return
    }

    if (!templateSourceCompanyId) {
      toast.error('업체 리스트를 먼저 불러와 주세요.')
      return
    }
    void (async () => {
      try {
        setIsCreatingColumn(true)
        const created = await createTaskTemplate(scope, templateSourceCompanyId, {
          task_name: trimmed,
          sort_order: 100,
          template_kind: 'base',
        })
        const nextCatalogItem: ColumnCatalogItem = {
          id: `template-${created.id}`,
          name: created.task_name,
          templateId: created.id,
          sortOrder: created.sort_order ?? 100,
        }
        setColumnCatalog((prev) => [...prev, nextCatalogItem])
        setPendingColumnSelection((prev) => [...prev, nextCatalogItem.id])
        setNewColumnName('')
        setIsCreateColumnModalOpen(false)
        toast.success('업무 템플릿이 등록되었습니다.')
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
      } finally {
        setIsCreatingColumn(false)
      }
    })()
  }

  const syncTemplateSortOrders = async (nextList: ColumnCatalogItem[]) => {
    try {
      setIsUpdatingCatalog(true)
      await reorderGlobalTaskTemplates(scope, 'base', nextList.map(item => item.templateId))
      return true
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
      return false
    } finally {
      setIsUpdatingCatalog(false)
    }
  }

  const moveCatalogColumn = async (templateId: number, direction: 'up' | 'down') => {
    if (isUpdatingCatalog) return
    const index = columnCatalog.findIndex((item) => item.templateId === templateId)
    if (index < 0) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= columnCatalog.length) return

    const next = [...columnCatalog]
    const [picked] = next.splice(index, 1)
    next.splice(targetIndex, 0, picked)

    const ok = await syncTemplateSortOrders(next)
    if (!ok) return
    setColumnCatalog(next.map((item, idx) => ({ ...item, sortOrder: (idx + 1) * 10 })))
  }

  const removeCatalogColumn = async (templateId: number) => {
    if (isUpdatingCatalog) return
    const target = columnCatalog.find(item => item.templateId === templateId)
    if (!target) return
    setIsUpdatingCatalog(true)
    try {
      const ok = await confirm({
        title: '공통 기준업무 삭제',
        description: `[${target.name}]을 사무소의 공통 목록에서 삭제하시겠습니까? 새로 생성되는 월별 업무에서 제외되며 기존 업무와 파일은 업체 상세에 보존됩니다.`,
        confirmText: '삭제',
        cancelText: '취소',
        variant: 'danger',
      })
      if (!ok) return
      await archiveGlobalBaseTaskTemplate(scope, templateId)
      setColumnCatalog(previous => previous.filter(item => item.templateId !== templateId))
      setPendingColumnSelection(previous => previous.filter(id => id !== target.id))
      toast.success('공통 기준업무를 삭제했습니다.')
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setIsUpdatingCatalog(false)
    }
  }

  const syncProcessTemplateSortOrders = async (nextList: ProcessTemplateCatalogItem[]) => {
    try {
      setIsUpdatingMajorCatalog(true)
      await reorderGlobalTaskTemplates(scope, 'process', nextList.map(item => item.templateId))
      return true
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
      return false
    } finally {
      setIsUpdatingMajorCatalog(false)
    }
  }

  const moveProcessTemplate = async (templateId: number, direction: 'up' | 'down') => {
    if (isUpdatingMajorCatalog) return
    const index = processTemplateCatalog.findIndex((item) => item.templateId === templateId)
    if (index < 0) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= processTemplateCatalog.length) return

    const next = [...processTemplateCatalog]
    const [picked] = next.splice(index, 1)
    next.splice(targetIndex, 0, picked)

    const ok = await syncProcessTemplateSortOrders(next)
    if (!ok) return
    const normalized = next.map((item, idx) => ({ ...item, sortOrder: (idx + 1) * 10 }))
    setProcessTemplateCatalog(normalized)
    setManualMajorColumns(normalized.map((item) => ({ id: item.id, name: item.name })))
  }

  const handleImportMonthDefaults = async (row?: TaskBoardListItem) => {
    if (scope !== 'admin' || !isEditMode || row?.is_excluded || checklistBlocked || workflowCompletionSave.pending) return
    setImportingDefaultsFor(row?.company_id ?? 'all')
    try {
      const rows = row ? [row] : await loadAllRowsForDefaultsImport()
      const companies = [...new Map(rows.filter(item => !item.is_excluded).map(item => [
        item.company_id, { companyId: item.company_id, companyName: item.company_name },
      ])).values()]
      const { imported, failed } = await importMonthTaskDefaultsForCompanies(attributionMonth, companies)
      const additions = imported.filter(({ preview }) => preview.task_names.length > 0)
      if (!additions.length) {
        if (failed.length) toast.error(`${failed[0].companyName} · ${failed[0].message}${failed.length > 1 ? ` 외 ${failed.length - 1}개 거래처` : ''}`)
        else toast('불러올 기준업무가 없습니다.')
        return
      }
      const approved = await confirm({
        title: row ? `${row.company_name} 기준업무 불러오기` : '기준업무 일괄 불러오기',
        description: (
          <>
            <p>{attributionMonth} 귀속의 {additions.length}개 거래처에 기준업무를 추가합니다.</p>
            {!row && <p className="mt-1 text-xs text-zinc-500">현재 검색·필터와 관계없이 이 달의 거래처 전체를 확인했습니다.</p>}
            <ul className="mt-2 max-h-[40vh] divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200 px-2">
              {additions.map(({ companyId, companyName, preview }) => (
                <li key={companyId} className="py-2">
                  <p className="font-medium text-zinc-800">{companyName}</p>
                  <p className="text-xs text-zinc-500">{preview.source === 'previous' ? `${preview.source_month} 귀속 기준업무` : '거래처 기본 설정'}</p>
                  <p className="mt-0.5 break-words">{preview.task_names.join(' · ')}</p>
                </li>
              ))}
              {failed.map(({ companyId, companyName, message }) => (
                <li key={companyId} className="py-2 text-xs text-rose-700">{companyName} · {message}</li>
              ))}
            </ul>
          </>
        ),
        confirmText: '불러오기',
        cancelText: '취소',
      })
      if (!approved) return

      const save = importMonthTaskDefaultsForCompanies(attributionMonth, additions.map(({ companyId, companyName, preview }) => ({
        companyId, companyName, expectedTaskNames: preview.task_names,
      }))).then(result => {
        // Keep draft edits in other cells while marking the newly saved tasks.
        const updatedChecks: Record<string, boolean> = {}
        let taskCount = 0
        for (const { companyId, preview } of result.imported) {
          taskCount += preview.task_names.length
          const importedNames = new Set(preview.task_names.map(normalizeText))
          for (const column of customColumns) {
            if (importedNames.has(normalizeText(column.name))) updatedChecks[getColumnCheckKey(companyId, column.id)] = true
          }
        }
        setCompanyColumnChecks(previous => ({ ...previous, ...updatedChecks }))
        setListReloadKey(previous => previous + 1)
        if (taskCount) toast.success(`${result.imported.length}개 거래처에 기준업무 ${taskCount}건을 추가했습니다.`)
        if (result.failed.length) {
          const { companyName, message } = result.failed[0]
          toast.error(`${result.failed.length}개 거래처 적용 실패 · ${companyName}: ${message}`)
        }
        return result.failed.length === 0
      }).catch(error => {
        toast.error(getTaskBoardErrorMessage(error))
        return false
      })
      workflowCompletionSave.pending = save
      try {
        await save
      } finally {
        if (workflowCompletionSave.pending === save) workflowCompletionSave.pending = null
      }
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setImportingDefaultsFor(null)
    }
  }

  const saveChecklistSelections = async () => {
    if (checklistBlocked) return false
    setIsSavingChecklist(true)
    try {
      for (const row of listRows.filter(row => !row.is_excluded && dirtyCompanies.current.has(row.company_id))) {
        const boardId = row.board_id ?? (await ensureTaskBoard(scope, row.company_id, {
          attribution_month: attributionMonth, report_month: reportMonth, copy_from_previous: true,
        })).board.id
        const templates = (await listTaskTemplates(scope, row.company_id, { includeInactive: false })).items
        const targets = [
          ...customColumns.map(column => ({ ...column, kind: 'base' as const })),
          ...majorColumns.map(column => ({ ...column, kind: 'process' as const })),
        ]
        const items = []
        for (const target of targets) {
          const existing = templates.find(t => t.template_kind === target.kind && normalizeText(t.task_name) === normalizeText(target.name))
          const template = existing ?? await createTaskTemplate(scope, row.company_id, {
            task_name: target.name, template_kind: target.kind, sort_order: 100,
            execution_mode: target.kind === 'process'
              ? processTemplateCatalog.find(t => t.id === target.id)?.executionMode ?? 'check_only' : undefined,
          })
          const mode: TaskTargetMode = target.kind === 'base'
            ? companyColumnChecks[getColumnCheckKey(row.company_id, target.id)] ? 'required' : 'excluded'
            : targetModes[getMajorCheckKey(row.company_id, target.id)] ?? 'auto'
          items.push({ template_id: template.id, task_name: target.name, selected: true, target_mode: mode })
        }
        const saved = await bulkUpsertTaskBoardItems(scope, row.company_id, boardId, { items }, { returnItems: true })
        const savedItems = saved.items ?? (await listTaskBoardItems(scope, row.company_id, boardId)).items
        const sourceLinks = majorColumns.flatMap(column => {
          const process = savedItems.find(item => normalizeText(item.task_name) === normalizeText(column.name))
          const sourceName = processTemplateCatalog.find(item => item.id === column.id)?.sourceTaskName
          const source = sourceName ? savedItems.find(item => normalizeText(item.task_name) === normalizeText(sourceName)) : undefined
          if (!process || (sourceName && !source) || (process.source_item_id ?? null) === (source?.id ?? null)) return []
          return [{ task_name: column.name, selected: true,
            target_mode: targetModes[getMajorCheckKey(row.company_id, column.id)] ?? 'auto',
            source_item_id: source?.id ?? null }]
        })
        if (sourceLinks.length) await bulkUpsertTaskBoardItems(scope, row.company_id, boardId, { items: sourceLinks })
        dirtyCompanies.current.delete(row.company_id)
      }
      setListReloadKey(prev => prev + 1)
      return true
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
      setListReloadKey(prev => prev + 1)
      return false
    } finally { setIsSavingChecklist(false) }
  }

  const isProcessTarget = (row: TaskBoardListItem, column: Pick<MajorColumn, "id" | "name">) => {
    const key = getMajorCheckKey(row.company_id, column.id)
    if (!isEditMode) return companyMajorChecks[key] ?? false
    const mode = targetModes[key] ?? 'auto'
    if (mode !== 'auto') return mode === 'required'
    const hasBase = customColumns.some(c => companyColumnChecks[getColumnCheckKey(row.company_id, c.id)])
    const deferred = row.report_cycle === 'semiannual' && !['01', '07'].includes(reportMonth.slice(-2)) &&
      ['원천세신고', '원천세신고서작성', '원천세신고서제출', '원천세납부서전달', '원천세납부안내', '납부서전달'].includes(normalizeText(column.name))
    return hasBase && !deferred
  }

  const openTaskPanel = (row: TaskBoardListItem, itemId?: number, delivery?: {
    payrollDelivery: boolean; withholdingDelivery: boolean
  }) => {
    if (listPeriod !== attributionMonth) return
    const request = ++panelOpenRequest.current
    const open = (boardId: number) => setQuickWork({
      companyId: row.company_id, companyName: row.company_name, boardId, itemId, month: attributionMonth,
      ...delivery,
    })
    if (row.board_id) {
      open(row.board_id)
      return
    }
    if (row.is_excluded) return
    void ensureTaskBoard(scope, row.company_id, { attribution_month: attributionMonth, report_month: reportMonth })
      .then(({ board }) => {
        if (panelOpenRequest.current !== request || visibleNotePeriod.current !== notePeriod) return
        refreshAfterCompletion()
        open(board.id)
      })
      .catch(error => toast.error(getTaskBoardErrorMessage(error)))
  }

  const toggleListCompletion = async (row: TaskBoardListItem, column: Pick<MajorColumn, "id" | "name">, directDelivery = false) => {
    const key = getMajorCheckKey(row.company_id, column.id)
    const item = monthlyItems[`${row.company_id}:${normalizeText(column.name)}`]
    if (!item || item.target_active === false || item.status === "na" || !row.board_id || row.is_excluded || completingKeys.current.has(key) || checklistBlocked) return
    if (directDelivery && (item.status === 'done' || !item.source_item_id || !item.can_deliver || !(item.payment_slip_file_count ?? item.source_file_count))) return
    if (!directDelivery && item.status !== 'done' && (item.source_item_id || item.execution_mode_snapshot === 'file_and_notify')) {
      openTaskPanel(row, item.id)
      return
    }
    const status = item.status === 'done'
      ? (item.template_kind_snapshot === 'base' ? 'not_started' : 'in_progress')
      : 'done'
    const itemKey = `${row.company_id}:${normalizeText(column.name)}`
    completingKeys.current.add(key)
    setPendingCompletion(previous => ({ ...previous, [item.id]: status === 'done' }))
    const previousSave = workflowCompletionSave.pending
    const save = Promise.resolve(previousSave).then(async () => {
      try {
        const saved = await saveTaskStatus(row.company_id, row.board_id!, item.id, status, item)
        completionRevision.current += 1
        if (scope === 'admin' && saved.status === 'done' && item.template_kind_snapshot === 'base'
          && ['일용', '일용직', '일용근로', '일용근로소득'].includes(normalizeText(column.name))) {
          setExpandedGroups(previous => ({ ...previous, statements: true }))
        }
        setMonthlyItems(previous => previous[itemKey]?.id === item.id
          ? { ...previous, [itemKey]: { ...previous[itemKey], status: saved.status, completed_at: saved.completed_at, notified_at: saved.notified_at } }
          : previous)
        return true
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
        if (item.execution_mode_snapshot === 'file_only') openTaskPanel(row, item.id)
        return false
      } finally {
        completingKeys.current.delete(key)
        setPendingCompletion(previous => {
          const next = { ...previous }
          delete next[item.id]
          return next
        })
        if (workflowCompletionSave.pending === save) workflowCompletionSave.pending = null
        refreshAfterCompletion()
      }
    })
    workflowCompletionSave.pending = save
  }

  const isListItemDone = (item?: TaskBoardItem) =>
    item ? pendingCompletion[item.id] ?? (item.status === 'done') : false

  const showEditModeNotice = (message: string, duration = 1400) => {
    setEditModeNotice(message)
    if (editNoticeTimerRef.current) {
      window.clearTimeout(editNoticeTimerRef.current)
      editNoticeTimerRef.current = null
    }
    editNoticeTimerRef.current = window.setTimeout(() => {
      setEditModeNotice('')
      editNoticeTimerRef.current = null
    }, duration)
  }

  useEffect(() => {
    return () => {
      if (editNoticeTimerRef.current) {
        window.clearTimeout(editNoticeTimerRef.current)
        editNoticeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditMode) {
      setEditingReportCycleCompanyId(null)
    }
  }, [isEditMode])

  const handleChangeReportCycle = async (
    row: TaskBoardListItem,
    nextReportCycle: 'monthly' | 'semiannual'
  ) => {
    if (!isEditMode || checklistBlocked) return
    if (row.is_excluded) return
    if (updatingReportCycleCompanyId != null) return
    if ((row.report_cycle || null) === nextReportCycle) {
      setEditingReportCycleCompanyId(null)
      return
    }
    try {
      setUpdatingReportCycleCompanyId(row.company_id)
      const res = await patchTaskBoardReportCycle(scope, row.company_id, {
        attribution_month: attributionMonth,
        report_cycle: nextReportCycle,
      })
      setListRowsApi((prev) =>
        prev.map((item) =>
          item.company_id === row.company_id
            ? {
                ...item,
                report_cycle: res.report_cycle,
              }
            : item
        )
      )
      if (res.split_applied) {
        showEditModeNotice(`${attributionMonth}부터 신고주기가 적용되었습니다.`)
      }
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setEditingReportCycleCompanyId(null)
      setUpdatingReportCycleCompanyId(null)
    }
  }

  const baseColumnHeadings = (
    <>
      {visibleBaseColumns.length === 0 ? (
        <th
          scope="col"
          className="px-1 py-1.5 text-center font-semibold"
        >
          <span className="block leading-tight">
            {groupedHeaders ? '–' : '기본업무'}
          </span>
        </th>
      ) : null}
      {visibleBaseColumns.map((column) => {
        const income = scope === 'admin' ? getMonthlyIncomeColumn(column.name) : undefined
        const name = income?.name ?? column.name
        return (
        <th
          scope="col"
          key={column.id}
          className={`${styles.baseTaskColumn} py-2 text-center font-semibold`}
        >
          <div className={styles.taskHeading} title={name}>
            {isEditMode && column.id !== income?.id ? (
              <button
                type="button"
                onClick={() => toggleColumnAll(column.id)}
                className={`w-full rounded border px-0 py-0.5 text-[11px] font-medium transition ${
                  columnAllCheckedMap[column.id]
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:border-sky-300 hover:text-sky-700'
                }`}
                title="컬럼 전체 선택/해제"
              >
                <span className="block leading-tight">
                  {name}
                </span>
              </button>
            ) : (
              <span className="block px-0 py-0.5 text-[11px] leading-tight">
                {name}
              </span>
            )}
          </div>
        </th>
        )
      })}
    </>
  )

  const renderProcessColumnHeadings = (group: (typeof processGroups)[number]) => (
    <Fragment key={group.key}>
      {group.columns.length ? group.columns.map(column => (
        <th key={column.id} scope="col" className="px-1 py-1.5 text-center font-semibold">
          <span className={group.key === 'statements' ? styles.statementHeading : styles.taskHeading} title={column.heading ?? column.name}>
            {column.heading ?? column.name}
          </span>
        </th>
      )) : (
        <th scope="col" className="px-1 py-1.5 text-center font-semibold">{group.fallbackTitle}</th>
      )}
    </Fragment>
  )

  return (
    <div ref={boardViewportRef} className={styles.viewport} style={{ height: boardViewportHeight }}>
        <section className={styles.listSection}>
          <header className="space-y-2 border-b border-zinc-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1">
                <UiButton size="iconSm" variant="secondary" disabled={isEditMode || !listLoaded || Boolean(earliestRegistrationMonth && attributionMonth <= earliestRegistrationMonth)} onClick={() => changeBoardMonth(monthShift(attributionMonth, -1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </UiButton>
                {scope === 'admin' ? <Popover>
                  <PopoverButton disabled={isEditMode || !listLoaded} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60">
                    귀속월 {attributionMonth}<ChevronDown aria-hidden="true" className="h-3 w-3" />
                  </PopoverButton>
                  <PopoverPanel anchor="bottom" className="z-50 max-h-60 w-36 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-1 shadow-lg [--anchor-gap:4px]">
                    {({ close }) => <>{Array.from({ length: 241 }, (_, index) => monthShift(attributionMonth, 120 - index))
                      .filter(month => month <= latestAttributionMonth && (!earliestRegistrationMonth || month >= earliestRegistrationMonth)).map(month => (
                      <button key={month} type="button" aria-current={month === attributionMonth ? 'date' : undefined}
                        ref={element => { if (element && month === attributionMonth) element.parentElement?.scrollTo({ top: element.offsetTop - element.parentElement.clientHeight / 2 + element.clientHeight / 2 }) }}
                        onClick={() => { changeBoardMonth(month); close() }}
                        className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-sky-50 ${month === attributionMonth ? 'bg-sky-100 font-semibold text-sky-800' : 'text-zinc-700'}`}>
                        {month}
                      </button>
                    ))}</>}
                  </PopoverPanel>
                </Popover> : <span className="text-xs font-semibold text-zinc-700">귀속월 {attributionMonth}</span>}
                <UiButton size="iconSm" variant="secondary" disabled={isEditMode || attributionMonth >= latestAttributionMonth} onClick={() => changeBoardMonth(monthShift(attributionMonth, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </UiButton>
                <span className="ml-2 text-xs text-zinc-500">신고월 {reportMonth}</span>
              </div>


              {(
                <label className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input disabled={isEditMode} type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
                  미완료만
                </label>
              )}
              {(
                <label className="inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input disabled={isEditMode} type="checkbox" checked={includeExcluded} onChange={(event) => setIncludeExcluded(event.target.checked)} />
                  제외 포함
                </label>
              )}
              {(
                <select
                  disabled={isEditMode}
                  value={assigneeFilterId}
                  onChange={(event) => setAssigneeFilterId(event.target.value)}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                >
                  <option value="all">담당자 전체</option>
                  {assignees.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}

              {(
                <div className="inline-flex items-center rounded-md border border-zinc-300 bg-white p-0.5">
                  {(['all', 'corporate', 'individual'] as const).map((kind) => {
                    const active = kindFilter === kind
                    const label = kind === 'all' ? '전체' : kind === 'corporate' ? '법인' : '개인'
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={isEditMode} onClick={() => setKindFilter(kind)}
                        className={`rounded px-2 py-1 text-xs transition ${
                          active ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {isEditMode ? (
                <UiButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const selectedNameSet = new Set(customColumns.map((column) => normalizeText(column.name)))
                    setPendingColumnSelection(
                      columnCatalog.filter((item) => selectedNameSet.has(normalizeText(item.name))).map((item) => item.id)
                    )
                    setIsCreateColumnModalOpen(false)
                    setNewColumnName('')
                    setIsColumnModalOpen(true)
                  }}
                >
                  기준업무 추가
                </UiButton>
              ) : null}

              {isEditMode ? (
                <UiButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPendingMajorSelection(selectedMajorTemplateIds)
                    setIsMajorColumnModalOpen(true)
                  }}
                >
                  업무진행추가
                </UiButton>
              ) : null}

              <UiButton
                size="sm"
                variant={isEditMode ? 'primary' : 'tabInactive'}
                onClick={async () => {
                  if (!isEditMode) {
                    setIsEditMode(true)
                    showEditModeNotice('편집 중')
                    return
                  }
                  const saved = await saveChecklistSelections()
                  if (!saved) return
                  setIsEditMode(false)
                  showEditModeNotice('저장 완료')
                }}
                disabled={checklistBlocked}
              >
                {isEditMode ? (isSavingChecklist ? '저장 중...' : '편집 완료') : '편집'}
              </UiButton>

              {checkError ? <span role="alert" className="text-xs text-red-600">{checkError}</span> : null}
              {isSavingChecklist ? <span className="text-xs font-medium text-sky-700">저장 중...</span> : null}
              {!isSavingChecklist && editModeNotice ? <span className="text-xs font-medium text-zinc-600">{editModeNotice}</span> : null}

              <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <UiSearchInput
                    value={keyword}
                    onChange={value => { if (!isEditMode) setKeyword(value) }}
                    placeholder="업체명 검색"
                    wrapperClassName="h-8"
                    inputClassName="text-xs"
                  />
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-zinc-600">
                  목록 보기
                  <select aria-label="목록 표시 개수" value={pageSize}
                    disabled={isEditMode || !preferenceReady || preferenceSaving}
                    onChange={event => void changePageSize(event.target.value as TaskBoardPageSize)}
                    className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs disabled:opacity-50">
                    <option value="10">10개</option><option value="20">20개</option>
                    <option value="40">40개</option><option value="all">전체</option>
                  </select>
                  {preferenceSaving && <span role="status">저장 중</span>}
                </label>
              </div>
            </div>
          </header>

          {!listLoading && listLoaded && !targetingReady && (
            <p role="alert" className="text-xs text-amber-700">대상 설정 기능은 SQL 적용 및 서버 업데이트 후 사용할 수 있습니다. 현재는 조회만 가능합니다.</p>
          )}
          <div className={styles.tableFrame}>
          <div className={styles.tableScroller} tabIndex={0} role="region" aria-label="원천세 업무 목록" aria-busy={listLoading}>
            <table className={styles.table}>
              <thead className={groupedHeaders ? styles.groupedHeader : 'bg-zinc-100 text-zinc-700'}>
                <tr>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    No
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    구분
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    <button
                      type="button"
                      onClick={() => handleToggleSort('company_name')}
                      className="inline-flex w-full items-center justify-center gap-0.5"
                      title="상호 정렬"
                    >
                      <span>상호</span>
                      {renderSortIcon('company_name')}
                    </button>
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-2 py-1.5 text-center font-semibold">
                    담당자
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    <button
                      type="button"
                      onClick={() => handleToggleSort('report_cycle')}
                      className="inline-flex w-full items-center justify-center gap-0.5"
                      title="주기 정렬"
                    >
                      <span>주기</span>
                      {renderSortIcon('report_cycle')}
                    </button>
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    귀속
                  </th>
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">
                    급여
                  </th>
                  {groupedHeaders ? (
                    <>
                      <th colSpan={baseColumnCount} className={styles.groupHeading}>소득확인</th>
                      {processGroups.map(group => (
                        <th key={group.key}
                          colSpan={group.expanded ? Math.max(1, group.columns.length) : 1}
                          rowSpan={group.expanded ? 1 : 2}
                          className={group.expanded ? styles.groupHeading : `${styles.groupHeading} ${styles.collapsedHeading}`}
                        >
                          <button type="button"
                            aria-label={`${group.label} ${group.expanded ? '접기' : '펼치기'}`}
                            aria-expanded={group.expanded}
                            title={group.expanded ? undefined : `${group.label} 펼치기`}
                            onClick={() => setExpandedGroups(previous => ({ ...previous, [group.key]: !previous[group.key] }))}
                            className={styles.groupToggle}
                          >
                            {group.expanded ? group.label : group.shortLabel}
                            {group.expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={10} aria-hidden="true" />}
                          </button>
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      {baseColumnHeadings}
                      {showProgressColumns && (
                        <>
                          <th className="px-1 py-1.5 text-center font-semibold">
                            <button
                              type="button"
                              onClick={() => handleToggleSort('progress_percent')}
                              className="inline-flex w-full items-center justify-center gap-0.5"
                              title="진행률 정렬"
                            >
                              <span>진행률</span>
                              {renderSortIcon('progress_percent')}
                            </button>
                          </th>
                          <th className="px-1 py-1.5 text-center font-semibold">
                            <button
                              type="button"
                              onClick={() => handleToggleSort('todo_count')}
                              className="inline-flex w-full items-center justify-center gap-0.5"
                              title="미완료수 정렬"
                            >
                              <span>미완료수</span>
                              {renderSortIcon('todo_count')}
                            </button>
                          </th>
                        </>
                      )}
                      {renderProcessColumnHeadings(processGroups[0])}
                    </>
                  )}
                  <th scope="col" rowSpan={headerRowSpan} className="px-1 py-1.5 text-center font-semibold">비고</th>
                  {isEditMode && (
                    <th scope="col" rowSpan={headerRowSpan} className="py-1.5 text-center font-semibold">
                      {scope === 'admin' ? (
                        <UiButton size="xs" variant="secondary" disabled={checklistBlocked}
                          onClick={() => void handleImportMonthDefaults()}>
                          {importingDefaultsFor === 'all' ? '확인 중…' : '기준업무 일괄 불러오기'}
                        </UiButton>
                      ) : '액션'}
                    </th>
                  )}
                </tr>
                {groupedHeaders && (
                  <tr>
                    {baseColumnHeadings}
                    {processGroups.filter(group => group.expanded).map(renderProcessColumnHeadings)}
                  </tr>
                )}
              </thead>
              <tbody>
                {listRows.map((row, idx) => {
                  const displayKind = mapCompanyKindToLabel(row.company_kind)
                  const progress = Number(row.progress_percent || 0)
                  return (
                    <tr key={row.company_id} className={`border-t border-zinc-200 ${row.is_excluded ? 'bg-rose-50' : idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}`}>
                      <td className="px-1 py-1.5 text-center text-zinc-600">
                        {idx + 1}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {displayKind}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditMode) return
                            openTaskPanel(row)
                          }}
                          className={`mx-auto block whitespace-nowrap text-center ${
                            isEditMode ? 'cursor-default text-zinc-800' : 'text-zinc-800 hover:text-sky-700 hover:underline'
                          }`}
                          title={row.company_name}
                        >
                          {row.company_name}
                        </button>
                        {row.default_version_id && (
                          <span className="block text-[10px] text-zinc-400">기본 설정 v{row.default_version_id} · 월별 수정 가능</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center text-zinc-600">
                        <span className="block whitespace-nowrap" title={row.assignee_name || '담당자 미지정'}>
                          {row.assignee_name || <span className="text-zinc-400">미지정</span>}
                        </span>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {isEditMode ? (
                          <div className="relative inline-flex">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingReportCycleCompanyId((prev) => (prev === row.company_id ? null : row.company_id))
                              }
                              disabled={row.is_excluded || updatingReportCycleCompanyId === row.company_id}
                              className={`inline-flex items-center gap-0.5 rounded-full border px-1 py-0.5 text-[10px] font-semibold ${
                                row.is_excluded ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400' : getReportCycleClass(row.report_cycle)
                              }`}
                              title={row.is_excluded ? '제외 업체는 수정할 수 없습니다.' : '신고주기 변경'}
                            >
                              {mapReportCycleLabel(row.report_cycle)}
                              {!row.is_excluded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : null}
                            </button>
                            {editingReportCycleCompanyId === row.company_id && !row.is_excluded ? (
                              <div className="absolute right-0 top-full z-20 mt-1 w-20 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-2 py-1.5 text-left text-[11px] text-zinc-700 transition hover:bg-zinc-50"
                                  onClick={() => void handleChangeReportCycle(row, 'monthly')}
                                >
                                  매월
                                </button>
                                <button
                                  type="button"
                                  className="block w-full border-t border-zinc-100 px-2 py-1.5 text-left text-[11px] text-zinc-700 transition hover:bg-zinc-50"
                                  onClick={() => void handleChangeReportCycle(row, 'semiannual')}
                                >
                                  반기
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span
                          className={`inline-flex rounded-full border px-1 py-0.5 text-[10px] font-semibold ${getReportCycleClass(
                              row.report_cycle
                            )}`}
                          >
                            {mapReportCycleLabel(row.report_cycle)}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-1 py-1.5 text-center text-zinc-700"
                      >
                        {mapPayrollBasisLabel(row.payroll_basis)}
                      </td>
                      <td
                        className="px-1 py-1.5 text-center text-zinc-700"
                      >
                        {row.payroll_day ?? '-'}
                      </td>
                      {visibleBaseColumns.length === 0 ? (
                        <td
                          className="px-1 py-1.5 text-center text-zinc-500"
                        >
                          -
                        </td>
                      ) : null}
                      {visibleBaseColumns.map((column) => {
                        const checked = companyColumnChecks[getColumnCheckKey(row.company_id, column.id)] || false
                        const item = monthlyItems[`${row.company_id}:${normalizeText(column.name)}`]
                        const saving = item != null && pendingCompletion[item.id] !== undefined
                        const done = isListItemDone(item)
                        const income = scope === 'admin' ? getMonthlyIncomeColumn(column.name) : undefined
                        const pendingIncome = income ? statementIncomePending[`${attributionMonth}:${row.company_id}:${income.kind}`] : undefined
                        const savedIncome = income?.kind === 'daily' ? row.daily_work_presence
                          : income ? row[`${income.kind}_income_presence`] : null
                        const incomeConfirmed = (pendingIncome ?? savedIncome) === 'yes'
                        const previousConfirmed = Boolean(income && row.previous_income_checks?.includes(income.kind))
                        const incomeCellColor = !income || isEditMode || row.is_excluded ? ''
                          : incomeConfirmed ? 'bg-emerald-50' : previousConfirmed ? 'bg-amber-50' : ''
                        return (
                          <td
                            key={`${row.company_id}:${column.id}`}
                            className={`${styles.baseTaskColumn} py-2 text-center ${incomeCellColor}`}
                          >
                            {row.is_excluded ? (
                              <span aria-label="해당 없음" title="해당 없음" className="text-zinc-400">–</span>
                            ) : income && !isEditMode ? (
                              <button
                                type="button"
                                aria-label={`${row.company_name} 이번 달 ${income.name} 확인`}
                                aria-pressed={incomeConfirmed}
                                aria-busy={pendingIncome !== undefined}
                                disabled={checklistBlocked || pendingIncome !== undefined}
                                title={incomeConfirmed ? '확인 취소' : previousConfirmed ? '전월에 확인됨 · 이번 달 확인' : '이번 달 확인'}
                                className={`inline-flex h-7 min-w-7 items-center justify-center rounded text-sm font-semibold enabled:hover:bg-black/5 focus-visible:outline focus-visible:outline-sky-600 disabled:opacity-60 ${incomeConfirmed ? 'text-emerald-700' : 'text-zinc-500'}`}
                                onClick={() => void saveStatementIncome(row, income.kind, incomeConfirmed ? 'no' : 'yes')}
                              >
                                {incomeConfirmed ? 'O' : '–'}
                              </button>
                            ) : column.id === income?.id ? (
                              <span className="text-zinc-400">–</span>
                            ) : isEditMode ? (
                              <button
                                type="button"
                                disabled={checklistBlocked}
                                onClick={() => toggleCompanyColumnValue(row.company_id, column.id)}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                  checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 bg-white text-zinc-500'
                                }`}
                                title={checked ? '체크됨' : '체크안됨'}
                              >
                                {checked ? '✓' : ''}
                              </button>
                            ) : (
                              checked ? (
                                <button
                                  type="button"
                                  aria-label={`${row.company_name} ${column.name} 완료`}
                                  aria-pressed={done}
                                  aria-busy={saving}
                                  title={done ? '완료 취소' : '완료 처리'}
                                  disabled={checklistBlocked || saving}
                                  onClick={() => void toggleListCompletion(row, column)}
                                  className={`inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded-md border px-0.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-60 ${done
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 enabled:hover:bg-emerald-100'
                                    : 'border-rose-200 bg-rose-50 text-rose-800 enabled:hover:bg-rose-100'}`}
                                >
                                  {done ? '완료' : '미완료'}
                                </button>
                              ) : (
                                <span aria-label="해당 없음" title="해당 없음" className="text-zinc-400">–</span>
                              )
                            )}
                          </td>
                        )
                      })}
                      {
                        <>
                          {showProgressColumns && (
                            <>
                              <td className="px-1 py-1.5 text-center text-zinc-700">
                                {row.is_excluded ? (
                                  '-'
                                ) : (
                                  <div className="mx-auto w-20">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                                      <div
                                        className={`h-full rounded-full transition-all ${getProgressBarClass(progress)}`}
                                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                                      />
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-700">{progress}%</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-1 py-1.5 text-center text-zinc-700">{row.is_excluded ? '-' : row.todo_count}</td>
                            </>
                          )}
                          {processGroups.map(group => {
                            const canShowCompletion = groupedHeaders && !isEditMode && !row.is_excluded
                            const applicableColumns = canShowCompletion && group.key === 'withholding'
                              ? group.columns.filter(column => isProcessTarget(row, column)) : []
                            const applicableStatements = canShowCompletion && group.key === 'statements' && statementColumnKeys !== null
                              ? row.statement_tasks?.filter(task => task.work_status !== 'na' && visibleStatementKeys.has(task.key)) ?? []
                              : []
                            const groupDone = group.key === 'withholding'
                              ? applicableColumns.length > 0 && applicableColumns.every(column => {
                                const name = normalizeText(column.name)
                                const task = monthlyItems[`${row.company_id}:${name}`]
                                if (task?.execution_mode_snapshot === 'file_only' && !task.source_item_id &&
                                    ['급여대장작성', '급여대장작성완료'].includes(name)) {
                                  return (monthDocuments[task.id]?.length ?? 0) > 0
                                }
                                return isListItemDone(task)
                              })
                              : applicableStatements.length > 0 && applicableStatements.every(task => task.status === 'submitted')
                            const groupCompletionClass = groupDone ? styles.completedGroupCell : ''
                            return (
                            <Fragment key={group.key}>
                              {!group.expanded && <td className={`${styles.collapsedCell} ${groupCompletionClass}`} aria-hidden="true" />}
                              {!group.columns.length && group.expanded && (
                                <td className="px-1 py-1.5 text-center text-zinc-400">–</td>
                              )}
                              {group.columns.map(column => {
                              const statement = row.statement_tasks?.find(task => task.key === column.statementKey)
                              if (column.statementKey && statementColumnKeys !== null &&
                                  (!isEditMode || !statement?.item_id || statement.source_attribution_month || statement.item_name !== column.name)) {
                                const pendingLabel = statement?.status === 'due' ? '미제출'
                                  : statement?.key === '사업소득지급명세서' ? '연간 제출 여부 확인' : '대상 확인'
                                const label = statement?.status === 'submitted' ? '제출 완료' : pendingLabel
                                const statusClass = statement?.status === 'submitted' ? 'text-emerald-700'
                                  : statement?.status === 'due' ? 'text-rose-700' : 'text-amber-800'
                                return (
                                  <td key={column.id} hidden={!group.expanded} className={`py-1.5 text-center ${groupCompletionClass}`}>
                                    {statement ? (
                                      <div className="flex flex-col items-center gap-0.5 text-[11px]">
                                        {statement.editable && !isEditMode ? (
                                          <StatementTrackingControls
                                            key={`${attributionMonth}:${row.company_id}:${statement.key}`}
                                            statement={statement}
                                            pendingLabel={pendingLabel}
                                            label={`${row.company_name} ${column.heading ?? column.name}`}
                                            disabled={checklistBlocked}
                                            onSave={change => saveStatementTracking(row, statement, change)}
                                          />
                                        ) : <span className={statusClass}>{statement.work_status === 'na' ? '해당없음' : label}</span>}
                                        {statement.period && <span className="text-[10px] tabular-nums text-zinc-500">대상 {statement.period}</span>}
                                        {statement.payment_count > 0 && (
                                          <Link className="text-[10px] text-sky-700 underline"
                                            href={`/admin/company-withholding/business?company_id=${row.company_id}&pay_month=${statement.period}`}>
                                            지급내역 {statement.payment_count}건
                                          </Link>
                                        )}
                                      </div>
                                    ) : <span className="text-zinc-400">–</span>}
                                  </td>
                                )
                              }
                              const checked = isProcessTarget(row, column)
                              const task = monthlyItems[`${row.company_id}:${normalizeText(column.name)}`]
                              const taskName = normalizeText(column.name)
                              const isPayrollWriting = scope === 'admin' && ['급여대장작성', '급여대장작성완료'].includes(taskName) &&
                                task?.execution_mode_snapshot === 'file_only' && !task.source_item_id
                              const isPayrollDelivery = scope === 'admin' &&
                                ['급여대장송부및확인', '급여대장송부확인', '급여대장송부'].includes(taskName)
                              const isWithholdingFiling = scope === 'admin' && ['원천세신고', '원천세신고서작성', '원천세신고서제출'].includes(taskName)
                              const isWithholdingDelivery = scope === 'admin' && ['원천세납부서전달', '납부서전달', '원천세납부안내'].includes(taskName)
                              const isDelivery = isPayrollDelivery || isWithholdingDelivery
                              const sourceFileCount = task?.source_item_id ? task.source_file_count ?? 0 : 0
                              const paymentSlipCount = isWithholdingDelivery ? task?.payment_slip_file_count ?? 0 : 0
                              const deliveryFileLabel = paymentSlipCount ? `납부서 ${paymentSlipCount}건 상세`
                                : sourceFileCount ? `파일 ${sourceFileCount}건 상세`
                                  : isWithholdingDelivery && task?.own_file_count ? `기존 첨부 ${task.own_file_count}건 상세` : '파일 대기'
                              const saving = task != null && pendingCompletion[task.id] !== undefined
                              const done = isListItemDone(task)
                              const completionDate = saving && done ? new Date().toISOString() : task?.completed_at
                              const deliveryCompletedDate = isDelivery && done
                                ? formatKSTShortDate(saving ? completionDate : task?.notified_at ?? completionDate) : ''
                              const deliveryCellBackground = checked && isDelivery && !isEditMode && !row.is_excluded
                                ? done ? 'bg-emerald-50' : sourceFileCount > 0 ? 'bg-amber-50' : ''
                                : ''
                              const openWorkPanel = () => {
                                if (task && row.board_id) openTaskPanel(row, task.id, {
                                  payrollDelivery: isPayrollDelivery, withholdingDelivery: isWithholdingDelivery,
                                })
                              }

                          return (
                                <td
                                  key={`${row.company_id}:${column.id}`}
                                  hidden={!group.expanded}
                                  className={`px-1 py-2 text-center ${groupCompletionClass || deliveryCellBackground}`}
                                >
                                  {row.is_excluded ? (
                                    <span className="text-zinc-400">-</span>
                                  ) : (
                                    isEditMode ? (
                                      <select aria-label={`${row.company_name} ${column.name} 대상 설정`}
                                        disabled={checklistBlocked}
                                        className="w-[4.5rem] rounded border border-zinc-300 bg-white px-0.5 py-1 text-[11px]"
                                        value={targetModes[getMajorCheckKey(row.company_id, column.id)] ?? 'auto'}
                                        onChange={event => {
                                          dirtyCompanies.current.add(row.company_id)
                                          setTargetModes(prev => ({ ...prev, [getMajorCheckKey(row.company_id, column.id)]: event.target.value as TaskTargetMode }))
                                        }}>
                                        <option value="auto">자동</option>
                                        <option value="required">대상</option>
                                        <option value="excluded">대상 제외</option>
                                      </select>
                                    ) : checked && (isPayrollWriting || isWithholdingFiling) && task && row.board_id ? (
                                      <PayrollFilesCell key={task.id}
                                        companyId={row.company_id}
                                        companyName={row.company_name}
                                        boardId={row.board_id}
                                        itemId={task.id}
                                        documents={monthDocuments[task.id]}
                                        withholdingFiling={isWithholdingFiling}
                                        disabled={checklistBlocked}
                                        upload={uploadTaskFilesWithFallback}
                                        onChanged={refreshAfterCompletion}
                                      />
                                    ) : checked && isDelivery ? (
                                      <div className="mx-auto flex w-max flex-col items-center gap-0.5 whitespace-nowrap text-[11px]">
                                        <button type="button" onClick={openWorkPanel}
                                          disabled={checklistBlocked || !task || !row.board_id}
                                          aria-label={`${row.company_name} ${column.name} ${deliveryFileLabel}`}
                                          className="rounded px-0.5 py-0.5 font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50">
                                          {deliveryFileLabel}
                                        </button>
                                        {done ? (
                                          <span aria-busy={saving} className="px-0.5 py-0.5 text-[10px] tabular-nums text-emerald-700">
                                            {deliveryCompletedDate ? `완료 ${deliveryCompletedDate}` : '완료'}
                                          </span>
                                        ) : (
                                          <button type="button"
                                            disabled={checklistBlocked || !row.board_id || !(isWithholdingDelivery ? paymentSlipCount : sourceFileCount) || !task?.can_deliver}
                                            title={task?.can_deliver ? '클릭하여 완료 처리' : task?.blocked_reason || undefined}
                                            aria-label={`${row.company_name} ${column.name} 처리대기 · 완료 처리`}
                                            onClick={() => void toggleListCompletion(row, column, true)}
                                            className={`rounded px-0.5 py-0.5 text-[10px] font-medium ${sourceFileCount > 0
                                              ? 'text-rose-700 enabled:hover:bg-rose-50'
                                              : 'text-zinc-400'}`}>
                                            처리대기
                                          </button>
                                        )}
                                      </div>
                                    ) : checked ? (
                                      <button type="button" disabled={checklistBlocked || saving}
                                        aria-busy={saving}
                                        onClick={() => void toggleListCompletion(row, column)}
                                        aria-label={`${row.company_name} ${column.name} ${done ? '완료 취소' : '완료 처리'}`}
                                        title={done ? '완료 · 클릭하여 취소' : '미완료 · 클릭하여 처리'}
                                        className={`rounded px-0.5 py-1 text-[10px] disabled:opacity-50 ${done ? 'text-emerald-700' : 'text-rose-600'}`}>
                                        {done ? (completionDate ? formatKSTDate(completionDate) : '완료') : '미완료'}
                                      </button>
                                    ) : <span className="text-xs text-zinc-400" title="해당없음">해당없음</span>

                                  )}
                                </td>
                              )
                              })}
                            </Fragment>
                            )
                          })}
                          <td className="px-1 py-1.5 text-center align-middle text-zinc-600">
                            {editingNote?.companyId === row.company_id && editingNote.period === notePeriod ? (
                              <form className="mx-auto w-48 space-y-1" onSubmit={event => {
                                event.preventDefault()
                                saveBoardNote(row)
                              }}>
                                <textarea
                                  autoFocus
                                  aria-label={`${row.company_name} 비고`}
                                  className="block w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 focus:border-sky-500 focus:outline-none"
                                  rows={3}
                                  maxLength={1000}
                                  disabled={isSavingNote}
                                  value={editingNote.text}
                                  onChange={event => setEditingNote({ ...editingNote, text: event.currentTarget.value })}
                                  onKeyDown={event => {
                                    if (event.key === 'Escape' && !event.nativeEvent.isComposing && !isSavingNote) {
                                      event.preventDefault()
                                      setEditingNote(null)
                                    }
                                  }}
                                />
                                <div className="flex justify-end gap-1">
                                  <UiButton size="xs" variant="secondary" disabled={isSavingNote}
                                    onClick={() => setEditingNote(null)}>취소</UiButton>
                                  <UiButton type="submit" size="xs" variant="primary" disabled={isSavingNote}>
                                    {isSavingNote ? <span role="status" aria-label="저장 중" className={styles.spinner} /> : '저장'}
                                  </UiButton>
                                </div>
                              </form>
                            ) : (
                              <button
                                type="button"
                                aria-label={`${row.company_name} 비고 ${row.note ? '수정' : '입력'}`}
                                title={row.note || '비고 입력'}
                                disabled={isSavingNote || listPeriod !== attributionMonth}
                                onClick={() => setEditingNote({ companyId: row.company_id, text: row.note || '', period: notePeriod })}
                                className="block min-h-6 mx-auto w-full max-w-sm rounded px-1 text-center whitespace-pre-wrap [overflow-wrap:anywhere] hover:bg-sky-50 disabled:opacity-60"
                              >
                                {row.note || <span className="text-[11px] text-zinc-500">비고 입력</span>}
                              </button>
                            )}
                          </td>
                        </>
                      }
                      {isEditMode && (
                        <td className="py-1.5">
                          <div className={`${styles.rowActions} flex items-center justify-center gap-0.5`}>
                            {scope === 'admin' && !row.is_excluded && (
                              <UiButton size="xs" variant="secondary" disabled={checklistBlocked}
                                aria-label={`${row.company_name} 기준업무 불러오기`} onClick={() => void handleImportMonthDefaults(row)}>
                                {importingDefaultsFor === row.company_id ? '확인 중…' : '기준업무 불러오기'}
                              </UiButton>
                            )}
                            <UiButton size="xs" variant={row.is_excluded ? 'soft' : 'tabInactive'} onClick={() => handleToggleExclude(row)}>
                              {row.is_excluded ? '해제' : '제외'}
                            </UiButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {!listLoading && listLoaded && listRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableColumnCount}
                      className="px-2 py-16 text-center text-zinc-400"
                    >
                      조건에 맞는 업체가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {listLoading && (
            <div className={styles.tableLoading} role="status">
              <RefreshCw className={styles.tableLoadingIcon} aria-hidden="true" />
              <span className="sr-only">월별 업무표를 불러오는 중입니다.</span>
            </div>
          )}
          </div>
          <div className="shrink-0 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
            <div className="order-2 min-w-0 text-xs leading-5 text-zinc-500 xl:order-1">
              <p>일반 모드에서는 완료 처리, 편집에서는 소득 항목과 업무 대상을 설정합니다.</p>
              <p>자동 대상은 소득 항목·신고주기를 따릅니다. 대상 변경은 해당 월에만 적용되며 자료와 처리 이력은 유지됩니다.</p>
            </div>
            {pageSize !== 'all' && !listLoading && listTotal > 0 ? (
              <div className="order-1 justify-self-center xl:order-2">
                <Pagination
                  page={listPage}
                  total={listTotal}
                  limit={Number(pageSize)}
                  onPageChange={page => { if (!isEditMode) setListPage(page) }}
                  className="mt-0"
                />
              </div>
            ) : null}
          </div>
        </section>

      {isColumnModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">업무 컬럼 추가</p>
              <UiButton size="xs" variant="tabInactive" onClick={() => setIsColumnModalOpen(false)}>
                닫기
              </UiButton>
            </div>
            <div className="space-y-2">
              {columnCatalog.map((item, index) => {
                const checked = pendingColumnSelection.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      checked ? 'border-emerald-200 bg-emerald-50 text-zinc-800' : 'border-zinc-300 bg-white text-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setPendingColumnSelection((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        )
                      }
                      className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                        checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 bg-white text-zinc-500'
                      }`}
                      title={checked ? '선택됨' : '선택'}
                    >
                      {checked ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingColumnSelection((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        )
                      }
                      className="min-w-0 flex-1 truncate text-left"
                      title={item.name}
                    >
                      {item.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <UiButton
                        size="xs"
                        variant="tabInactive"
                        onClick={() => void moveCatalogColumn(item.templateId, 'up')}
                        disabled={isUpdatingCatalog || index === 0}
                        title="위로"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </UiButton>
                      <UiButton
                        size="xs"
                        variant="tabInactive"
                        onClick={() => void moveCatalogColumn(item.templateId, 'down')}
                        disabled={isUpdatingCatalog || index === columnCatalog.length - 1}
                        title="아래로"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </UiButton>
                      <UiButton
                        size="xs"
                        variant="danger"
                        onClick={() => removeCatalogColumn(item.templateId)}
                        disabled={isUpdatingCatalog}
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </UiButton>
                    </div>
                  </div>
                )
              })}
              {!columnCatalog.length ? (
                <div className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500">
                  등록된 업무 템플릿이 없습니다. 직접 추가로 먼저 등록해 주세요.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setIsCreateColumnModalOpen(true)}
                className="flex w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white py-2 text-zinc-600 hover:border-sky-300 hover:text-sky-700"
                title="직접 컬럼 추가"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-sm">+</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">업무 타이틀을 체크 후 반영하면 컬럼이 추가됩니다.</p>
            <p className="mt-1 text-xs text-amber-700">템플릿은 클라이언트 공통입니다. 수정/삭제는 다른 회사에도 영향을 줄 수 있습니다.</p>
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsColumnModalOpen(false)}>
                취소
              </UiButton>
              <UiButton size="sm" variant="primary" onClick={applySelectedColumns}>
                반영
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateColumnModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <p className="mb-2 text-sm font-semibold text-zinc-800">컬럼 직접 추가</p>
            <input
              autoFocus
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                if (event.nativeEvent.isComposing) return
                event.preventDefault()
                createCatalogColumn()
              }}
              placeholder="업무명을 입력해 주세요."
              className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm text-zinc-700"
            />
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsCreateColumnModalOpen(false)}>
                취소
              </UiButton>
              <UiButton size="sm" variant="primary" onClick={createCatalogColumn} disabled={isCreatingColumn}>
                {isCreatingColumn ? '저장 중...' : '저장'}
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}

      {quickWork && (
        <TaskWorkPanel key={`${scope}:${quickWork.companyId}:${quickWork.boardId}:${quickWork.itemId ?? 'company'}`} scope={scope} {...quickWork}
          close={() => {
            panelOpenRequest.current += 1
            setQuickWork(null)
          }}
          upload={uploadTaskFilesWithFallback}
          saveStatus={(companyId, boardId, item, status) => saveTaskStatus(companyId, boardId, item.id, status, item)}
          onChanged={refreshAfterCompletion}
        />
      )}

      {isMajorColumnModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">업무진행 추가</p>
              <UiButton size="xs" variant="tabInactive" onClick={() => setIsMajorColumnModalOpen(false)}>
                닫기
              </UiButton>
            </div>
            <div className="mb-3 max-h-48 space-y-2 overflow-y-auto pr-1">
              {processTemplateCatalog.length ? (
                processTemplateCatalog.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-md border px-2 py-1.5 ${
                      pendingMajorSelection.includes(item.id) ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingMajorSelection((prev) =>
                            prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          )
                        }
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                          pendingMajorSelection.includes(item.id)
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-300 bg-white text-zinc-500'
                        }`}
                        title={pendingMajorSelection.includes(item.id) ? '선택됨' : '선택안됨'}
                      >
                        {pendingMajorSelection.includes(item.id) ? '✓' : ''}
                      </button>
                      <p className="min-w-0 truncate text-sm text-zinc-700" title={item.name}>
                        {item.name}
                      </p>
                      {item.sourceTaskName ? (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500" title={item.sourceTaskName}>
                          <Link2 className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                          {item.sourceTaskName}
                        </p>
                      ) : null}
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <span className="inline-flex rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600">
                        {getExecutionModeLabel(item.executionMode)}
                      </span>
                      <UiButton
                        size="xs"
                        variant="tabInactive"
                        onClick={() => void moveProcessTemplate(item.templateId, 'up')}
                        disabled={isUpdatingMajorCatalog || index === 0}
                        title="위로 이동"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </UiButton>
                      <UiButton
                        size="xs"
                        variant="tabInactive"
                        onClick={() => void moveProcessTemplate(item.templateId, 'down')}
                        disabled={isUpdatingMajorCatalog || index === processTemplateCatalog.length - 1}
                        title="아래로 이동"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </UiButton>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500">
                  등록된 진행업무 템플릿이 없습니다.
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={newMajorColumnName}
                onChange={(event) => setNewMajorColumnName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.nativeEvent.isComposing) return
                  event.preventDefault()
                  addMajorColumn()
                }}
                placeholder="업무진행명을 입력해 주세요."
                className="h-9 rounded-md border border-zinc-300 px-2 text-sm text-zinc-700 sm:col-span-2"
              />
              <select
                value={newMajorExecutionMode}
                onChange={(event) => {
                  const nextMode = event.target.value as TaskExecutionMode
                  setNewMajorExecutionMode(nextMode)
                  if (nextMode !== 'check_only') setNewMajorSourceTemplateId('')
                }}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
              >
                <option value="check_only">체크만</option>
                <option value="file_only">파일 필수</option>
              </select>
            </div>
            {newMajorExecutionMode === 'check_only' ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="text-xs font-medium text-zinc-600">진행업무연동</label>
                <select
                  value={newMajorSourceTemplateId}
                  onChange={(event) => setNewMajorSourceTemplateId(event.target.value)}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700 sm:col-span-2"
                >
                  <option value="">연동 없음</option>
                  {processFileOnlyTemplateOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">완료 조건은 템플릿의 execution_mode로 저장됩니다.</p>
            <p className="mt-1 text-xs text-amber-700">템플릿은 클라이언트 공통입니다. 수정/삭제는 다른 회사에도 영향을 줄 수 있습니다.</p>
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsMajorColumnModalOpen(false)}>
                취소
              </UiButton>
              <UiButton
                size="sm"
                variant="primary"
                onClick={addMajorColumn}
                disabled={isCreatingMajorColumn || !newMajorColumnName.trim()}
              >
                {isCreatingMajorColumn ? '추가 중...' : '추가'}
              </UiButton>
              <UiButton
                size="sm"
                variant="secondary"
                onClick={applySelectedMajorColumns}
                disabled={isCreatingMajorColumn || isUpdatingMajorCatalog}
              >
                저장
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
