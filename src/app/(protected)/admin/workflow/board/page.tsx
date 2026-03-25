'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Plus, Trash2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import {
  bulkUpsertTaskBoardItems,
  createTaskTemplate,
  deleteTaskBoardItem,
  deleteTaskTemplate,
  createTaskBoardItem,
  ensureTaskBoard,
  getTaskBoardErrorMessage,
  listTaskBoardItems,
  listTaskBoards,
  listTaskItemDocs,
  listTaskTemplates,
  patchTaskBoardExclude,
  patchTaskBoardExcludeByMonth,
  updateTaskBoardItem,
  updateTaskTemplate,
  type TaskBoardItem,
  type TaskBoardKind,
  type TaskBoardListItem,
  type TaskBoardScope,
  type TaskItemStatus,
  type TaskTemplateItem,
  type TaskExecutionMode,
} from '@/services/workflowTaskBoard'

type CompanyKind = '법인' | '개인'
type AddTab = 'template' | 'custom'
type CustomColumn = { id: string; name: string }
type ColumnCatalogItem = { id: string; name: string; templateId: number; sortOrder: number }
type MajorColumn = { id: string; name: string }
type ProcessTemplateCatalogItem = { id: string; name: string; templateId: number; executionMode: TaskExecutionMode }
type AssigneeOption = { id: number; name: string }

type FileItem = {
  id: string
  fileName: string
  uploader: string
  uploadedAt: string
}

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
  return '개인'
}

function mapReportCycleLabel(value?: 'monthly' | 'semiannual' | null) {
  if (value === 'monthly') return '매월'
  if (value === 'semiannual') return '반기'
  return '—'
}

function getReportCycleClass(value?: 'monthly' | 'semiannual' | null) {
  if (value === 'monthly') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (value === 'semiannual') return 'border-amber-300 bg-amber-50 text-amber-700'
  return 'border-zinc-200 bg-zinc-50 text-zinc-500'
}

function mapPayrollBasisLabel(value?: 'current_month' | 'previous_month' | null) {
  if (value === 'current_month') return '당월'
  if (value === 'previous_month') return '전월'
  return '—'
}

function monthShift(value: string, delta: number): string {
  const [yearRaw, monthRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function splitByTwoChars(value: string): string[] {
  const chars = Array.from(value.trim())
  if (chars.length <= 2) return [value.trim()]
  const chunks: string[] = []
  for (let i = 0; i < chars.length; i += 2) {
    chunks.push(chars.slice(i, i + 2).join(''))
  }
  return chunks
}

function getExecutionModeLabel(mode: TaskExecutionMode) {
  if (mode === 'file_only') return '파일 필수'
  if (mode === 'file_and_notify') return '파일+송부'
  return '체크만'
}

const TEMPLATE_COLUMN_PREFIX = 'template-col-'
const TASK_BOARD_LIST_PAGE_SIZE = 10

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

  const [attributionMonth, setAttributionMonth] = useState('2026-03')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [kindFilter, setKindFilter] = useState<TaskBoardKind>('all')
  const [assigneeFilterId, setAssigneeFilterId] = useState('all')
  const [keyword, setKeyword] = useState('')
  const deferredKeyword = useDeferredValue(keyword)

  const [listRowsApi, setListRowsApi] = useState<TaskBoardListItem[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [listLoaded, setListLoaded] = useState(false)
  const [listReloadKey, setListReloadKey] = useState(0)

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => seedCustomColumns())
  const [columnCatalog, setColumnCatalog] = useState<ColumnCatalogItem[]>(() => seedColumnCatalog())
  const [companyColumnChecks, setCompanyColumnChecks] = useState<Record<string, boolean>>({})
  const [manualMajorColumns, setManualMajorColumns] = useState<MajorColumn[]>([])
  const [processTemplateCatalog, setProcessTemplateCatalog] = useState<ProcessTemplateCatalogItem[]>([])
  const [companyMajorChecks, setCompanyMajorChecks] = useState<Record<string, boolean>>({})
  const [isEditMode, setIsEditMode] = useState(false)
  const [isMajorColumnModalOpen, setIsMajorColumnModalOpen] = useState(false)
  const [newMajorColumnName, setNewMajorColumnName] = useState('')
  const [newMajorExecutionMode, setNewMajorExecutionMode] = useState<TaskExecutionMode>('check_only')
  const [isCreatingMajorColumn, setIsCreatingMajorColumn] = useState(false)

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [pendingColumnSelection, setPendingColumnSelection] = useState<string[]>([])
  const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [isCreatingColumn, setIsCreatingColumn] = useState(false)
  const [isUpdatingCatalog, setIsUpdatingCatalog] = useState(false)
  const [isSavingChecklist, setIsSavingChecklist] = useState(false)
  const [editModeNotice, setEditModeNotice] = useState('')
  const editNoticeTimerRef = useRef<number | null>(null)

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [detailItems, setDetailItems] = useState<TaskBoardItem[]>([])
  const [detailTemplates, setDetailTemplates] = useState<TaskTemplateItem[]>([])
  const [detailDocCountMap, setDetailDocCountMap] = useState<Record<number, number>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTab, setAddTab] = useState<AddTab>('template')
  const [templateTaskName, setTemplateTaskName] = useState('')
  const [customTaskName, setCustomTaskName] = useState('')

  const [fileModalTaskId, setFileModalTaskId] = useState<number | null>(null)
  const [fileModalDocs, setFileModalDocs] = useState<FileItem[]>([])

  const reportMonth = monthShift(attributionMonth, 1)
  const getColumnCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`
  const getMajorCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`

  const listRows = useMemo(() => {
    const copied = [...listRowsApi]
    copied.sort((a, b) => {
      if (a.is_excluded === b.is_excluded) return (a.company_name || '').localeCompare(b.company_name || '', 'ko')
      return a.is_excluded ? 1 : -1
    })
    return copied
  }, [listRowsApi])

  const selectedListRow = useMemo(
    () => listRows.find((item) => item.company_id === selectedCompanyId) ?? null,
    [listRows, selectedCompanyId]
  )

  const majorColumns = useMemo<MajorColumn[]>(() => {
    const byName = new Map<string, MajorColumn>()
    const customNameSet = new Set(customColumns.map((column) => normalizeText(column.name)))
    listRows.forEach((row) => {
      row.major_tasks.forEach((task) => {
        const name = task.trim()
        if (!name) return
        const normalized = normalizeText(name)
        if (customNameSet.has(normalized)) return
        const id = `major-${normalized}`
        if (!byName.has(normalized)) byName.set(normalized, { id, name })
      })
    })
    manualMajorColumns.forEach((column) => {
      const normalized = normalizeText(column.name)
      if (customNameSet.has(normalized)) return
      if (!byName.has(normalized)) byName.set(normalized, column)
    })
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [customColumns, listRows, manualMajorColumns])

  const templateSourceCompanyId = useMemo(() => {
    if (selectedCompanyId) return selectedCompanyId
    return listRows[0]?.company_id ?? null
  }, [listRows, selectedCompanyId])

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

  const workColumnWidthMap = useMemo(() => {
    const map: Record<string, number> = {}
    customColumns.forEach((column) => {
      map[column.id] = 36
    })
    return map
  }, [customColumns])

  const noColumnWidth = useMemo(() => {
    const digitLength = Math.max(String(Math.max(1, listRows.length)).length, 2)
    return Math.min(44, Math.max(34, digitLength * 8 + 12))
  }, [listRows.length])

  const kindColumnWidth = useMemo(() => {
    const longest = Math.max('구분'.length, ...listRows.map((row) => mapCompanyKindToLabel(row.company_kind).length))
    return Math.min(72, Math.max(44, longest * 10 + 14))
  }, [listRows])

  const nameColumnWidth = useMemo(() => {
    const longest = Math.max('상호'.length, ...listRows.map((row) => (row.company_name || '').trim().length))
    return Math.min(320, Math.max(140, longest * 11 + 26))
  }, [listRows])
  const baseCriteriaColumnWidth = 64

  const fileModalTask = useMemo(
    () => (fileModalTaskId ? detailItems.find((task) => task.id === fileModalTaskId) ?? null : null),
    [detailItems, fileModalTaskId]
  )
  const hasSelectedCustomColumns = customColumns.length > 0
  const hasSelectedMajorColumns = majorColumns.length > 0

  const columnAllCheckedMap = useMemo(() => {
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const map: Record<string, boolean> = {}
    customColumns.forEach((column) => {
      map[column.id] =
        activeRows.length > 0 && activeRows.every((row) => companyColumnChecks[getColumnCheckKey(row.company_id, column.id)])
    })
    return map
  }, [listRows, customColumns, companyColumnChecks])

  useEffect(() => {
    setListPage(1)
  }, [scope, attributionMonth, reportMonth, deferredKeyword, kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, isEditMode])

  useEffect(() => {
    let cancelled = false
    const loadList = async () => {
      try {
        setListLoading(true)
        const effectiveQuery = isEditMode ? undefined : deferredKeyword.trim() || undefined
        const effectiveKind: TaskBoardKind = isEditMode ? 'all' : kindFilter
        const effectiveAssigneeId = isEditMode ? undefined : assigneeFilterId !== 'all' ? Number(assigneeFilterId) : undefined
        const effectiveIncompleteOnly = isEditMode ? false : incompleteOnly
        const effectiveIncludeExcluded = isEditMode ? true : includeExcluded
        const res = await listTaskBoards(scope, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          q: effectiveQuery,
          kind: effectiveKind,
          assignee_id: effectiveAssigneeId,
          incomplete_only: effectiveIncompleteOnly,
          include_excluded: effectiveIncludeExcluded,
          page: listPage,
          size: TASK_BOARD_LIST_PAGE_SIZE,
        })
        if (cancelled) return
        setListRowsApi(res.items || [])
        setListTotal(Number(res.total || 0))
        setListLoaded(true)
      } catch (error) {
        if (cancelled) return
        setListRowsApi([])
        setListTotal(0)
        setListLoaded(true)
        toast.error(getTaskBoardErrorMessage(error))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void loadList()
    return () => {
      cancelled = true
    }
  }, [scope, attributionMonth, reportMonth, deferredKeyword, kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, isEditMode, listPage, listReloadKey])

  useEffect(() => {
    let cancelled = false
    const loadDetail = async () => {
      if (!selectedCompanyId) {
        setSelectedBoardId(null)
        setDetailItems([])
        setDetailTemplates([])
        setDetailDocCountMap({})
        setFileModalTaskId(null)
        setFileModalDocs([])
        return
      }
      try {
        setDetailLoading(true)
        const ensured = await ensureTaskBoard(scope, selectedCompanyId, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          copy_from_previous: true,
        })
        if (cancelled) return
        const boardId = ensured.board.id
        setSelectedBoardId(boardId)

        const [itemsRes, templatesRes] = await Promise.all([
          listTaskBoardItems(scope, selectedCompanyId, boardId),
          listTaskTemplates(scope, selectedCompanyId, false),
        ])
        if (cancelled) return
        setDetailItems(itemsRes.items || [])
        setDetailTemplates(templatesRes.items || [])
        setTemplateTaskName((prev) => prev || templatesRes.items[0]?.task_name || '')

        const docPairs = await Promise.all(
          (itemsRes.items || []).map(async (item) => {
            try {
              const docs = await listTaskItemDocs(scope, selectedCompanyId, boardId, item.id)
              return [item.id, docs.total] as const
            } catch {
              return [item.id, 0] as const
            }
          })
        )
        if (cancelled) return
        setDetailDocCountMap(Object.fromEntries(docPairs))
      } catch (error) {
        if (cancelled) return
        setSelectedBoardId(null)
        setDetailItems([])
        setDetailTemplates([])
        setDetailDocCountMap({})
        toast.error(getTaskBoardErrorMessage(error))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [scope, attributionMonth, reportMonth, selectedCompanyId])

  useEffect(() => {
    let cancelled = false
    const loadTemplateCatalog = async () => {
      if (!templateSourceCompanyId) {
        setColumnCatalog([])
        return
      }
      try {
        const res = await listTaskTemplates(scope, templateSourceCompanyId, {
          includeInactive: false,
          templateKind: 'base',
        })
        if (cancelled) return
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
      if (!templateSourceCompanyId) {
        setProcessTemplateCatalog([])
        return
      }
      try {
        const res = await listTaskTemplates(scope, templateSourceCompanyId, {
          includeInactive: false,
          templateKind: 'process',
        })
        if (cancelled) return
        const mapped = (res.items || []).map((item) => ({
          id: `process-template-${item.id}`,
          name: item.task_name,
          templateId: item.id,
          executionMode: item.execution_mode ?? 'check_only',
        }))
        setProcessTemplateCatalog(mapped)
        setManualMajorColumns(mapped.map((item) => ({ id: item.id, name: item.name })))
      } catch {
        if (cancelled) return
        setProcessTemplateCatalog([])
      }
    }
    void loadProcessTemplateCatalog()
    return () => {
      cancelled = true
    }
  }, [scope, templateSourceCompanyId])

  useEffect(() => {
    let cancelled = false
    const bootstrapColumnsFromSavedItems = async () => {
      if (customColumns.length > 0) return
      if (!columnCatalog.length || !listRowsApi.length) return
      const rowsWithBoard = listRowsApi.filter((row) => row.board_id)
      if (!rowsWithBoard.length) return

      const selectedTaskNormNames = new Set<string>()
      await Promise.all(
        rowsWithBoard.map(async (row) => {
          try {
            const res = await listTaskBoardItems(scope, row.company_id, Number(row.board_id))
            ;(res.items || []).forEach((item) => {
              const normName = normalizeText(item.task_name || '')
              if (normName) selectedTaskNormNames.add(normName)
            })
          } catch {
            // noop
          }
        })
      )
      if (cancelled || selectedTaskNormNames.size === 0) return

      const nextColumns = columnCatalog
        .filter((item) => selectedTaskNormNames.has(normalizeText(item.name)))
        .map((item) => ({ id: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`, name: item.name }))

      if (nextColumns.length > 0) {
        setCustomColumns(nextColumns)
      }
    }
    void bootstrapColumnsFromSavedItems()
    return () => {
      cancelled = true
    }
  }, [scope, listRowsApi, columnCatalog, customColumns.length])

  useEffect(() => {
    let cancelled = false
    const hydrateColumnChecksFromSavedItems = async () => {
      if (!customColumns.length || !listRowsApi.length) return

      const nextChecks: Record<string, boolean> = {}
      listRowsApi.forEach((row) => {
        customColumns.forEach((column) => {
          nextChecks[getColumnCheckKey(row.company_id, column.id)] = false
        })
      })

      await Promise.all(
        listRowsApi
          .filter((row) => row.board_id)
          .map(async (row) => {
            try {
              const res = await listTaskBoardItems(scope, row.company_id, Number(row.board_id))
              const selectedTaskNormNames = new Set<string>()
              ;(res.items || []).forEach((item) => {
                const normName = normalizeText(item.task_name || '')
                if (normName) selectedTaskNormNames.add(normName)
              })
              customColumns.forEach((column) => {
                nextChecks[getColumnCheckKey(row.company_id, column.id)] = selectedTaskNormNames.has(normalizeText(column.name))
              })
            } catch {
              // noop
            }
          })
      )

      if (cancelled) return
      setCompanyColumnChecks((prev) => ({ ...prev, ...nextChecks }))
    }
    void hydrateColumnChecksFromSavedItems()
    return () => {
      cancelled = true
    }
  }, [scope, listRowsApi, customColumns])

  useEffect(() => {
    setCompanyMajorChecks((prev) => {
      const next = { ...prev }
      listRows.forEach((row) => {
        const majorSet = new Set(row.major_tasks.map((task) => normalizeText(task)))
        majorColumns.forEach((column) => {
          const key = getMajorCheckKey(row.company_id, column.id)
          if (next[key] === undefined) {
            const normName = normalizeText(column.name)
            next[key] = majorSet.has(normName)
          }
        })
      })
      return next
    })
  }, [listRows, majorColumns])

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

  const handleOpenDetail = (companyId: number) => setSelectedCompanyId(companyId)

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
    if (!isEditMode) return
    const key = getColumnCheckKey(companyId, columnId)
    setCompanyColumnChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleColumnAll = (columnId: string) => {
    if (!isEditMode) return
    const activeRows = listRows.filter((row) => !row.is_excluded)
    const allChecked = activeRows.length > 0 && activeRows.every((row) => companyColumnChecks[getColumnCheckKey(row.company_id, columnId)])
    setCompanyColumnChecks((prev) => {
      const next = { ...prev }
      activeRows.forEach((row) => {
        next[getColumnCheckKey(row.company_id, columnId)] = !allChecked
      })
      return next
    })
    toast.success(allChecked ? '열 전체 선택을 해제했습니다.' : '열 전체 선택을 적용했습니다.')
  }

  const toggleCompanyMajorValue = (companyId: number, columnId: string) => {
    if (!isEditMode) return
    const key = getMajorCheckKey(companyId, columnId)
    setCompanyMajorChecks((prev) => ({ ...prev, [key]: !prev[key] }))
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
        const created = await createTaskTemplate(scope, templateSourceCompanyId, {
          task_name: name,
          sort_order: 100,
          template_kind: 'process',
          execution_mode: newMajorExecutionMode,
        })
        const nextCatalogItem: ProcessTemplateCatalogItem = {
          id: `process-template-${created.id}`,
          name: created.task_name,
          templateId: created.id,
          executionMode: created.execution_mode ?? newMajorExecutionMode,
        }
        setProcessTemplateCatalog((prev) => [...prev, nextCatalogItem])
        setManualMajorColumns((prev) => [...prev, { id: nextCatalogItem.id, name: nextCatalogItem.name }])
        setNewMajorColumnName('')
        setNewMajorExecutionMode('check_only')
        toast.success('업무진행 템플릿이 등록되었습니다.')
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
      } finally {
        setIsCreatingMajorColumn(false)
      }
    })()
  }

  const handleTaskStatusPatch = async (taskId: number, status: TaskItemStatus) => {
    if (!selectedCompanyId || !selectedBoardId) return
    try {
      const updated = await updateTaskBoardItem(scope, selectedCompanyId, selectedBoardId, taskId, { status })
      setDetailItems((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
      setListReloadKey((prev) => prev + 1)
      toast.success('상태를 저장했습니다.')
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    }
  }

  const openTaskDocs = async (taskId: number) => {
    if (!selectedCompanyId || !selectedBoardId) return
    try {
      const docs = await listTaskItemDocs(scope, selectedCompanyId, selectedBoardId, taskId)
      setFileModalDocs(
        (docs.items || []).map((doc) => ({
          id: String(doc.id),
          fileName: `문서 #${doc.docs_entry_id}`,
          uploader: doc.linked_by_type === 'admin' ? '어드민' : '클라이언트',
          uploadedAt: new Date(doc.created_at).toLocaleString('ko-KR'),
        }))
      )
      setFileModalTaskId(taskId)
      setDetailDocCountMap((prev) => ({ ...prev, [taskId]: docs.total }))
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    }
  }

  const addTaskToSelectedCompany = () => {
    if (!selectedCompanyId || !selectedBoardId) return
    const nextName = addTab === 'template' ? templateTaskName.trim() : customTaskName.trim()
    if (!nextName) {
      toast.error('업무명을 입력해 주세요.')
      return
    }

    const duplicated = detailItems.some((item) => normalizeText(item.task_name) === normalizeText(nextName))
    if (duplicated) {
      toast.error('동일 텍스트 업무가 이미 존재합니다.')
      return
    }

    const matchedTemplate = detailTemplates.find((template) => template.task_name === nextName)
    void (async () => {
      try {
        const created = await createTaskBoardItem(scope, selectedCompanyId, selectedBoardId, {
          task_name: nextName,
          template_id: matchedTemplate?.id ?? null,
        })
        setDetailItems((prev) => [...prev, created])
        setDetailDocCountMap((prev) => ({ ...prev, [created.id]: 0 }))
        setCustomTaskName('')
        setIsAddModalOpen(false)
        setListReloadKey((prev) => prev + 1)
        toast.success('업무 항목이 추가되었습니다.')
      } catch (error) {
        toast.error(getTaskBoardErrorMessage(error))
      }
    })()
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
    if (!templateSourceCompanyId) {
      toast.error('업체 리스트를 먼저 불러와 주세요.')
      return false
    }
    try {
      setIsUpdatingCatalog(true)
      await Promise.all(
        nextList.map((item, idx) =>
          updateTaskTemplate(scope, templateSourceCompanyId, item.templateId, {
            sort_order: (idx + 1) * 10,
          })
        )
      )
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
    if (!templateSourceCompanyId) {
      toast.error('업체 리스트를 먼저 불러와 주세요.')
      return
    }
    const target = columnCatalog.find((item) => item.templateId === templateId)
    if (!target) return
    const ok = await confirm({
      title: '템플릿 삭제',
      description: `[${target.name}] 템플릿을 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return
    try {
      setIsUpdatingCatalog(true)
      await deleteTaskTemplate(scope, templateSourceCompanyId, target.templateId)
      const removed = columnCatalog.find((item) => item.templateId === target.templateId)
      setColumnCatalog((prev) => prev.filter((item) => item.templateId !== target.templateId))
      if (removed) {
        setPendingColumnSelection((prev) => prev.filter((id) => id !== removed.id))
      }
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setIsUpdatingCatalog(false)
    }
  }

  const saveChecklistSelections = async () => {
    if (isSavingChecklist) return false
    if (!columnCatalog.length) return true

    const activeColumnIdSet = new Set(customColumns.map((column) => column.id))
    const templateTargets = columnCatalog.map((item) => ({
      templateId: item.templateId,
      taskName: item.name,
      columnId: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`,
    }))

    try {
      setIsSavingChecklist(true)
      await Promise.all(
        listRows
          .filter((row) => !row.is_excluded)
          .map(async (row) => {
            const hasAnySelected = templateTargets.some(
              (target) =>
                activeColumnIdSet.has(target.columnId) && Boolean(companyColumnChecks[getColumnCheckKey(row.company_id, target.columnId)])
            )

            let boardId = row.board_id ?? null
            if (!boardId) {
              if (!hasAnySelected) return
              const ensured = await ensureTaskBoard(scope, row.company_id, {
                attribution_month: attributionMonth,
                report_month: reportMonth,
                copy_from_previous: true,
              })
              boardId = ensured.board.id
            }

            const rowTemplateRes = await listTaskTemplates(scope, row.company_id, {
              includeInactive: false,
              templateKind: 'base',
            })
            const rowTemplateIdByNormName = new Map<string, number>()
            ;(rowTemplateRes.items || []).forEach((template) => {
              rowTemplateIdByNormName.set(normalizeText(template.task_name), template.id)
            })
            const ensureTemplateIdForTask = async (taskName: string) => {
              const norm = normalizeText(taskName)
              const found = rowTemplateIdByNormName.get(norm)
              if (typeof found === 'number') return found
              const created = await createTaskTemplate(scope, row.company_id, {
                task_name: taskName,
                sort_order: 100,
                template_kind: 'base',
              })
              rowTemplateIdByNormName.set(norm, created.id)
              return created.id
            }

            const itemsPayload = await Promise.all(
              templateTargets.map(async (target) => {
                const selected =
                  activeColumnIdSet.has(target.columnId) &&
                  Boolean(companyColumnChecks[getColumnCheckKey(row.company_id, target.columnId)])
                if (!selected) {
                  const matchedTemplateId = rowTemplateIdByNormName.get(normalizeText(target.taskName))
                  return {
                    template_id: typeof matchedTemplateId === 'number' ? matchedTemplateId : null,
                    task_name: target.taskName,
                    selected: false,
                  }
                }
                const matchedTemplateId = await ensureTemplateIdForTask(target.taskName)
                return {
                  template_id: matchedTemplateId,
                  task_name: target.taskName,
                  selected: true,
                }
              })
            )

            try {
              await bulkUpsertTaskBoardItems(scope, row.company_id, boardId, {
                items: itemsPayload,
              })
            } catch (error) {
              const status = (error as { response?: { status?: number } })?.response?.status
              if (status !== 404) throw error

              // fallback: 서버에 bulk-upsert가 아직 반영되지 않은 경우 기존 단건 CRUD로 저장
              const existing = await listTaskBoardItems(scope, row.company_id, boardId)
              const byTemplateId = new Map<number, TaskBoardItem>()
              const byNameNorm = new Map<string, TaskBoardItem>()
              ;(existing.items || []).forEach((item) => {
                if (typeof item.template_id === 'number') byTemplateId.set(item.template_id, item)
                byNameNorm.set(normalizeText(item.task_name), item)
              })

              await Promise.all(
                itemsPayload.map(async (item) => {
                  const existingItem =
                    (typeof item.template_id === 'number' ? byTemplateId.get(item.template_id) : undefined) ??
                    byNameNorm.get(normalizeText(item.task_name))

                  if (item.selected) {
                    if (!existingItem) {
                      await createTaskBoardItem(scope, row.company_id, boardId, {
                        task_name: item.task_name,
                        template_id: item.template_id ?? null,
                      })
                    }
                    return
                  }

                  if (existingItem) {
                    await deleteTaskBoardItem(scope, row.company_id, boardId, existingItem.id)
                  }
                })
              )
            }
          })
      )
      setListReloadKey((prev) => prev + 1)
      return true
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
      return false
    } finally {
      setIsSavingChecklist(false)
    }
  }

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

  return (
    <div className="space-y-4">
      {selectedCompanyId ? (
        <section className="space-y-4 bg-white">
          <header className="border-b border-zinc-200 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800">
                  {selectedListRow?.company_name || `업체 #${selectedCompanyId}`} ·{' '}
                  {mapCompanyKindToLabel(selectedListRow?.company_kind || 'individual')} · 담당자 {selectedListRow?.assignee_name || '—'}
                </p>
                <p className="text-xs text-zinc-500">귀속월 {attributionMonth} / 신고월 {reportMonth}</p>
              </div>
              <div className="flex items-center gap-2">
                <UiButton size="sm" variant="secondary" onClick={() => toast.success('전월 복사(목업)')}>
                  전월 복사
                </UiButton>
                <UiButton size="sm" variant="primary" onClick={() => setIsAddModalOpen(true)}>
                  항목 추가
                </UiButton>
                <UiButton size="sm" variant="soft" onClick={() => toast.success('저장(목업)')}>
                  저장
                </UiButton>
                <UiButton
                  size="sm"
                  variant="tabInactive"
                  onClick={() => {
                    setSelectedCompanyId(null)
                    setFileModalTaskId(null)
                    setFileModalDocs([])
                  }}
                >
                  목록으로
                </UiButton>
              </div>
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </header>

          {detailLoading ? (
            <div className="py-16 text-center text-sm text-zinc-500">상세 업무 항목을 불러오는 중입니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-zinc-100 text-zinc-700">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">업무명</th>
                    <th className="px-2 py-2 text-center font-semibold">상태</th>
                    <th className="px-2 py-2 text-center font-semibold">첨부</th>
                    <th className="px-2 py-2 text-center font-semibold">완료일</th>
                    <th className="px-2 py-2 text-left font-semibold">비고</th>
                    <th className="px-2 py-2 text-center font-semibold">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((task) => (
                    <tr key={task.id} className="border-t border-zinc-200">
                      <td className="px-2 py-2 text-zinc-800">{task.task_name}</td>
                      <td className="px-2 py-2 text-center">{renderStatus(task.status)}</td>
                      <td className="px-2 py-2 text-center">{detailDocCountMap[task.id] ?? 0}개</td>
                      <td className="px-2 py-2 text-center text-zinc-600">{task.completed_at || '—'}</td>
                      <td className="px-2 py-2 text-zinc-600">{task.note || '—'}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <UiButton size="xs" variant="secondary" onClick={() => openTaskDocs(task.id)}>
                            파일첨부
                          </UiButton>
                          <UiButton size="xs" variant="tabInactive" onClick={() => openTaskDocs(task.id)}>
                            상세
                          </UiButton>
                          <UiButton size="xs" variant="primary" onClick={() => handleTaskStatusPatch(task.id, 'done')}>
                            완료
                          </UiButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!detailItems.length ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-16 text-center text-zinc-400">
                        등록된 업무 항목이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4 bg-white">
          <header className="space-y-2 border-b border-zinc-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1">
                <UiButton size="iconSm" variant="secondary" onClick={() => setAttributionMonth((prev) => monthShift(prev, -1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </UiButton>
                <span className="text-xs font-semibold text-zinc-700">귀속월 {attributionMonth}</span>
                <UiButton size="iconSm" variant="secondary" onClick={() => setAttributionMonth((prev) => monthShift(prev, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </UiButton>
                <span className="ml-2 text-xs text-zinc-500">신고월 {reportMonth}</span>
              </div>

              {!isEditMode ? (
                <label className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
                  미완료만
                </label>
              ) : null}
              {!isEditMode ? (
                <label className="inline-flex items-center gap-1 text-xs text-zinc-700">
                  <input type="checkbox" checked={includeExcluded} onChange={(event) => setIncludeExcluded(event.target.checked)} />
                  제외 포함
                </label>
              ) : null}
              {!isEditMode ? (
                <select
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
              ) : null}

              {!isEditMode ? (
                <div className="inline-flex items-center rounded-md border border-zinc-300 bg-white p-0.5">
                  {(['all', 'corporate', 'individual'] as const).map((kind) => {
                    const active = kindFilter === kind
                    const label = kind === 'all' ? '전체' : kind === 'corporate' ? '법인' : '개인'
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setKindFilter(kind)}
                        className={`rounded px-2 py-1 text-xs transition ${
                          active ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              ) : null}

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
                <UiButton size="sm" variant="secondary" onClick={() => setIsMajorColumnModalOpen(true)}>
                  업무진행추가
                </UiButton>
              ) : null}

              <UiButton
                size="sm"
                variant={isEditMode ? 'primary' : 'tabInactive'}
                onClick={async () => {
                  if (!isEditMode) {
                    setIncompleteOnly(false)
                    setKindFilter('all')
                    setAssigneeFilterId('all')
                    setKeyword('')
                    setIsEditMode(true)
                    showEditModeNotice('편집 중')
                    return
                  }
                  const saved = await saveChecklistSelections()
                  if (!saved) return
                  setIsEditMode(false)
                  showEditModeNotice('저장 완료')
                }}
                disabled={isSavingChecklist}
              >
                {isEditMode ? (isSavingChecklist ? '저장 중...' : '편집 완료') : '편집'}
              </UiButton>

              {isSavingChecklist ? <span className="text-xs font-medium text-sky-700">저장 중...</span> : null}
              {!isSavingChecklist && editModeNotice ? <span className="text-xs font-medium text-zinc-600">{editModeNotice}</span> : null}

              {!isEditMode ? (
                <div className="ml-auto w-full max-w-xs">
                  <UiSearchInput
                    value={keyword}
                    onChange={setKeyword}
                    placeholder="업체명 검색"
                    wrapperClassName="h-8"
                    inputClassName="text-xs"
                  />
                </div>
              ) : null}
            </div>
            <div className="text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-xs">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: `${noColumnWidth}px`, minWidth: `${noColumnWidth}px` }}>
                    No
                  </th>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: `${kindColumnWidth}px`, minWidth: `${kindColumnWidth}px` }}>
                    구분
                  </th>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: `${nameColumnWidth}px`, minWidth: `${nameColumnWidth}px` }}>
                    상호
                  </th>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                    주기
                  </th>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                    귀속
                  </th>
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                    급여
                  </th>
                  {!hasSelectedCustomColumns ? (
                    <th
                      className="px-1 py-1.5 text-center font-semibold"
                      style={{ width: `${baseCriteriaColumnWidth}px`, minWidth: `${baseCriteriaColumnWidth}px` }}
                    >
                      <span className="block leading-tight">
                        {splitByTwoChars(isEditMode ? '기준업무' : '기본업무').map((chunk, idx) => (
                          <span key={`base-criteria-${idx}`} className="block">
                            {chunk}
                          </span>
                        ))}
                      </span>
                    </th>
                  ) : null}
                  {customColumns.map((column) => (
                    <th
                      key={column.id}
                      className="px-1 py-2 text-center font-semibold"
                      style={{ width: `${workColumnWidthMap[column.id] ?? 72}px`, minWidth: `${workColumnWidthMap[column.id] ?? 72}px` }}
                    >
                      {isEditMode ? (
                        <button
                          type="button"
                          onClick={() => toggleColumnAll(column.id)}
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium transition ${
                            columnAllCheckedMap[column.id]
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-300 bg-white text-zinc-700 hover:border-sky-300 hover:text-sky-700'
                          }`}
                          title="컬럼 전체 선택/해제"
                        >
                          <span className="block leading-tight">
                            {splitByTwoChars(column.name).map((chunk, idx) => (
                              <span key={`${column.id}-${idx}`} className="block">
                                {chunk}
                              </span>
                            ))}
                          </span>
                        </button>
                      ) : (
                        <span className="block leading-tight">
                          {splitByTwoChars(column.name).map((chunk, idx) => (
                            <span key={`${column.id}-${idx}`} className="block">
                              {chunk}
                            </span>
                          ))}
                        </span>
                      )}
                    </th>
                  ))}
                  {isEditMode ? (
                    majorColumns.map((column) => (
                      <th key={column.id} className="px-1 py-1.5 text-center font-semibold" style={{ width: '36px', minWidth: '36px' }}>
                        <span className="block leading-tight">
                          {splitByTwoChars(column.name).map((chunk, idx) => (
                            <span key={`${column.id}-${idx}`} className="block">
                              {chunk}
                            </span>
                          ))}
                        </span>
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="w-28 px-1 py-1.5 text-center font-semibold">진행률</th>
                      <th className="w-20 px-1 py-1.5 text-center font-semibold">미완료수</th>
                      {!hasSelectedMajorColumns ? <th className="w-80 px-1 py-1.5 text-left font-semibold">업무진행</th> : null}
                      <th className="w-32 px-1 py-1.5 text-left font-semibold">비고</th>
                    </>
                  )}
                  <th className="w-32 px-1 py-1.5 text-center font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((row, idx) => {
                  const displayKind = mapCompanyKindToLabel(row.company_kind)
                  const progress = Number(row.progress_percent || 0)
                  return (
                    <tr key={row.company_id} className={`border-t border-zinc-200 ${row.is_excluded ? 'bg-rose-50' : ''}`}>
                      <td className="px-1 py-1.5 text-center text-zinc-600" style={{ width: `${noColumnWidth}px`, minWidth: `${noColumnWidth}px` }}>
                        {idx + 1}
                      </td>
                      <td className="px-1 py-1.5 text-center" style={{ width: `${kindColumnWidth}px`, minWidth: `${kindColumnWidth}px` }}>
                        {displayKind}
                      </td>
                      <td className="px-1 py-1.5 text-center" style={{ width: `${nameColumnWidth}px`, minWidth: `${nameColumnWidth}px` }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(row.company_id)}
                          className="mx-auto block max-w-full truncate text-center text-zinc-800 hover:text-sky-700 hover:underline"
                          title={row.company_name}
                        >
                          {row.company_name}
                        </button>
                      </td>
                      <td className="px-1 py-1.5 text-center" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                        <span
                          className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getReportCycleClass(
                            row.report_cycle
                          )}`}
                        >
                          {mapReportCycleLabel(row.report_cycle)}
                        </span>
                      </td>
                      <td
                        className="px-1 py-1.5 text-center text-zinc-700"
                        style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                      >
                        {mapPayrollBasisLabel(row.payroll_basis)}
                      </td>
                      <td
                        className="px-1 py-1.5 text-center text-zinc-700"
                        style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                      >
                        {row.payroll_day ?? '—'}
                      </td>
                      {!hasSelectedCustomColumns ? (
                        <td
                          className="px-1 py-1.5 text-center text-zinc-500"
                          style={{ width: `${baseCriteriaColumnWidth}px`, minWidth: `${baseCriteriaColumnWidth}px` }}
                        >
                          -
                        </td>
                      ) : null}
                      {customColumns.map((column) => {
                        const checked = companyColumnChecks[getColumnCheckKey(row.company_id, column.id)] || false
                        return (
                          <td
                            key={`${row.company_id}:${column.id}`}
                            className="px-1 py-2 text-center"
                            style={{ width: `${workColumnWidthMap[column.id] ?? 72}px`, minWidth: `${workColumnWidthMap[column.id] ?? 72}px` }}
                          >
                            {row.is_excluded ? (
                              <span className="text-zinc-400">N/A</span>
                            ) : isEditMode ? (
                              <button
                                type="button"
                                onClick={() => toggleCompanyColumnValue(row.company_id, column.id)}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                  checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 bg-white text-zinc-500'
                                }`}
                                title={checked ? '체크됨' : '체크안됨'}
                              >
                                {checked ? '✓' : ''}
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center">
                                {checked ? (
                                  <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                                ) : (
                                  <X className="h-4 w-4 text-red-600" aria-hidden="true" />
                                )}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      {isEditMode ? (
                        majorColumns.map((column) => {
                          const checked = companyMajorChecks[getMajorCheckKey(row.company_id, column.id)] || false
                          return (
                            <td key={`${row.company_id}:${column.id}`} className="px-1 py-2 text-center" style={{ width: '36px', minWidth: '36px' }}>
                              {row.is_excluded ? (
                                <span className="text-zinc-400">-</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleCompanyMajorValue(row.company_id, column.id)}
                                  className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                    checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-300 bg-white text-zinc-500'
                                  }`}
                                  title={checked ? '선택됨' : '해당없음'}
                                  disabled={!isEditMode}
                                >
                                  {checked ? '✓' : '-'}
                                </button>
                              )}
                            </td>
                          )
                        })
                      ) : (
                        <>
                          <td className="px-1 py-1.5 text-center text-zinc-700">
                            {row.is_excluded ? (
                              '—'
                            ) : (
                              <div className="mx-auto w-24">
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
                          <td className="px-1 py-1.5 text-center text-zinc-700">{row.is_excluded ? 'N/A' : row.todo_count}</td>
                          {!hasSelectedMajorColumns ? (
                            <td className="px-1 py-1.5">
                              {row.is_excluded ? (
                                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">N/A</span>
                              ) : row.major_tasks.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {row.major_tasks.map((chip) => (
                                    <span key={chip} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                          ) : null}
                          <td className="px-1 py-1.5 text-zinc-600">
                            <p className="truncate" title={row.note || '—'}>
                              {row.note || '—'}
                            </p>
                          </td>
                        </>
                      )}
                      <td className="px-1 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          {!isEditMode ? (
                            <UiButton size="xs" variant="secondary" onClick={() => handleOpenDetail(row.company_id)}>
                              상세
                            </UiButton>
                          ) : null}
                          {isEditMode ? (
                            <UiButton size="xs" variant={row.is_excluded ? 'soft' : 'tabInactive'} onClick={() => handleToggleExclude(row)}>
                              {row.is_excluded ? '해제' : '제외'}
                            </UiButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!listLoading && listLoaded && listRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        isEditMode
                          ? 8 + (hasSelectedCustomColumns ? customColumns.length : 1) + majorColumns.length
                          : 11 + (hasSelectedCustomColumns ? customColumns.length : 1) + (hasSelectedMajorColumns ? 0 : 1)
                      }
                      className="px-2 py-16 text-center text-zinc-400"
                    >
                      조건에 맞는 업체가 없습니다.
                    </td>
                  </tr>
                ) : null}
                {listLoading ? (
                  <tr>
                    <td
                      colSpan={
                        isEditMode
                          ? 8 + (hasSelectedCustomColumns ? customColumns.length : 1) + majorColumns.length
                          : 11 + (hasSelectedCustomColumns ? customColumns.length : 1) + (hasSelectedMajorColumns ? 0 : 1)
                      }
                      className="px-2 py-16 text-center text-zinc-400"
                    >
                      업무보드 리스트를 불러오는 중입니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {!listLoading && listTotal > 0 ? (
            <div className="mt-2 flex items-center justify-center">
              <Pagination
                page={listPage}
                total={listTotal}
                limit={TASK_BOARD_LIST_PAGE_SIZE}
                onPageChange={setListPage}
                className="mt-0"
              />
            </div>
          ) : null}
        </section>
      )}

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

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">업무 항목 추가</p>
              <UiButton size="xs" variant="tabInactive" onClick={() => setIsAddModalOpen(false)}>
                닫기
              </UiButton>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <UiButton size="xs" variant={addTab === 'template' ? 'tabActive' : 'tabInactive'} onClick={() => setAddTab('template')}>
                템플릿에서 선택
              </UiButton>
              <UiButton size="xs" variant={addTab === 'custom' ? 'tabActive' : 'tabInactive'} onClick={() => setAddTab('custom')}>
                직접 입력
              </UiButton>
            </div>
            {addTab === 'template' ? (
              <select
                value={templateTaskName}
                onChange={(event) => setTemplateTaskName(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
              >
                {detailTemplates.length ? (
                  detailTemplates.map((template) => (
                    <option key={template.id} value={template.task_name}>
                      {template.task_name}
                    </option>
                  ))
                ) : (
                  <option value="">템플릿이 없습니다.</option>
                )}
              </select>
            ) : (
              <input
                value={customTaskName}
                onChange={(event) => setCustomTaskName(event.target.value)}
                placeholder="업무명을 입력해 주세요."
                className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm text-zinc-700"
              />
            )}
            <p className="mt-2 text-xs text-zinc-500">동일 텍스트 중복은 저장되지 않습니다.</p>
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsAddModalOpen(false)}>
                취소
              </UiButton>
              <UiButton size="sm" variant="primary" onClick={addTaskToSelectedCompany}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}

      {fileModalTask ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">연결 파일 · {fileModalTask.task_name}</p>
              <UiButton
                size="xs"
                variant="tabInactive"
                onClick={() => {
                  setFileModalTaskId(null)
                  setFileModalDocs([])
                }}
              >
                닫기
              </UiButton>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="min-w-full text-xs">
                <thead className="bg-zinc-100 text-zinc-700">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold">파일명</th>
                    <th className="px-2 py-2 text-center font-semibold">업로더</th>
                    <th className="px-2 py-2 text-center font-semibold">업로드일</th>
                    <th className="px-2 py-2 text-center font-semibold">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {fileModalDocs.length ? (
                    fileModalDocs.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-200">
                        <td className="px-2 py-2">{item.fileName}</td>
                        <td className="px-2 py-2 text-center">{item.uploader}</td>
                        <td className="px-2 py-2 text-center">{item.uploadedAt}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <UiButton size="xs" variant="tabInactive" onClick={() => window.open('https://example.com', '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              미리보기
                            </UiButton>
                            <UiButton size="xs" variant="secondary" onClick={() => toast.success('다운로드(목업)')}>
                              다운로드
                            </UiButton>
                            <UiButton size="xs" variant="tabInactive" onClick={() => toast.success('연결해제(목업)')}>
                              연결해제
                            </UiButton>
                            <UiButton
                              size="xs"
                              variant="danger"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: '원본파일 삭제',
                                  description: '원본파일을 삭제하시겠습니까?',
                                  confirmText: '삭제',
                                  cancelText: '취소',
                                  variant: 'danger',
                                })
                                if (!ok) return
                                toast.success('원본삭제(목업)')
                              }}
                            >
                              원본삭제
                            </UiButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-2 py-10 text-center text-zinc-400">
                        연결된 문서가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </div>
        </div>
      ) : null}

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
                processTemplateCatalog.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                    <p className="min-w-0 truncate text-sm text-zinc-700" title={item.name}>
                      {item.name}
                    </p>
                    <span className="ml-2 inline-flex rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600">
                      {getExecutionModeLabel(item.executionMode)}
                    </span>
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
                onChange={(event) => setNewMajorExecutionMode(event.target.value as TaskExecutionMode)}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
              >
                <option value="check_only">체크만</option>
                <option value="file_only">파일 필수</option>
                <option value="file_and_notify">파일+송부</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-zinc-500">완료 조건은 템플릿의 execution_mode로 저장됩니다.</p>
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsMajorColumnModalOpen(false)}>
                취소
              </UiButton>
              <UiButton size="sm" variant="primary" onClick={addMajorColumn} disabled={isCreatingMajorColumn}>
                {isCreatingMajorColumn ? '저장 중...' : '저장'}
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
