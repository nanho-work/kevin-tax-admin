'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Link2, Plus, Trash2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import { formatKSTDate, formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'
import {
  bulkUploadTaskItemFiles,
  bulkUpsertTaskBoardItems,
  createTaskTemplate,
  deleteTaskItemFile,
  deleteTaskBoardItem,
  deleteTaskTemplate,
  deliverTaskBoardItem,
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
  uploadTaskItemFile,
  type TaskBoardItem,
  type TaskBoardKind,
  type TaskBoardListItem,
  type TaskBoardScope,
  type TaskBoardSortBy,
  type TaskBoardSortOrder,
  type TaskItemStatus,
  type TaskTemplateItem,
  type TaskExecutionMode,
} from '@/services/workflowTaskBoard'

type CompanyKind = '법인' | '개인'
type AddTab = 'template' | 'custom'
type CustomColumn = { id: string; name: string }
type ColumnCatalogItem = { id: string; name: string; templateId: number; sortOrder: number }
type MajorColumn = { id: string; name: string }
type ProcessTemplateCatalogItem = {
  id: string
  name: string
  templateId: number
  executionMode: TaskExecutionMode
  sortOrder: number
  sourceTaskName?: string | null
}
type AssigneeOption = { id: number; name: string }

type FileItem = {
  id: string
  docsEntryId: number
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

function splitByTwoChars(value: string): string[] {
  return splitByChars(value, 2)
}

function splitByFourChars(value: string): string[] {
  return splitByChars(value, 4)
}

function getExecutionModeLabel(mode: TaskExecutionMode) {
  if (mode === 'file_only') return '파일 필수'
  if (mode === 'file_and_notify') return '파일+송부'
  return '체크만'
}

const TEMPLATE_COLUMN_PREFIX = 'template-col-'
const TASK_BOARD_LIST_PAGE_SIZE = 10
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

  const [attributionMonth, setAttributionMonth] = useState('2026-03')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [kindFilter, setKindFilter] = useState<TaskBoardKind>('all')
  const [assigneeFilterId, setAssigneeFilterId] = useState('all')
  const [sortBy, setSortBy] = useState<TaskBoardSortBy | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<TaskBoardSortOrder | undefined>(undefined)
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
  const [, setManualMajorColumns] = useState<MajorColumn[]>([])
  const [processTemplateCatalog, setProcessTemplateCatalog] = useState<ProcessTemplateCatalogItem[]>([])
  const [companyMajorChecks, setCompanyMajorChecks] = useState<Record<string, boolean>>({})
  const [companyMajorCompletedAt, setCompanyMajorCompletedAt] = useState<Record<string, string | null>>({})
  const [isEditMode, setIsEditMode] = useState(false)
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
  const editNoticeTimerRef = useRef<number | null>(null)

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [detailItems, setDetailItems] = useState<TaskBoardItem[]>([])
  const [detailTemplates, setDetailTemplates] = useState<TaskTemplateItem[]>([])
  const [detailDocCountMap, setDetailDocCountMap] = useState<Record<number, number>>({})
  const [itemFileNameMap, setItemFileNameMap] = useState<Record<number, string[]>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTab, setAddTab] = useState<AddTab>('template')
  const [templateTaskName, setTemplateTaskName] = useState('')
  const [customTaskName, setCustomTaskName] = useState('')

  const [fileModalTaskId, setFileModalTaskId] = useState<number | null>(null)
  const [fileModalDocs, setFileModalDocs] = useState<FileItem[]>([])
  const [fileUploadQueue, setFileUploadQueue] = useState<File[]>([])
  const [isUploadingTaskFiles, setIsUploadingTaskFiles] = useState(false)
  const [uploadingCardTaskId, setUploadingCardTaskId] = useState<number | null>(null)
  const taskFileInputRef = useRef<HTMLInputElement | null>(null)

  const reportMonth = monthShift(attributionMonth, 1)
  const getColumnCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`
  const getMajorCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`

  const listRows = useMemo(() => [...listRowsApi], [listRowsApi])

  const selectedListRow = useMemo(
    () => listRows.find((item) => item.company_id === selectedCompanyId) ?? null,
    [listRows, selectedCompanyId]
  )

  const majorColumns = useMemo<MajorColumn[]>(
    () =>
      processTemplateCatalog
        .filter((item) => selectedMajorTemplateIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name })),
    [processTemplateCatalog, selectedMajorTemplateIds]
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
  const majorColumnWidth = 56
  const majorColumnListWidth = 84

  const fileModalTask = useMemo(
    () => (fileModalTaskId ? detailItems.find((task) => task.id === fileModalTaskId) ?? null : null),
    [detailItems, fileModalTaskId]
  )
  const hasSelectedCustomColumns = customColumns.length > 0
  const selectedCompanyBaseBadges = useMemo(() => {
    if (!selectedCompanyId) return []
    return customColumns
      .filter((column) => companyColumnChecks[getColumnCheckKey(selectedCompanyId, column.id)])
      .map((column) => column.name)
  }, [selectedCompanyId, customColumns, companyColumnChecks])

  const detailProcessItems = useMemo(
    () => detailItems.filter((item) => (item.template_kind_snapshot ?? 'process') === 'process'),
    [detailItems]
  )

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
  }, [scope, attributionMonth, reportMonth, deferredKeyword, kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, isEditMode, sortBy, sortOrder])

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
        const effectiveSortBy = sortBy
        const effectiveSortOrder = sortOrder
        const effectivePage = isEditMode ? 1 : listPage
        const effectiveSize = isEditMode ? TASK_BOARD_EDIT_PAGE_SIZE : TASK_BOARD_LIST_PAGE_SIZE
        const res = await listTaskBoards(scope, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          q: effectiveQuery,
          kind: effectiveKind,
          assignee_id: effectiveAssigneeId,
          incomplete_only: effectiveIncompleteOnly,
          include_excluded: effectiveIncludeExcluded,
          sort_by: effectiveSortBy,
          order: effectiveSortOrder,
          page: effectivePage,
          size: effectiveSize,
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
  }, [scope, attributionMonth, reportMonth, deferredKeyword, kindFilter, assigneeFilterId, incompleteOnly, includeExcluded, isEditMode, sortBy, sortOrder, listPage, listReloadKey])

  useEffect(() => {
    let cancelled = false
    const loadDetail = async () => {
      if (!selectedCompanyId) {
        setSelectedBoardId(null)
        setDetailItems([])
        setDetailTemplates([])
        setDetailDocCountMap({})
        setItemFileNameMap({})
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
              return [item.id, docs] as const
            } catch {
              return [item.id, { total: 0, items: [] }] as const
            }
          })
        )
        if (cancelled) return
        setDetailDocCountMap(Object.fromEntries(docPairs.map(([itemId, docs]) => [itemId, docs.total])))
        setItemFileNameMap(
          Object.fromEntries(
            docPairs.map(([itemId, docs]) => [
              itemId,
              (docs.items || []).map((doc) => doc.title?.trim() || doc.file_name?.trim() || `문서 #${doc.docs_entry_id}`),
            ])
          )
        )
      } catch (error) {
        if (cancelled) return
        setSelectedBoardId(null)
        setDetailItems([])
        setDetailTemplates([])
        setDetailDocCountMap({})
        setItemFileNameMap({})
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
        setProcessTemplateCatalog(sorted)
        setManualMajorColumns(sorted.map((item) => ({ id: item.id, name: item.name })))
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
    const validIds = processTemplateCatalog.map((item) => item.id)
    setSelectedMajorTemplateIds((prev) => {
      if (!prev.length) return validIds
      return prev.filter((id) => validIds.includes(id))
    })
    setPendingMajorSelection((prev) => prev.filter((id) => validIds.includes(id)))
  }, [processTemplateCatalog])

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
    const hydrateChecklistChecksFromSavedItems = async () => {
      if ((!customColumns.length && !majorColumns.length) || !listRowsApi.length) return

      const nextColumnChecks: Record<string, boolean> = {}
      const nextMajorChecks: Record<string, boolean> = {}
      const nextMajorCompletedAt: Record<string, string | null> = {}
      listRowsApi.forEach((row) => {
        customColumns.forEach((column) => {
          nextColumnChecks[getColumnCheckKey(row.company_id, column.id)] = false
        })
        majorColumns.forEach((column) => {
          nextMajorChecks[getMajorCheckKey(row.company_id, column.id)] = false
          nextMajorCompletedAt[getMajorCheckKey(row.company_id, column.id)] = null
        })
      })

      await Promise.all(
        listRowsApi
          .filter((row) => row.board_id)
          .map(async (row) => {
            try {
              const res = await listTaskBoardItems(scope, row.company_id, Number(row.board_id))
              const selectedTaskNormNames = new Set<string>()
              const doneCompletedAtByNorm = new Map<string, string>()
              ;(res.items || []).forEach((item) => {
                const normName = normalizeText(item.task_name || '')
                if (normName) selectedTaskNormNames.add(normName)
                if (normName && item.status === 'done' && item.completed_at) {
                  doneCompletedAtByNorm.set(normName, item.completed_at)
                }
              })
              customColumns.forEach((column) => {
                nextColumnChecks[getColumnCheckKey(row.company_id, column.id)] = selectedTaskNormNames.has(normalizeText(column.name))
              })
              majorColumns.forEach((column) => {
                const key = getMajorCheckKey(row.company_id, column.id)
                const norm = normalizeText(column.name)
                nextMajorChecks[key] = selectedTaskNormNames.has(norm)
                nextMajorCompletedAt[key] = doneCompletedAtByNorm.get(norm) ?? null
              })
            } catch {
              // noop
            }
          })
      )

      if (cancelled) return
      setCompanyColumnChecks((prev) => ({ ...prev, ...nextColumnChecks }))
      setCompanyMajorChecks((prev) => ({ ...prev, ...nextMajorChecks }))
      setCompanyMajorCompletedAt((prev) => ({ ...prev, ...nextMajorCompletedAt }))
    }
    void hydrateChecklistChecksFromSavedItems()
    return () => {
      cancelled = true
    }
  }, [scope, listRowsApi, customColumns, majorColumns])

  useEffect(() => {
    let cancelled = false
    const hydrateProcessSourceFromSavedItems = async () => {
      if (!processTemplateCatalog.length || !listRowsApi.length) return
      const rowsWithBoard = listRowsApi.filter((row) => row.board_id)
      if (!rowsWithBoard.length) return

      const sourceByTaskNorm = new Map<string, string>()
      await Promise.all(
        rowsWithBoard.map(async (row) => {
          try {
            const res = await listTaskBoardItems(scope, row.company_id, Number(row.board_id))
            ;(res.items || []).forEach((item) => {
              const taskNorm = normalizeText(item.task_name || '')
              const source = item.source_task_name?.trim()
              if (!taskNorm || !source) return
              if (!sourceByTaskNorm.has(taskNorm)) {
                sourceByTaskNorm.set(taskNorm, source)
              }
            })
          } catch {
            // noop
          }
        })
      )

      if (cancelled || sourceByTaskNorm.size === 0) return
      setProcessTemplateCatalog((prev) =>
        prev.map((item) => {
          const source = sourceByTaskNorm.get(normalizeText(item.name))
          if (!source) return item
          return { ...item, sourceTaskName: source }
        })
      )
    }
    void hydrateProcessSourceFromSavedItems()
    return () => {
      cancelled = true
    }
  }, [scope, listRowsApi, processTemplateCatalog.length])

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

  const toggleMajorColumnAll = (columnId: string) => {
    if (!isEditMode) return
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

  const handleTaskStatusPatch = async (taskId: number, status: TaskItemStatus) => {
    if (!selectedCompanyId || !selectedBoardId) return
    try {
      const target = detailItems.find((item) => item.id === taskId)
      const mode = target?.execution_mode_snapshot ?? 'check_only'
      const hasLinkedSource = Boolean(target?.source_item_id)
      if (
        status === 'done' &&
        (mode === 'file_and_notify' || (mode === 'check_only' && hasLinkedSource))
      ) {
        await deliverTaskBoardItem(scope, selectedCompanyId, selectedBoardId, taskId)
      } else {
        await updateTaskBoardItem(scope, selectedCompanyId, selectedBoardId, taskId, { status })
      }
      const refreshed = await listTaskBoardItems(scope, selectedCompanyId, selectedBoardId)
      setDetailItems(refreshed.items || [])
      setListReloadKey((prev) => prev + 1)
      toast.success('상태를 저장했습니다.')
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    }
  }

  const openTaskDocs = async (taskId: number) => {
    if (!selectedCompanyId || !selectedBoardId) return
    const task = detailItems.find((item) => item.id === taskId)
    const mode = task?.execution_mode_snapshot ?? 'check_only'
    if (mode === 'check_only') {
      toast.error('체크만 항목은 파일 상세를 사용할 수 없습니다.')
      return
    }
    try {
      const docs = await listTaskItemDocs(scope, selectedCompanyId, selectedBoardId, taskId)
      setFileModalDocs(
        (docs.items || []).map((doc) => {
          const anyDoc = doc as unknown as Record<string, unknown>
          const uploaderName =
            (typeof anyDoc.uploader_name === 'string' ? anyDoc.uploader_name : '') ||
            (typeof anyDoc.uploaderName === 'string' ? anyDoc.uploaderName : '') ||
            (typeof anyDoc.linked_by_name === 'string' ? anyDoc.linked_by_name : '')
          return {
            id: String(doc.id),
            docsEntryId: doc.docs_entry_id,
            fileName: doc.title?.trim() || doc.file_name?.trim() || `문서 #${doc.docs_entry_id}`,
            uploader: uploaderName.trim() || (doc.linked_by_type === 'admin' ? '어드민' : '클라이언트'),
            uploadedAt: formatKSTDateTimeAssumeUTC(doc.created_at),
          }
        })
      )
      setFileModalTaskId(taskId)
      setDetailDocCountMap((prev) => ({ ...prev, [taskId]: docs.total }))
      setItemFileNameMap((prev) => ({
        ...prev,
        [taskId]: (docs.items || []).map((doc) => doc.title?.trim() || doc.file_name?.trim() || `문서 #${doc.docs_entry_id}`),
      }))
      setFileUploadQueue([])
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    }
  }

  const queueTaskFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming || [])
    if (!files.length) return
    setFileUploadQueue((prev) => [...prev, ...files])
  }

  const getDefaultTitleFromFile = (fileName: string) => {
    const idx = fileName.lastIndexOf('.')
    if (idx <= 0) return fileName
    return fileName.slice(0, idx)
  }

  const uploadTaskFilesWithFallback = async (taskId: number, files: File[]) => {
    if (!selectedCompanyId || !selectedBoardId) {
      return { total: files.length, successCount: 0, failedCount: files.length, firstError: '업체/보드 정보가 없습니다.' }
    }
    try {
      const res = await bulkUploadTaskItemFiles(scope, selectedCompanyId, selectedBoardId, taskId, {
        files,
        titles: files.map((file) => getDefaultTitleFromFile(file.name)),
      })
      return {
        total: res.total,
        successCount: res.success_count,
        failedCount: res.failed_count,
        firstError: res.failed_items?.[0]?.error,
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status !== 422) throw error

      let successCount = 0
      let failedCount = 0
      let firstError = ''
      for (const file of files) {
        try {
          await uploadTaskItemFile(scope, selectedCompanyId, selectedBoardId, taskId, {
            file,
            title: getDefaultTitleFromFile(file.name),
          })
          successCount += 1
        } catch (singleError) {
          failedCount += 1
          if (!firstError) firstError = getTaskBoardErrorMessage(singleError)
        }
      }
      return { total: files.length, successCount, failedCount, firstError }
    }
  }

  const uploadQueuedTaskFiles = async () => {
    if (!selectedCompanyId || !selectedBoardId || !fileModalTaskId) return
    if (!fileUploadQueue.length) {
      toast.error('업로드할 파일을 먼저 선택해 주세요.')
      return
    }
    try {
      setIsUploadingTaskFiles(true)
      const result = await uploadTaskFilesWithFallback(fileModalTaskId, fileUploadQueue)
      if (result.failedCount > 0 && result.successCount > 0) {
        toast.success(`업로드 부분 성공 (${result.successCount}/${result.total})`)
      } else if (result.failedCount > 0) {
        toast.error(result.firstError || '파일 업로드에 실패했습니다.')
      } else {
        toast.success(`파일 ${result.successCount}건 업로드 완료`)
      }
      setFileUploadQueue([])
      await openTaskDocs(fileModalTaskId)
      const refreshed = await listTaskBoardItems(scope, selectedCompanyId, selectedBoardId)
      setDetailItems(refreshed.items || [])
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setIsUploadingTaskFiles(false)
    }
  }

  const uploadTaskFilesForItem = async (taskId: number, files: File[]) => {
    if (!selectedCompanyId || !selectedBoardId) return
    if (!files.length) return
    try {
      setUploadingCardTaskId(taskId)
      const result = await uploadTaskFilesWithFallback(taskId, files)
      if (result.failedCount > 0 && result.successCount > 0) {
        toast.success(`업로드 부분 성공 (${result.successCount}/${result.total})`)
      } else if (result.failedCount > 0) {
        toast.error(result.firstError || '파일 업로드에 실패했습니다.')
      } else {
        toast.success(`파일 ${result.successCount}건 업로드 완료`)
      }

      try {
        const docs = await listTaskItemDocs(scope, selectedCompanyId, selectedBoardId, taskId)
        setDetailDocCountMap((prev) => ({ ...prev, [taskId]: docs.total }))
        setItemFileNameMap((prev) => ({
          ...prev,
          [taskId]: (docs.items || []).map((doc) => doc.title?.trim() || doc.file_name?.trim() || `문서 #${doc.docs_entry_id}`),
        }))
      } catch {
        // noop
      }
      const refreshed = await listTaskBoardItems(scope, selectedCompanyId, selectedBoardId)
      setDetailItems(refreshed.items || [])
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setUploadingCardTaskId(null)
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

  const handleDeleteTaskFile = async (docsEntryId: number) => {
    if (!selectedCompanyId || !selectedBoardId || !fileModalTaskId) return
    if (fileModalTask?.status === 'done') return
    const ok = await confirm({
      title: '파일 삭제',
      description: '해당 파일을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteTaskItemFile(scope, selectedCompanyId, selectedBoardId, fileModalTaskId, docsEntryId)
      toast.success('파일이 삭제되었습니다.')
      await openTaskDocs(fileModalTaskId)
      const refreshed = await listTaskBoardItems(scope, selectedCompanyId, selectedBoardId)
      setDetailItems(refreshed.items || [])
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
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

  const syncProcessTemplateSortOrders = async (nextList: ProcessTemplateCatalogItem[]) => {
    if (!templateSourceCompanyId) {
      toast.error('업체 리스트를 먼저 불러와 주세요.')
      return false
    }
    try {
      setIsUpdatingMajorCatalog(true)
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

  const saveChecklistSelections = async () => {
    if (isSavingChecklist) return false
    const processExecutionModeByNormName = new Map<string, TaskExecutionMode>()
    const processSourceTaskNameByNormName = new Map<string, string>()
    processTemplateCatalog.forEach((item) => {
      processExecutionModeByNormName.set(normalizeText(item.name), item.executionMode)
      if (item.sourceTaskName?.trim()) {
        processSourceTaskNameByNormName.set(normalizeText(item.name), item.sourceTaskName.trim())
      }
    })

    const activeColumnIdSet = new Set(customColumns.map((column) => column.id))
    const baseTargets = columnCatalog.map((item) => ({
      taskName: item.name,
      columnId: `${TEMPLATE_COLUMN_PREFIX}${item.templateId}`,
      templateKind: 'base' as const,
      executionMode: undefined as TaskExecutionMode | undefined,
    }))
    const processTargets = majorColumns.map((item) => ({
      taskName: item.name,
      columnId: item.id,
      templateKind: 'process' as const,
      executionMode: processExecutionModeByNormName.get(normalizeText(item.name)) ?? ('check_only' as TaskExecutionMode),
      sourceTaskName: processSourceTaskNameByNormName.get(normalizeText(item.name)) ?? null,
    }))
    const allTargets = [...baseTargets, ...processTargets]

    if (!allTargets.length) return true

    const hydrateProcessSourceLabelsFromItems = (items: TaskBoardItem[]) => {
      const sourceByTaskNameNorm = new Map<string, string | null>()
      items.forEach((item) => {
        const norm = normalizeText(item.task_name || '')
        if (!norm) return
        sourceByTaskNameNorm.set(norm, item.source_task_name?.trim() || null)
      })
      setProcessTemplateCatalog((prev) =>
        prev.map((item) => {
          const sourceTaskName = sourceByTaskNameNorm.get(normalizeText(item.name))
          if (typeof sourceTaskName === 'undefined') return item
          return { ...item, sourceTaskName }
        })
      )
    }

    try {
      setIsSavingChecklist(true)
      await Promise.all(
        listRows
          .filter((row) => !row.is_excluded)
          .map(async (row) => {
            const hasAnySelected = allTargets.some((target) => {
              if (target.templateKind === 'base') {
                return (
                  activeColumnIdSet.has(target.columnId) &&
                  Boolean(companyColumnChecks[getColumnCheckKey(row.company_id, target.columnId)])
                )
              }
              return Boolean(companyMajorChecks[getMajorCheckKey(row.company_id, target.columnId)])
            })

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
            })
            const rowTemplateIdByKindAndNormName = new Map<string, number>()
            ;(rowTemplateRes.items || []).forEach((template) => {
              const kind = template.template_kind === 'process' ? 'process' : 'base'
              rowTemplateIdByKindAndNormName.set(`${kind}:${normalizeText(template.task_name)}`, template.id)
            })
            const ensureTemplateIdForTask = async (
              taskName: string,
              templateKind: 'base' | 'process',
              executionMode?: TaskExecutionMode
            ) => {
              const norm = normalizeText(taskName)
              const key = `${templateKind}:${norm}`
              const found = rowTemplateIdByKindAndNormName.get(key)
              if (typeof found === 'number') return found
              const created = await createTaskTemplate(scope, row.company_id, {
                task_name: taskName,
                sort_order: 100,
                template_kind: templateKind,
                execution_mode: templateKind === 'process' ? executionMode ?? 'check_only' : undefined,
              })
              rowTemplateIdByKindAndNormName.set(key, created.id)
              return created.id
            }

            const existingItemsRes = await listTaskBoardItems(scope, row.company_id, boardId)
            const existingItemIdByNormName = new Map<string, number>()
            const existingItemByNormName = new Map<string, TaskBoardItem>()
            ;(existingItemsRes.items || []).forEach((item) => {
              const norm = normalizeText(item.task_name || '')
              if (!norm) return
              existingItemIdByNormName.set(norm, item.id)
              existingItemByNormName.set(norm, item)
            })

            const itemsPayload = await Promise.all(
              allTargets.map(async (target) => {
                const selected =
                  target.templateKind === 'base'
                    ? activeColumnIdSet.has(target.columnId) &&
                      Boolean(companyColumnChecks[getColumnCheckKey(row.company_id, target.columnId)])
                    : Boolean(companyMajorChecks[getMajorCheckKey(row.company_id, target.columnId)])
                if (!selected) {
                  const matchedTemplateId = rowTemplateIdByKindAndNormName.get(
                    `${target.templateKind}:${normalizeText(target.taskName)}`
                  )
                  return {
                    template_id: typeof matchedTemplateId === 'number' ? matchedTemplateId : null,
                    task_name: target.taskName,
                    selected: false,
                  }
                }
                const matchedTemplateId = await ensureTemplateIdForTask(
                  target.taskName,
                  target.templateKind,
                  target.executionMode
                )
                const sourceNormName =
                  target.templateKind === 'process' && target.sourceTaskName
                    ? normalizeText(target.sourceTaskName)
                    : ''
                const currentItem = existingItemByNormName.get(normalizeText(target.taskName))
                const sourceItemId = sourceNormName ? existingItemIdByNormName.get(sourceNormName) : undefined
                const payload: {
                  template_id: number
                  task_name: string
                  selected: true
                  source_item_id?: number | null
                } = {
                  template_id: matchedTemplateId,
                  task_name: target.taskName,
                  selected: true,
                }
                if (sourceNormName) {
                  // source_task_name이 있어도 item_id를 못 찾은 경우에는 기존 연동을 보존합니다.
                  if (typeof sourceItemId === 'number') {
                    payload.source_item_id = sourceItemId
                  } else if (currentItem?.source_item_id != null) {
                    payload.source_item_id = currentItem.source_item_id
                  }
                } else if (currentItem?.source_item_id != null) {
                  // 기존 연동을 명시 해제할 때만 null을 전송합니다.
                  payload.source_item_id = null
                }
                return payload
              })
            )

            try {
              const firstUpsert = await bulkUpsertTaskBoardItems(
                scope,
                row.company_id,
                boardId,
                {
                  items: itemsPayload,
                },
                {
                  returnItems: row.company_id === selectedCompanyId,
                }
              )
              if (row.company_id === selectedCompanyId && firstUpsert.items) {
                setDetailItems(firstUpsert.items)
                hydrateProcessSourceLabelsFromItems(firstUpsert.items)
              }
              const linkedProcessTargets = processTargets.filter((target) => target.sourceTaskName)
              if (linkedProcessTargets.length > 0) {
                const refreshedItems = firstUpsert.items ?? (await listTaskBoardItems(scope, row.company_id, boardId)).items ?? []
                const refreshedItemIdByNormName = new Map<string, number>()
                const refreshedItemByNormName = new Map<string, TaskBoardItem>()
                ;(refreshedItems || []).forEach((item) => {
                  const norm = normalizeText(item.task_name || '')
                  if (!norm) return
                  refreshedItemIdByNormName.set(norm, item.id)
                  refreshedItemByNormName.set(norm, item)
                })

                const sourceLinkPayload = await Promise.all(
                  linkedProcessTargets.map(async (target) => {
                    const selected = Boolean(companyMajorChecks[getMajorCheckKey(row.company_id, target.columnId)])
                    if (!selected) {
                      return {
                        task_name: target.taskName,
                        selected: false,
                      }
                    }
                    const templateId = await ensureTemplateIdForTask(
                      target.taskName,
                      target.templateKind,
                      target.executionMode
                    )
                    const sourceNormName = target.sourceTaskName ? normalizeText(target.sourceTaskName) : ''
                    const sourceItemId = sourceNormName ? refreshedItemIdByNormName.get(sourceNormName) : undefined
                    const currentItem = refreshedItemByNormName.get(normalizeText(target.taskName))
                    const payload: {
                      template_id: number
                      task_name: string
                      selected: true
                      source_item_id?: number | null
                    } = {
                      template_id: templateId,
                      task_name: target.taskName,
                      selected: true,
                    }
                    if (sourceNormName) {
                      if (typeof sourceItemId === 'number') {
                        payload.source_item_id = sourceItemId
                      } else if (currentItem?.source_item_id != null) {
                        payload.source_item_id = currentItem.source_item_id
                      }
                    } else if (currentItem?.source_item_id != null) {
                      payload.source_item_id = null
                    }
                    return payload
                  })
                )
                const secondUpsert = await bulkUpsertTaskBoardItems(
                  scope,
                  row.company_id,
                  boardId,
                  {
                    items: sourceLinkPayload,
                  },
                  {
                    returnItems: row.company_id === selectedCompanyId,
                  }
                )
                if (row.company_id === selectedCompanyId && secondUpsert.items) {
                  setDetailItems(secondUpsert.items)
                  hydrateProcessSourceLabelsFromItems(secondUpsert.items)
                }
              }
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
                  {mapCompanyKindToLabel(selectedListRow?.company_kind || 'individual')} · 담당자 {selectedListRow?.assignee_name || '-'}
                </p>
                <p className="text-xs text-zinc-500">귀속월 {attributionMonth} / 신고월 {reportMonth}</p>
              </div>
              <div className="flex items-center gap-2">
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
            <div className="space-y-4">
              <div className="border-b border-zinc-200 pb-2">
                <p className="text-xs font-semibold text-zinc-700">기준업무</p>
                {selectedCompanyBaseBadges.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedCompanyBaseBadges.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-zinc-500">선택된 기준업무가 없습니다.</p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {detailProcessItems.map((task) => {
                  const mode = task.execution_mode_snapshot ?? 'check_only'
                  const isDone = task.status === 'done'
                  const docCount = detailDocCountMap[task.id] ?? 0
                  const hasLinkedSource = Boolean(task.source_item_id)
                  const sourceLinkedItem =
                    task.source_item_id != null ? detailItems.find((item) => item.id === task.source_item_id) : null
                  const sourceLabel = task.source_task_name?.trim() || sourceLinkedItem?.task_name?.trim() || '연동 업무'
                  const canCompleteByLink = mode === 'check_only' && hasLinkedSource ? Boolean(task.can_deliver) : true
                  const isCardUploading = uploadingCardTaskId === task.id
                  const sourceFileNames = task.source_item_id ? itemFileNameMap[task.source_item_id] ?? [] : []
                  const isCheckOnlyWithoutSource = mode === 'check_only' && !hasLinkedSource

                  return (
                    <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-800" title={task.task_name}>
                            {task.task_name}
                          </p>
                          {mode === 'file_only' ? (
                            <p className={`mt-0.5 text-[11px] ${docCount > 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                              현재 {docCount}건
                            </p>
                          ) : null}
                          {hasLinkedSource ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500" title={sourceLabel}>
                              <Link2 className="h-3 w-3" aria-hidden="true" />
                              {sourceLabel} | 파일 {task.source_file_count ?? 0}건
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0">
                          <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                            {getExecutionModeLabel(mode)}
                          </span>
                        </div>
                      </div>

                      {mode === 'file_only' ? (
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault()
                            if (isDone || isCardUploading) return
                            const files = Array.from(event.dataTransfer.files || [])
                            if (!files.length) return
                            void uploadTaskFilesForItem(task.id, files)
                          }}
                          className={`flex min-h-20 w-full items-center justify-center rounded-md border border-dashed px-3 py-2 text-xs ${
                            isDone
                              ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500'
                              : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-sky-300 hover:text-sky-700'
                          }`}
                        >
                          {isDone ? (
                            <span>완료됨 · {formatKSTDateTimeAssumeUTC(task.completed_at)}</span>
                          ) : isCardUploading ? (
                            <span>업로드 중...</span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span>드래그 업로드</span>
                              <input
                                id={`task-card-file-input-${task.id}`}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  const files = Array.from(event.target.files || [])
                                  if (!files.length) return
                                  void uploadTaskFilesForItem(task.id, files)
                                  event.currentTarget.value = ''
                                }}
                              />
                              <button
                                type="button"
                                className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:border-sky-300 hover:text-sky-700"
                                onClick={() => {
                                  const input = document.getElementById(`task-card-file-input-${task.id}`) as HTMLInputElement | null
                                  input?.click()
                                }}
                              >
                                파일 선택
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`flex min-h-20 w-full items-center justify-center rounded-md border px-3 py-2 text-xs ${
                            isDone
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : isCheckOnlyWithoutSource
                                ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                              : canCompleteByLink
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          <div className="w-full space-y-1 text-center">
                            <p>
                              {isDone
                                ? `완료됨 · ${formatKSTDateTimeAssumeUTC(task.completed_at)}`
                                : isCheckOnlyWithoutSource
                                  ? '완료 버튼으로 처리'
                                  : canCompleteByLink
                                    ? '완료 가능'
                                    : task.blocked_reason || '이전업무미완료'}
                            </p>
                            {mode === 'check_only' && hasLinkedSource && sourceFileNames.length > 0 ? (
                              <div className="space-y-0.5">
                                {sourceFileNames.map((name, idx) => (
                                  <p key={`${task.id}-source-file-inline-${idx}`} className="truncate text-[11px]" title={name}>
                                    {name}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-end gap-1">
                        {mode !== 'check_only' ? (
                          <UiButton
                            size="xs"
                            variant="tabInactive"
                            onClick={() => openTaskDocs(task.id)}
                            disabled={isDone}
                          >
                            상세
                          </UiButton>
                        ) : null}
                        {isDone && mode !== 'check_only' ? (
                          <UiButton size="xs" variant="secondary" onClick={() => handleTaskStatusPatch(task.id, 'in_progress')}>
                            수정
                          </UiButton>
                        ) : (
                          <UiButton
                            size="xs"
                            variant="primary"
                            onClick={() => handleTaskStatusPatch(task.id, 'done')}
                            disabled={mode === 'check_only' && hasLinkedSource && !canCompleteByLink}
                          >
                            완료
                          </UiButton>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              {!detailProcessItems.length ? (
                <div className="rounded-lg border border-zinc-200 px-2 py-16 text-center text-zinc-400">
                  등록된 진행업무 항목이 없습니다.
                </div>
              ) : null}
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
                  <th className="px-1 py-1.5 text-center font-semibold" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
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
                      <th
                        key={column.id}
                        className="px-1 py-1.5 text-center font-semibold"
                        style={{ width: `${majorColumnWidth}px`, minWidth: `${majorColumnWidth}px`, maxWidth: `${majorColumnWidth}px` }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMajorColumnAll(column.id)}
                          className={`rounded border px-1 py-0.5 text-[10px] font-medium transition ${
                            majorColumnAllCheckedMap[column.id]
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-300 bg-white text-zinc-700 hover:border-sky-300 hover:text-sky-700'
                          }`}
                          title="컬럼 전체 선택/해제"
                        >
                          <span className="block leading-tight">
                            {splitByFourChars(column.name).map((chunk, idx) => (
                              <span key={`${column.id}-${idx}`} className="block whitespace-nowrap">
                                {chunk}
                              </span>
                            ))}
                          </span>
                        </button>
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="w-28 px-1 py-1.5 text-center font-semibold">
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
                      <th className="w-20 px-1 py-1.5 text-center font-semibold">
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
                      {majorColumns.length > 0 ? (
                        majorColumns.map((column) => (
                          <th
                            key={column.id}
                            className="px-1 py-1.5 text-center font-semibold"
                            style={{ width: `${majorColumnWidth}px`, minWidth: `${majorColumnWidth}px`, maxWidth: `${majorColumnWidth}px` }}
                          >
                            <span className="block leading-tight">
                              {splitByFourChars(column.name).map((chunk, idx) => (
                                <span key={`${column.id}-${idx}`} className="block whitespace-nowrap">
                                  {chunk}
                                </span>
                              ))}
                            </span>
                          </th>
                        ))
                      ) : (
                        <th className="w-20 px-1 py-1.5 text-center font-semibold">업무진행</th>
                      )}
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
                          onClick={() => {
                            if (isEditMode) return
                            handleOpenDetail(row.company_id)
                          }}
                          className={`mx-auto block max-w-full truncate text-center ${
                            isEditMode ? 'cursor-default text-zinc-800' : 'text-zinc-800 hover:text-sky-700 hover:underline'
                          }`}
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
                        {row.payroll_day ?? '-'}
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
                              <span className="text-zinc-400">-</span>
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
                            <td
                              key={`${row.company_id}:${column.id}`}
                              className="px-1 py-2 text-center"
                              style={{ width: `${majorColumnWidth}px`, minWidth: `${majorColumnWidth}px`, maxWidth: `${majorColumnWidth}px` }}
                            >
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
                                  {checked ? '✓' : ''}
                                </button>
                              )}
                            </td>
                          )
                        })
                      ) : (
                        <>
                          <td className="px-1 py-1.5 text-center text-zinc-700">
                            {row.is_excluded ? (
                              '-'
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
                          <td className="px-1 py-1.5 text-center text-zinc-700">{row.is_excluded ? '-' : row.todo_count}</td>
                          {majorColumns.length > 0 ? (
                            majorColumns.map((column) => {
                              const checked = companyMajorChecks[getMajorCheckKey(row.company_id, column.id)] || false
                              const completedAt = companyMajorCompletedAt[getMajorCheckKey(row.company_id, column.id)] || null
                          return (
                                <td
                                  key={`${row.company_id}:${column.id}`}
                                  className="px-1 py-2 text-center"
                                  style={{
                                    width: `${majorColumnListWidth}px`,
                                    minWidth: `${majorColumnListWidth}px`,
                                    maxWidth: `${majorColumnListWidth}px`,
                                  }}
                                >
                                  {row.is_excluded ? (
                                    <span className="text-zinc-400">-</span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center text-[11px] text-zinc-700">
                                      {checked && completedAt ? formatKSTDate(completedAt) : '-'}
                                    </span>
                                  )}
                                </td>
                              )
                            })
                          ) : (
                            <td className="px-1 py-1.5 text-center text-zinc-400">-</td>
                          )}
                          <td className="px-1 py-1.5 text-zinc-600">
                            <p className="truncate" title={row.note || '-'}>
                              {row.note || '-'}
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
                          ? 7 + (hasSelectedCustomColumns ? customColumns.length : 1) + majorColumns.length
                          : 10 + (hasSelectedCustomColumns ? customColumns.length : 1) + (majorColumns.length > 0 ? majorColumns.length : 1)
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
                          ? 7 + (hasSelectedCustomColumns ? customColumns.length : 1) + majorColumns.length
                          : 10 + (hasSelectedCustomColumns ? customColumns.length : 1) + (majorColumns.length > 0 ? majorColumns.length : 1)
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
          {!isEditMode && !listLoading && listTotal > 0 ? (
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
              <div className="flex items-center gap-1">
                <input
                  ref={taskFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (!event.target.files?.length) return
                    queueTaskFiles(event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
                <UiButton
                  size="xs"
                  variant="secondary"
                  onClick={() => taskFileInputRef.current?.click()}
                  disabled={fileModalTask.status === 'done'}
                >
                  파일 추가
                </UiButton>
                <UiButton
                  size="xs"
                  variant="primary"
                  onClick={uploadQueuedTaskFiles}
                  disabled={fileModalTask.status === 'done' || isUploadingTaskFiles || fileUploadQueue.length === 0}
                >
                  {isUploadingTaskFiles ? '업로드 중...' : '업로드 완료'}
                </UiButton>
                <UiButton
                  size="xs"
                  variant="tabInactive"
                  onClick={() => {
                    setFileModalTaskId(null)
                    setFileModalDocs([])
                    setFileUploadQueue([])
                  }}
                >
                  닫기
                </UiButton>
              </div>
            </div>
            <div
              className="mb-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (fileModalTask.status === 'done') return
                if (!event.dataTransfer.files?.length) return
                queueTaskFiles(event.dataTransfer.files)
              }}
            >
              {fileUploadQueue.length > 0
                ? `업로드 대기 ${fileUploadQueue.length}건`
                : fileModalTask.status === 'done'
                  ? '완료 상태입니다. 수정으로 전환 후 파일을 변경할 수 있습니다.'
                  : '파일을 드래그하거나 파일 추가 버튼으로 선택하세요.'}
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
                          <div className="flex items-center justify-center">
                            <UiButton
                              size="xs"
                              variant="danger"
                              onClick={() => void handleDeleteTaskFile(item.docsEntryId)}
                              disabled={fileModalTask.status === 'done'}
                              title={fileModalTask.status === 'done' ? '완료 상태에서는 삭제할 수 없습니다.' : '파일 삭제'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
