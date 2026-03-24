'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Mail, Paperclip, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import {
  getTaskBoardErrorMessage,
  listTaskBoards,
  patchTaskBoardExclude,
  patchTaskBoardExcludeByMonth,
  type TaskBoardListItem,
  type TaskBoardScope,
} from '@/services/workflowTaskBoard'

type CompanyKind = '법인' | '개인'
type WorkStatus = 'not_started' | 'in_progress' | 'done' | 'excluded' | 'na'
type AddTab = 'template' | 'custom'
type CustomColumn = { id: string; name: string }
type ColumnCatalogItem = { id: string; name: string }

type TaskItem = {
  id: string
  name: string
  status: WorkStatus
  attachmentCount: number
  completedAt: string | null
  note: string
  delayedDays: number
}

type AssigneeOption = { id: number; name: string }

type CompanyBoard = {
  id: number
  kind: CompanyKind
  name: string
  assignee: string
  excluded: boolean
  note: string
  tasks: TaskItem[]
}

type FileItem = {
  id: string
  fileName: string
  uploader: string
  uploadedAt: string
}

const STATUS_LABEL: Record<WorkStatus, string> = {
  not_started: '미시작',
  in_progress: '진행중',
  done: '완료',
  excluded: '제외',
  na: '해당없음',
}

const STATUS_CLASS: Record<WorkStatus, string> = {
  not_started: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  in_progress: 'border-sky-300 bg-sky-50 text-sky-700',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  excluded: 'border-zinc-200 bg-zinc-100 text-zinc-500',
  na: 'border-zinc-200 bg-zinc-100 text-zinc-500',
}

const TASK_TEMPLATES = [
  '급여대장 작성',
  '송부 및 확인',
  '원천세 신고',
  '4대보험 신고',
  '근로내용확인서 제출',
  '사업소득 간이지급명세서',
]

const COLUMN_TEMPLATES = ['신고', '근로', '퇴직', '사업', '일용', '이자배당']

function mapCompanyKindToLabel(kind: string): CompanyKind {
  if (kind === 'corporate') return '법인'
  if (kind === 'individual') return '개인'
  return '개인'
}

function monthShift(value: string, delta: number): string {
  const [yearRaw, monthRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function newTaskId() {
  return `task-${Math.random().toString(36).slice(2, 9)}`
}

function newColumnId() {
  return `col-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function seedCompanies(): CompanyBoard[] {
  return [
    {
      id: 1,
      kind: '법인',
      name: '가온테크',
      assignee: '김세무',
      excluded: false,
      note: '급여자료 빠름',
      tasks: [
        { id: 't-1-1', name: '급여대장 작성', status: 'in_progress', attachmentCount: 1, completedAt: null, note: '', delayedDays: 2 },
        { id: 't-1-2', name: '송부 및 확인', status: 'not_started', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
        { id: 't-1-3', name: '원천세 신고', status: 'done', attachmentCount: 2, completedAt: '2026.03.20', note: '', delayedDays: 0 },
        { id: 't-1-4', name: '4대보험 신고', status: 'na', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
      ],
    },
    {
      id: 2,
      kind: '개인',
      name: '나무파트너스',
      assignee: '박노무',
      excluded: false,
      note: '사업소득 비중 큼',
      tasks: [
        { id: 't-2-1', name: '급여대장 작성', status: 'not_started', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
        { id: 't-2-2', name: '송부 및 확인', status: 'not_started', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
        { id: 't-2-3', name: '원천세 신고', status: 'in_progress', attachmentCount: 1, completedAt: null, note: '확인 대기', delayedDays: 1 },
      ],
    },
    {
      id: 3,
      kind: '법인',
      name: '다원유통',
      assignee: '정회계',
      excluded: true,
      note: '이번 달 보드 제외',
      tasks: [
        { id: 't-3-1', name: '급여대장 작성', status: 'excluded', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
      ],
    },
    {
      id: 4,
      kind: '법인',
      name: '라임솔루션',
      assignee: '김세무',
      excluded: false,
      note: '',
      tasks: [
        { id: 't-4-1', name: '급여대장 작성', status: 'done', attachmentCount: 1, completedAt: '2026.03.18', note: '', delayedDays: 0 },
        { id: 't-4-2', name: '송부 및 확인', status: 'done', attachmentCount: 1, completedAt: '2026.03.19', note: '', delayedDays: 0 },
        { id: 't-4-3', name: '원천세 신고', status: 'done', attachmentCount: 2, completedAt: '2026.03.21', note: '', delayedDays: 0 },
      ],
    },
  ]
}

function seedFiles(companyId: number, taskId: string): FileItem[] {
  return [
    { id: `${companyId}-${taskId}-1`, fileName: '급여대장_202603.xlsx', uploader: '김세무', uploadedAt: '2026.03.21 10:10' },
    { id: `${companyId}-${taskId}-2`, fileName: '원천세신고_증빙.pdf', uploader: '박노무', uploadedAt: '2026.03.21 14:35' },
  ]
}

function seedCustomColumns(): CustomColumn[] {
  return [
    { id: 'col-report', name: '신고' },
    { id: 'col-labor', name: '근로' },
    { id: 'col-retire', name: '퇴직' },
  ]
}

function seedColumnCatalog(): ColumnCatalogItem[] {
  return COLUMN_TEMPLATES.map((name, idx) => ({ id: `catalog-${idx + 1}`, name }))
}

function seedCompanyColumnChecks(companies: CompanyBoard[], columns: CustomColumn[]) {
  const next: Record<string, boolean> = {}
  companies.forEach((company, rowIndex) => {
    columns.forEach((column, colIndex) => {
      next[`${company.id}:${column.id}`] = (rowIndex + colIndex) % 2 === 0
    })
  })
  return next
}

export default function WorkflowBoardPage() {
  const pathname = usePathname()
  const scope: TaskBoardScope = pathname.startsWith('/client') ? 'client' : 'admin'
  const [attributionMonth, setAttributionMonth] = useState('2026-03')
  const [incompleteOnly, setIncompleteOnly] = useState(true)
  const [kindFilter, setKindFilter] = useState<'all' | 'corporate' | 'individual'>('all')
  const [assigneeFilterId, setAssigneeFilterId] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [companies, setCompanies] = useState<CompanyBoard[]>(() => seedCompanies())
  const [listRowsApi, setListRowsApi] = useState<TaskBoardListItem[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listLoaded, setListLoaded] = useState(false)
  const [listReloadKey, setListReloadKey] = useState(0)
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => seedCustomColumns())
  const [columnCatalog, setColumnCatalog] = useState<ColumnCatalogItem[]>(() => seedColumnCatalog())
  const [companyColumnChecks, setCompanyColumnChecks] = useState<Record<string, boolean>>(() =>
    seedCompanyColumnChecks(seedCompanies(), seedCustomColumns())
  )
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [pendingColumnSelection, setPendingColumnSelection] = useState<string[]>([])
  const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTab, setAddTab] = useState<AddTab>('template')
  const [templateTaskName, setTemplateTaskName] = useState(TASK_TEMPLATES[0])
  const [customTaskName, setCustomTaskName] = useState('')
  const [fileModalTaskId, setFileModalTaskId] = useState<string | null>(null)
  const deferredKeyword = useDeferredValue(keyword)

  const assignees = useMemo<AssigneeOption[]>(() => {
    const map = new Map<number, string>()
    listRowsApi.forEach((item) => {
      if (item.assignee_id && item.assignee_name) {
        map.set(Number(item.assignee_id), item.assignee_name)
      }
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

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  )

  const reportMonth = monthShift(attributionMonth, 1)

  const getColumnCheckKey = (companyId: number, columnId: string) => `${companyId}:${columnId}`
  const existingColumnNameSet = useMemo(
    () => new Set(customColumns.map((column) => normalizeText(column.name))),
    [customColumns]
  )
  const listRows = useMemo(() => {
    const copied = [...listRowsApi]
    copied.sort((a, b) => {
      if (a.is_excluded === b.is_excluded) {
        return (a.company_name || '').localeCompare(b.company_name || '', 'ko')
      }
      return a.is_excluded ? 1 : -1
    })
    return copied
  }, [listRowsApi])

  useEffect(() => {
    let cancelled = false
    const loadList = async () => {
      try {
        setListLoading(true)
        const res = await listTaskBoards(scope, {
          attribution_month: attributionMonth,
          report_month: reportMonth,
          q: deferredKeyword.trim() || undefined,
          kind: kindFilter,
          assignee_id: assigneeFilterId !== 'all' ? Number(assigneeFilterId) : undefined,
          incomplete_only: incompleteOnly,
          include_excluded: true,
          page: 1,
          size: 100,
        })
        if (cancelled) return
        setListRowsApi(res.items || [])
        setListLoaded(true)
      } catch (error) {
        if (cancelled) return
        setListRowsApi([])
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
  }, [assigneeFilterId, attributionMonth, deferredKeyword, incompleteOnly, kindFilter, listReloadKey, reportMonth, scope])

  const workColumnWidthMap = useMemo(() => {
    const map: Record<string, number> = {}
    customColumns.forEach((column) => {
      const headerLength = column.name.trim().length
      let valueLength = 1
      listRows.forEach((company) => {
        const valueText = company.is_excluded
          ? 'N/A'
          : companyColumnChecks[getColumnCheckKey(company.company_id, column.id)]
            ? '✓'
            : ''
        valueLength = Math.max(valueLength, valueText.length)
      })
      const baseLength = Math.max(headerLength, valueLength)
      map[column.id] = Math.min(200, Math.max(64, baseLength * 9 + 20))
    })
    return map
  }, [listRows, companyColumnChecks, customColumns])

  const noteColumnWidth = 160
  const noColumnWidth = useMemo(() => {
    const digitLength = Math.max(String(Math.max(1, listRows.length)).length, 2)
    return Math.min(72, Math.max(44, digitLength * 10 + 20))
  }, [listRows.length])
  const kindColumnWidth = useMemo(() => {
    const longest = Math.max('구분'.length, ...listRows.map((company) => mapCompanyKindToLabel(company.company_kind).length))
    return Math.min(96, Math.max(56, longest * 12 + 22))
  }, [listRows])
  const nameColumnWidth = useMemo(() => {
    const longest = Math.max('상호'.length, ...listRows.map((company) => (company.company_name || '').trim().length))
    return Math.min(320, Math.max(140, longest * 11 + 26))
  }, [listRows])

  const fileModalTask = useMemo(() => {
    if (!selectedCompany || !fileModalTaskId) return null
    return selectedCompany.tasks.find((task) => task.id === fileModalTaskId) ?? null
  }, [fileModalTaskId, selectedCompany])

  const fileModalItems = useMemo(() => {
    if (!selectedCompany || !fileModalTask) return []
    return seedFiles(selectedCompany.id, fileModalTask.id)
  }, [fileModalTask, selectedCompany])

  const columnAllCheckedMap = useMemo(() => {
    const activeCompanies = listRows.filter((company) => !company.is_excluded)
    const map: Record<string, boolean> = {}
    customColumns.forEach((column) => {
      map[column.id] =
        activeCompanies.length > 0 &&
        activeCompanies.every((company) => companyColumnChecks[getColumnCheckKey(company.company_id, column.id)])
    })
    return map
  }, [listRows, companyColumnChecks, customColumns])

  const updateCompany = (companyId: number, updater: (prev: CompanyBoard) => CompanyBoard) => {
    setCompanies((prev) => prev.map((company) => (company.id === companyId ? updater(company) : company)))
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

  const handleOpenDetail = (companyId: number, seed?: TaskBoardListItem) => {
    if (seed && !companies.some((item) => item.id === companyId)) {
      setCompanies((prev) => [
        ...prev,
        {
          id: companyId,
          kind: mapCompanyKindToLabel(seed.company_kind),
          name: seed.company_name || `업체 #${companyId}`,
          assignee: seed.assignee_name || '-',
          excluded: seed.is_excluded,
          note: seed.note || '',
          tasks:
            seed.major_tasks?.map((taskName, index) => ({
              id: `seed-${companyId}-${index}`,
              name: taskName,
              status: 'not_started' as WorkStatus,
              attachmentCount: 0,
              completedAt: null,
              note: '',
              delayedDays: 0,
            })) || [],
        },
      ])
    }
    setSelectedCompanyId(companyId)
  }

  const toggleCompanyColumnValue = (companyId: number, columnId: string) => {
    const key = getColumnCheckKey(companyId, columnId)
    setCompanyColumnChecks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleColumnAll = (columnId: string) => {
    const activeCompanies = listRows.filter((company) => !company.is_excluded)
    const allChecked =
      activeCompanies.length > 0 &&
      activeCompanies.every((company) => companyColumnChecks[getColumnCheckKey(company.company_id, columnId)])
    setCompanyColumnChecks((prev) => {
      const next = { ...prev }
      activeCompanies.forEach((company) => {
        next[getColumnCheckKey(company.company_id, columnId)] = !allChecked
      })
      return next
    })
    toast.success(allChecked ? '열 전체 선택을 해제했습니다.' : '열 전체 선택을 적용했습니다.')
  }

  const handleTaskStatus = (taskId: string, status: WorkStatus) => {
    if (!selectedCompany) return
    updateCompany(selectedCompany.id, (prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              completedAt: status === 'done' ? '2026.03.24' : task.completedAt,
            }
          : task
      ),
    }))
  }

  const handleAttach = (taskId: string) => {
    if (!selectedCompany) return
    updateCompany(selectedCompany.id, (prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === 'not_started' ? 'in_progress' : task.status, attachmentCount: task.attachmentCount + 1 }
          : task
      ),
    }))
    toast.success('증빙 첨부(목업) 처리되었습니다.')
  }

  const addTaskToSelectedCompany = () => {
    if (!selectedCompany) return
    const nextName = addTab === 'template' ? templateTaskName : customTaskName.trim()
    if (!nextName) {
      toast.error('업무명을 입력해 주세요.')
      return
    }
    const duplicated = selectedCompany.tasks.some(
      (task) => task.name.replace(/\s+/g, '').toLowerCase() === nextName.replace(/\s+/g, '').toLowerCase()
    )
    if (duplicated) {
      toast.error('동일 텍스트 업무가 이미 존재합니다.')
      return
    }
    updateCompany(selectedCompany.id, (prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        { id: newTaskId(), name: nextName, status: 'not_started', attachmentCount: 0, completedAt: null, note: '', delayedDays: 0 },
      ],
    }))
    setCustomTaskName('')
    setIsAddModalOpen(false)
    toast.success('업무 항목이 추가되었습니다.')
  }

  const applySelectedColumns = () => {
    if (pendingColumnSelection.length === 0) {
      setIsColumnModalOpen(false)
      return
    }
    const selectedCatalogItems = columnCatalog.filter((item) => pendingColumnSelection.includes(item.id))
    const appendColumns = selectedCatalogItems
      .filter((item) => !existingColumnNameSet.has(normalizeText(item.name)))
      .map((item) => ({ id: newColumnId(), name: item.name }))
    if (appendColumns.length === 0) {
      toast.error('이미 추가된 컬럼입니다.')
      return
    }
    setCustomColumns((prev) => [...prev, ...appendColumns])
    setCompanyColumnChecks((prev) => {
      const next = { ...prev }
      appendColumns.forEach((column) => {
        companies.forEach((company) => {
          next[getColumnCheckKey(company.id, column.id)] = false
        })
      })
      return next
    })
    setPendingColumnSelection([])
    setIsColumnModalOpen(false)
    toast.success('업무 컬럼을 반영했습니다.')
  }

  const createCatalogColumn = () => {
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
    const nextCatalogItem: ColumnCatalogItem = { id: `catalog-${Date.now()}`, name: trimmed }
    setColumnCatalog((prev) => [...prev, nextCatalogItem])
    setPendingColumnSelection((prev) => [...prev, nextCatalogItem.id])
    setNewColumnName('')
    setIsCreateColumnModalOpen(false)
    toast.success('컬럼 후보가 추가되었습니다.')
  }

  const renderStatus = (status: WorkStatus, delayedDays: number) => (
    <div className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}>
        {STATUS_LABEL[status]}
      </span>
      {delayedDays > 0 && status !== 'done' && status !== 'excluded' && status !== 'na' ? (
        <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
          D+{delayedDays}
        </span>
      ) : null}
    </div>
  )

  const getProgressBarClass = (percent: number) => {
    if (percent <= 0) return 'bg-zinc-300'
    if (percent >= 100) return 'bg-emerald-600'
    if (percent >= 60) return 'bg-emerald-500'
    return 'bg-emerald-300'
  }

  return (
    <div className="space-y-4">
      {selectedCompany ? (
        <section className="space-y-4 bg-white">
          <header className="border-b border-zinc-200 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800">
                  {selectedCompany.name} · {selectedCompany.kind} · 담당자 {selectedCompany.assignee}
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
                <UiButton size="sm" variant="tabInactive" onClick={() => setSelectedCompanyId(null)}>
                  목록으로
                </UiButton>
              </div>
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </header>

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
                {selectedCompany.tasks.map((task) => (
                  <tr key={task.id} className="border-t border-zinc-200">
                    <td className="px-2 py-2 text-zinc-800">{task.name}</td>
                    <td className="px-2 py-2 text-center">{renderStatus(task.status, task.delayedDays)}</td>
                    <td className="px-2 py-2 text-center">{task.attachmentCount}개</td>
                    <td className="px-2 py-2 text-center text-zinc-600">{task.completedAt || '—'}</td>
                    <td className="px-2 py-2 text-zinc-600">{task.note || '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <UiButton size="xs" variant="secondary" onClick={() => handleAttach(task.id)}>
                          파일첨부
                        </UiButton>
                        <UiButton size="xs" variant="tabInactive" onClick={() => setFileModalTaskId(task.id)}>
                          상세
                        </UiButton>
                        <UiButton size="xs" variant="primary" onClick={() => handleTaskStatus(task.id, 'done')}>
                          완료
                        </UiButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <label className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-700">
                <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
                미완료만
              </label>
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
              <UiButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingColumnSelection([])
                  setIsCreateColumnModalOpen(false)
                  setNewColumnName('')
                  setIsColumnModalOpen(true)
                }}
              >
                업무 추가
              </UiButton>
              <div className="ml-auto w-full max-w-xs">
                <UiSearchInput value={keyword} onChange={setKeyword} placeholder="업체명 검색" wrapperClassName="h-8" inputClassName="text-xs" />
              </div>
            </div>
            <div className="text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th
                    className="px-1 py-1.5 text-center font-semibold"
                    style={{ width: `${noColumnWidth}px`, minWidth: `${noColumnWidth}px` }}
                  >
                    No
                  </th>
                  <th
                    className="px-1 py-1.5 text-center font-semibold"
                    style={{ width: `${kindColumnWidth}px`, minWidth: `${kindColumnWidth}px` }}
                  >
                    구분
                  </th>
                  <th
                    className="px-1 py-1.5 text-center font-semibold"
                    style={{ width: `${nameColumnWidth}px`, minWidth: `${nameColumnWidth}px` }}
                  >
                    상호
                  </th>
                  {customColumns.map((column) => (
                    <th
                      key={column.id}
                      className="px-1 py-2 text-center font-semibold"
                      style={{
                        width: `${workColumnWidthMap[column.id] ?? 72}px`,
                        minWidth: `${workColumnWidthMap[column.id] ?? 72}px`,
                      }}
                    >
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
                        {column.name}
                      </button>
                    </th>
                  ))}
                  <th className="w-28 px-1 py-1.5 text-center font-semibold">진행률</th>
                  <th className="w-20 px-1 py-1.5 text-center font-semibold">미완료수</th>
                  <th className="w-80 px-1 py-1.5 text-left font-semibold">주요업무</th>
                  <th
                    className="px-1 py-1.5 text-left font-semibold whitespace-nowrap"
                    style={{ width: `${noteColumnWidth}px`, minWidth: `${noteColumnWidth}px` }}
                  >
                    비고
                  </th>
                  <th className="w-32 px-1 py-1.5 text-center font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((company, idx) => {
                  const progress = Number(company.progress_percent || 0)
                  const displayKind = mapCompanyKindToLabel(company.company_kind)
                  return (
                    <tr key={company.company_id} className={`border-t border-zinc-200 ${company.is_excluded ? 'bg-rose-50' : ''}`}>
                      <td
                        className="px-1 py-1.5 text-center text-zinc-600"
                        style={{ width: `${noColumnWidth}px`, minWidth: `${noColumnWidth}px` }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className="px-1 py-1.5 text-center"
                        style={{ width: `${kindColumnWidth}px`, minWidth: `${kindColumnWidth}px` }}
                      >
                        {displayKind}
                      </td>
                      <td
                        className="px-1 py-1.5 text-center"
                        style={{ width: `${nameColumnWidth}px`, minWidth: `${nameColumnWidth}px` }}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(company.company_id, company)}
                          className="mx-auto block max-w-full truncate text-center text-zinc-800 hover:text-sky-700 hover:underline"
                          title={company.company_name}
                        >
                          {company.company_name}
                        </button>
                      </td>
                      {customColumns.map((column) => {
                        const checked = companyColumnChecks[getColumnCheckKey(company.company_id, column.id)] || false
                        return (
                          <td
                            key={`${company.company_id}:${column.id}`}
                            className="px-1 py-2 text-center"
                            style={{
                              width: `${workColumnWidthMap[column.id] ?? 72}px`,
                              minWidth: `${workColumnWidthMap[column.id] ?? 72}px`,
                            }}
                          >
                            {company.is_excluded ? (
                              <span className="text-zinc-400">N/A</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleCompanyColumnValue(company.company_id, column.id)}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                  checked
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : 'border-zinc-300 bg-white text-zinc-500'
                                }`}
                                title={checked ? '체크됨' : '체크안됨'}
                              >
                                {checked ? '✓' : ''}
                              </button>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-1 py-1.5 text-center text-zinc-700">
                        {company.is_excluded ? (
                          '—'
                        ) : (
                          <div className="mx-auto w-24">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                              <div
                                className={`h-full rounded-full transition-all ${getProgressBarClass(progress ?? 0)}`}
                                style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-700">{progress ?? 0}%</p>
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1.5 text-center text-zinc-700">{company.is_excluded ? 'N/A' : company.todo_count}</td>
                      <td className="px-1 py-1.5">
                        {company.is_excluded ? (
                          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">N/A</span>
                        ) : company.major_tasks.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {company.major_tasks.map((chip) => (
                              <span key={chip} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                                {chip}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td
                        className="px-1 py-1.5 text-zinc-600"
                        style={{ width: `${noteColumnWidth}px`, minWidth: `${noteColumnWidth}px` }}
                      >
                        <p className="truncate" title={company.note || '—'}>
                          {company.note || '—'}
                        </p>
                      </td>
                      <td className="px-1 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <UiButton size="xs" variant="secondary" onClick={() => handleOpenDetail(company.company_id, company)}>
                            상세
                          </UiButton>
                          <UiButton size="xs" variant={company.is_excluded ? 'soft' : 'tabInactive'} onClick={() => handleToggleExclude(company)}>
                            {company.is_excluded ? '해제' : '제외'}
                          </UiButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!listLoading && listLoaded && listRows.length === 0 ? (
                  <tr>
                    <td colSpan={8 + customColumns.length} className="px-2 py-16 text-center text-zinc-400">
                      조건에 맞는 업체가 없습니다.
                    </td>
                  </tr>
                ) : null}
                {listLoading ? (
                  <tr>
                    <td colSpan={8 + customColumns.length} className="px-2 py-16 text-center text-zinc-400">
                      업무보드 리스트를 불러오는 중입니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isColumnModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800">업무 컬럼 추가</p>
              <UiButton size="xs" variant="tabInactive" onClick={() => setIsColumnModalOpen(false)}>
                닫기
              </UiButton>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {columnCatalog.map((item) => {
                const exists = existingColumnNameSet.has(normalizeText(item.name))
                const checked = pendingColumnSelection.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={exists}
                    onClick={() =>
                      setPendingColumnSelection((prev) =>
                        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                      )
                    }
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      exists
                        ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                        : checked
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <input type="checkbox" readOnly checked={exists || checked} className="h-4 w-4" />
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCreateColumnModalOpen(true)}
                className="flex items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white py-2 text-zinc-600 hover:border-sky-300 hover:text-sky-700"
                title="직접 컬럼 추가"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-sm">
                  +
                </span>
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
              placeholder="업무명을 입력해 주세요."
              className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm text-zinc-700"
            />
            <div className="mt-3 flex justify-end gap-2">
              <UiButton size="sm" variant="tabInactive" onClick={() => setIsCreateColumnModalOpen(false)}>
                취소
              </UiButton>
              <UiButton size="sm" variant="primary" onClick={createCatalogColumn}>
                저장
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
                {TASK_TEMPLATES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
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
              <p className="text-sm font-semibold text-zinc-800">연결 파일 · {fileModalTask.name}</p>
              <UiButton size="xs" variant="tabInactive" onClick={() => setFileModalTaskId(null)}>
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
                  {fileModalItems.map((item) => (
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
                            onClick={() => {
                              if (!window.confirm('원본파일을 삭제하시겠습니까?')) return
                              toast.success('원본삭제(목업)')
                            }}
                          >
                            원본삭제
                          </UiButton>
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </div>
  )
}
