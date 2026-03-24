'use client'

import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Paperclip,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

type BoardView = 'overview' | 'detail'
type BoardTab = 'monthly' | 'yearly'
type CompletionFilter = 'incomplete' | 'all'
type TaskTypeFilter = 'all' | 'tax' | 'insurance' | 'payroll' | 'report'
type WorkStatus = 'pending' | 'drafting' | 'done' | 'sent'

type Company = {
  id: number
  name: string
  kind: '법인' | '개인'
  isLaborFirm: boolean
  filingCycle: '매월' | '반기'
  assignee: string
  taskFlags: {
    labor: boolean
    retirement: boolean
    business: boolean
    etc: boolean
    daily: boolean
    interestDividend: boolean
  }
}

type TaskColumn = {
  code: string
  label: string
  group: TaskTypeFilter
}

type CellState = {
  status: WorkStatus
  completedAt: string | null
  sentAt: string | null
  attachmentCount: number
}

type CellSelection = {
  companyId: number
  yearMonth: string
  taskCode: string
}

const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  pending: '대기',
  drafting: '작성중',
  done: '완료',
  sent: '발송',
}

const WORK_STATUS_CLASS: Record<WorkStatus, string> = {
  pending: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  drafting: 'border-amber-300 bg-amber-50 text-amber-700',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  sent: 'border-sky-300 bg-sky-50 text-sky-700',
}

const FIXED_LEFT_COLUMNS = [
  { key: 'seq', label: '순서', width: 56 },
  { key: 'kind', label: '구분', width: 68 },
  { key: 'laborFirm', label: '노무사여부', width: 96 },
  { key: 'name', label: '상호', width: 180 },
  { key: 'filingCycle', label: '신고주기', width: 86 },
  { key: 'labor', label: '근로', width: 62 },
  { key: 'retirement', label: '퇴직', width: 62 },
  { key: 'business', label: '사업', width: 62 },
  { key: 'etc', label: '기타', width: 62 },
  { key: 'daily', label: '일용', width: 62 },
  { key: 'interestDividend', label: '이자배당', width: 82 },
] as const

const MONTHLY_TASK_COLUMNS: TaskColumn[] = [
  { code: 'payroll_ledger', label: '급여대장 작성', group: 'payroll' },
  { code: 'send_and_confirm', label: '송부 및 확인', group: 'report' },
  { code: 'other_income', label: '타소득 여부', group: 'tax' },
  { code: 'withholding_tax', label: '원천세 신고', group: 'tax' },
  { code: 'tax_bill_notice', label: '납부서 전달', group: 'tax' },
  { code: 'four_insurance', label: '4대보험 신고', group: 'insurance' },
  { code: 'work_confirmation', label: '근로내용확인서 제출', group: 'report' },
  { code: 'daily_report', label: '일용직 지급명세서', group: 'report' },
  { code: 'etc_income_report', label: '기타소득 간이지급명세서', group: 'report' },
  { code: 'business_income_report', label: '사업소득 간이지급명세서', group: 'report' },
  { code: 'memo', label: '비고', group: 'all' },
]

const YEARLY_TASK_COLUMNS: TaskColumn[] = [
  { code: 'year_end_settlement', label: '연말정산 검토', group: 'tax' },
  { code: 'withholding_closure', label: '원천세 연간 정산', group: 'tax' },
  { code: 'insurance_closure', label: '4대보험 연정산', group: 'insurance' },
  { code: 'retirement_report', label: '퇴직소득 지급명세서', group: 'report' },
  { code: 'business_report', label: '사업소득 지급명세서', group: 'report' },
  { code: 'etc_report', label: '기타소득 지급명세서', group: 'report' },
  { code: 'proof_bundle', label: '업무산출물 정리', group: 'payroll' },
  { code: 'mail_dispatch', label: '발송 확인', group: 'report' },
  { code: 'annual_memo', label: '비고', group: 'all' },
]

const MOCK_COMPANIES: Company[] = [
  {
    id: 101,
    name: '가온테크',
    kind: '법인',
    isLaborFirm: true,
    filingCycle: '매월',
    assignee: '김세무',
    taskFlags: { labor: true, retirement: true, business: true, etc: true, daily: true, interestDividend: false },
  },
  {
    id: 102,
    name: '나무파트너스',
    kind: '개인',
    isLaborFirm: false,
    filingCycle: '반기',
    assignee: '박노무',
    taskFlags: { labor: true, retirement: false, business: true, etc: true, daily: false, interestDividend: true },
  },
  {
    id: 103,
    name: '다원유통',
    kind: '법인',
    isLaborFirm: true,
    filingCycle: '매월',
    assignee: '최담당',
    taskFlags: { labor: true, retirement: true, business: true, etc: true, daily: true, interestDividend: true },
  },
  {
    id: 104,
    name: '라임솔루션',
    kind: '법인',
    isLaborFirm: false,
    filingCycle: '매월',
    assignee: '김세무',
    taskFlags: { labor: true, retirement: true, business: false, etc: true, daily: false, interestDividend: false },
  },
  {
    id: 105,
    name: '마루건설',
    kind: '법인',
    isLaborFirm: true,
    filingCycle: '반기',
    assignee: '정회계',
    taskFlags: { labor: true, retirement: true, business: true, etc: false, daily: true, interestDividend: false },
  },
  {
    id: 106,
    name: '바른의원',
    kind: '개인',
    isLaborFirm: false,
    filingCycle: '매월',
    assignee: '박노무',
    taskFlags: { labor: true, retirement: false, business: true, etc: true, daily: false, interestDividend: true },
  },
]

function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [year, month] = yearMonth.split('-').map((value) => Number(value))
  return { year, month }
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const { year, month } = parseYearMonth(yearMonth)
  const date = new Date(year, month - 1 + delta, 1)
  return toYearMonth(date.getFullYear(), date.getMonth() + 1)
}

function buildMonthWindow(centerYearMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    shiftYearMonth(centerYearMonth, -(count - 1) + index)
  )
}

function formatYearMonthLabel(yearMonth: string): string {
  const { year, month } = parseYearMonth(yearMonth)
  return `${year}년 ${month}월`
}

function formatDateLabel(raw: string | null): string {
  if (!raw) return '-'
  return raw
}

function statusSeed(key: string): number {
  return key.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

function isTaskEnabled(company: Company, taskCode: string): boolean {
  if (taskCode.includes('retirement')) return company.taskFlags.retirement
  if (taskCode.includes('business')) return company.taskFlags.business
  if (taskCode.includes('etc')) return company.taskFlags.etc
  if (taskCode.includes('daily')) return company.taskFlags.daily
  if (taskCode.includes('interest')) return company.taskFlags.interestDividend
  return true
}

function cellKey(companyId: number, yearMonth: string, taskCode: string): string {
  return `${companyId}:${yearMonth}:${taskCode}`
}

function generateInitialState(): Record<string, CellState> {
  const yearMonths = buildMonthWindow('2026-03', 12)
  const allTasks = [...MONTHLY_TASK_COLUMNS, ...YEARLY_TASK_COLUMNS]
  const map: Record<string, CellState> = {}

  for (const company of MOCK_COMPANIES) {
    for (const ym of yearMonths) {
      for (const task of allTasks) {
        const key = cellKey(company.id, ym, task.code)
        const seed = statusSeed(key)
        const statusPool: WorkStatus[] = ['pending', 'drafting', 'done', 'sent']
        const status = statusPool[seed % statusPool.length]
        const completedAt = status === 'done' || status === 'sent' ? `${ym.replace('-', '.')} ${String((seed % 27) + 1).padStart(2, '0')}` : null
        const sentAt = status === 'sent' ? `${ym.replace('-', '.')} ${String((seed % 27) + 1).padStart(2, '0')}` : null
        map[key] = {
          status,
          completedAt,
          sentAt,
          attachmentCount: seed % 3,
        }
      }
    }
  }

  return map
}

function nowStamp(): string {
  return new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '')
}

function isValidYearMonth(value: string): boolean {
  const matched = /^(\d{4})-(0[1-9]|1[0-2])$/.test(value)
  if (!matched) return false
  const { year } = parseYearMonth(value)
  return year >= 2000 && year <= 2100
}

export default function WorkflowBoardPage() {
  const [currentYearMonth, setCurrentYearMonth] = useState<string>('2026-03')
  const [activeTab, setActiveTab] = useState<BoardTab>('monthly')
  const [activeView, setActiveView] = useState<BoardView>('overview')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('incomplete')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>('all')
  const [isYearMonthPickerOpen, setIsYearMonthPickerOpen] = useState(false)
  const [yearMonthInput, setYearMonthInput] = useState<string>('2026-03')
  const [companyKeyword, setCompanyKeyword] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(MOCK_COMPANIES[0]?.id ?? 0)
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null)
  const [detailCenterYearMonth, setDetailCenterYearMonth] = useState<string>('2026-03')
  const [cellStates, setCellStates] = useState<Record<string, CellState>>(() => generateInitialState())

  const taskColumns = activeTab === 'monthly' ? MONTHLY_TASK_COLUMNS : YEARLY_TASK_COLUMNS
  const filteredTaskColumns = taskColumns.filter((column) => taskTypeFilter === 'all' || column.group === 'all' || column.group === taskTypeFilter)
  const assigneeOptions = useMemo(() => ['all', ...Array.from(new Set(MOCK_COMPANIES.map((company) => company.assignee)))], [])
  const currentYearMonthShortLabel = useMemo(() => {
    const { year, month } = parseYearMonth(currentYearMonth)
    return `${String(year).slice(2)}년 ${month}월`
  }, [currentYearMonth])

  const sortedCompanies = useMemo(
    () => [...MOCK_COMPANIES].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    []
  )

  const visibleCompanies = useMemo(() => {
    const keyword = companyKeyword.trim()
    return sortedCompanies.filter((company) => {
      if (keyword && !company.name.includes(keyword)) return false
      if (assigneeFilter !== 'all' && company.assignee !== assigneeFilter) return false

      if (completionFilter === 'all') return true
      return filteredTaskColumns.some((task) => {
        if (!isTaskEnabled(company, task.code)) return false
        const state = cellStates[cellKey(company.id, currentYearMonth, task.code)]
        return state && (state.status === 'pending' || state.status === 'drafting')
      })
    })
  }, [assigneeFilter, cellStates, companyKeyword, completionFilter, currentYearMonth, filteredTaskColumns, sortedCompanies])

  const selectedCompany = visibleCompanies.find((company) => company.id === selectedCompanyId)
    ?? sortedCompanies.find((company) => company.id === selectedCompanyId)
    ?? null

  const detailMonths = useMemo(() => buildMonthWindow(detailCenterYearMonth, 6), [detailCenterYearMonth])
  const fixedLeftOffsets = useMemo(() => {
    let accum = 0
    return FIXED_LEFT_COLUMNS.map((column) => {
      const left = accum
      accum += column.width
      return left
    })
  }, [])

  const selectedCellState = useMemo(() => {
    if (!selectedCell) return null
    return cellStates[cellKey(selectedCell.companyId, selectedCell.yearMonth, selectedCell.taskCode)] ?? null
  }, [cellStates, selectedCell])

  const selectedCellTaskLabel = useMemo(() => {
    if (!selectedCell) return '-'
    const all = [...MONTHLY_TASK_COLUMNS, ...YEARLY_TASK_COLUMNS]
    return all.find((task) => task.code === selectedCell.taskCode)?.label ?? selectedCell.taskCode
  }, [selectedCell])

  const selectedCellCompany = useMemo(() => {
    if (!selectedCell) return null
    return sortedCompanies.find((company) => company.id === selectedCell.companyId) ?? null
  }, [selectedCell, sortedCompanies])

  const updateCellState = (companyId: number, yearMonth: string, taskCode: string, updater: (prev: CellState) => CellState) => {
    const key = cellKey(companyId, yearMonth, taskCode)
    setCellStates((prev) => {
      const base = prev[key] ?? { status: 'pending', completedAt: null, sentAt: null, attachmentCount: 0 }
      return { ...prev, [key]: updater(base) }
    })
  }

  const openCellPanel = (companyId: number, yearMonth: string, taskCode: string) => {
    setSelectedCell({ companyId, yearMonth, taskCode })
  }

  const handleAttachmentRegister = () => {
    if (!selectedCell) return
    updateCellState(selectedCell.companyId, selectedCell.yearMonth, selectedCell.taskCode, (prev) => ({
      ...prev,
      status: prev.status === 'pending' ? 'drafting' : prev.status,
      attachmentCount: prev.attachmentCount + 1,
    }))
    toast.success('업무산출물(전용) 등록 상태로 반영했습니다.')
  }

  const handleDone = () => {
    if (!selectedCell) return
    updateCellState(selectedCell.companyId, selectedCell.yearMonth, selectedCell.taskCode, (prev) => ({
      ...prev,
      status: 'done',
      completedAt: nowStamp(),
    }))
    toast.success('완료 처리되었습니다.')
  }

  const handleSent = () => {
    if (!selectedCell) return
    updateCellState(selectedCell.companyId, selectedCell.yearMonth, selectedCell.taskCode, (prev) => ({
      ...prev,
      status: 'sent',
      completedAt: prev.completedAt ?? nowStamp(),
      sentAt: nowStamp(),
    }))
    toast.success('메일 발송 처리되었습니다.')
  }

  const handleQuickSend = (companyId: number, yearMonth: string, taskCode: string) => {
    updateCellState(companyId, yearMonth, taskCode, (prev) => ({
      ...prev,
      status: 'sent',
      completedAt: prev.completedAt ?? nowStamp(),
      sentAt: nowStamp(),
    }))
    toast.success('셀에서 바로 발송 처리했습니다.')
  }

  const moveCurrentMonth = (delta: number) => {
    setCurrentYearMonth((prev) => {
      const next = shiftYearMonth(prev, delta)
      setYearMonthInput(next)
      return next
    })
  }

  const applyYearMonthInput = () => {
    const normalized = yearMonthInput.trim()
    if (!isValidYearMonth(normalized)) {
      toast.error('년월 형식은 YYYY-MM 입니다.')
      return
    }
    setCurrentYearMonth(normalized)
    setIsYearMonthPickerOpen(false)
  }

  const renderStateCard = (company: Company, yearMonth: string, task: TaskColumn) => {
    if (!isTaskEnabled(company, task.code)) {
      return (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left text-[11px] text-zinc-400"
        >
          해당 없음
        </button>
      )
    }

    const state = cellStates[cellKey(company.id, yearMonth, task.code)] ?? {
      status: 'pending',
      completedAt: null,
      sentAt: null,
      attachmentCount: 0,
    }
    const dummyEvidenceUrl = `https://example.com/work-output/${company.id}/${yearMonth}/${task.code}`

    return (
      <button
        type="button"
        onClick={() => openCellPanel(company.id, yearMonth, task.code)}
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
        title="작업 열기"
      >
        <div className="flex items-center justify-between gap-1">
          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${WORK_STATUS_CLASS[state.status]}`}>
            {WORK_STATUS_LABEL[state.status]}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" />
              {state.attachmentCount}
            </span>
          </span>
        </div>
        <div className="mt-1 space-y-0.5 text-[10px] text-zinc-500">
          <p>완료: {formatDateLabel(state.completedAt)}</p>
          <p>발송: {formatDateLabel(state.sentAt)}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-zinc-500">
          <a
            href={dummyEvidenceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white transition hover:border-sky-300 hover:text-sky-600"
            title="파일보기(새창)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleQuickSend(company.id, yearMonth, task.code)
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white transition hover:border-sky-300 hover:text-sky-600"
            title="메일발송"
          >
            <Mail className="h-3.5 w-3.5" />
          </button>
        </div>
      </button>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center gap-1">
            <UiButton size="iconSm" variant="secondary" onClick={() => moveCurrentMonth(-1)} aria-label="이전 월">
              <ChevronLeft className="h-4 w-4" />
            </UiButton>
            <button
              type="button"
              onClick={() => {
                setYearMonthInput(currentYearMonth)
                setIsYearMonthPickerOpen((prev) => !prev)
              }}
              className="inline-flex h-8 min-w-[104px] items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {currentYearMonthShortLabel}
            </button>
            <UiButton size="iconSm" variant="secondary" onClick={() => moveCurrentMonth(1)} aria-label="다음 월">
              <ChevronRight className="h-4 w-4" />
            </UiButton>
            {isYearMonthPickerOpen ? (
              <div className="absolute left-0 top-10 z-20 w-[240px] rounded-md border border-zinc-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-zinc-600">년월 선택</p>
                <input
                  type="month"
                  value={isValidYearMonth(yearMonthInput) ? yearMonthInput : currentYearMonth}
                  onChange={(event) => {
                    const value = event.target.value
                    setYearMonthInput(value)
                    if (isValidYearMonth(value)) {
                      setCurrentYearMonth(value)
                    }
                  }}
                  className="h-8 w-full rounded-md border border-zinc-300 px-2 text-sm text-zinc-700"
                />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={yearMonthInput}
                    onChange={(event) => setYearMonthInput(event.target.value)}
                    placeholder="YYYY-MM"
                    className="h-8 flex-1 rounded-md border border-zinc-300 px-2 text-sm text-zinc-700 placeholder:text-zinc-400"
                  />
                  <UiButton size="sm" variant="primary" onClick={applyYearMonthInput}>적용</UiButton>
                </div>
              </div>
            ) : null}
          </div>
          <select
            value={completionFilter}
            onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
          >
            <option value="incomplete">미완료</option>
            <option value="all">전체</option>
          </select>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
          >
            <option value="all">담당자 전체</option>
            {assigneeOptions.filter((option) => option !== 'all').map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select
            value={taskTypeFilter}
            onChange={(event) => setTaskTypeFilter(event.target.value as TaskTypeFilter)}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
          >
            <option value="all">업무유형 전체</option>
            <option value="tax">세무</option>
            <option value="insurance">4대보험</option>
            <option value="payroll">급여/산출물</option>
            <option value="report">신고/발송</option>
          </select>
          <div className="ml-auto w-full min-w-[220px] max-w-[320px]">
            <UiSearchInput
              value={companyKeyword}
              onChange={setCompanyKeyword}
              placeholder="업체 검색"
              wrapperClassName="h-8"
              inputClassName="text-xs"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2">
          <UiButton
            variant={activeTab === 'monthly' ? 'tabActive' : 'tabInactive'}
            size="sm"
            onClick={() => setActiveTab('monthly')}
          >
            월별 업무
          </UiButton>
          <UiButton
            variant={activeTab === 'yearly' ? 'tabActive' : 'tabInactive'}
            size="sm"
            onClick={() => setActiveTab('yearly')}
          >
            연간 업무
          </UiButton>
          <span className="mx-1 h-4 w-px bg-zinc-200" />
          <UiButton
            variant={activeView === 'overview' ? 'tabActive' : 'tabInactive'}
            size="sm"
            onClick={() => setActiveView('overview')}
          >
            전체 운영뷰
          </UiButton>
          <UiButton
            variant={activeView === 'detail' ? 'tabActive' : 'tabInactive'}
            size="sm"
            onClick={() => setActiveView('detail')}
            disabled={!selectedCompany}
          >
            업체 상세뷰
          </UiButton>
        </div>

        <div className={`grid min-h-[620px] ${activeView === 'overview' ? 'grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-[220px_minmax(0,1fr)_320px]'}`}>
          {activeView === 'detail' ? (
            <aside className="border-r border-zinc-200 p-3">
              <p className="mb-2 text-xs font-semibold text-zinc-500">업체 목록</p>
              <div className="space-y-1 overflow-y-auto pr-1">
                {visibleCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      setSelectedCompanyId(company.id)
                      setActiveView('detail')
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm transition ${
                      selectedCompanyId === company.id
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    <span className="truncate">{company.name}</span>
                    <span className="ml-2 text-[11px] text-zinc-500">{company.assignee}</span>
                  </button>
                ))}
                {visibleCompanies.length === 0 ? (
                  <p className="rounded-md border border-dashed border-zinc-300 px-3 py-8 text-center text-xs text-zinc-400">
                    검색 조건에 맞는 업체가 없습니다.
                  </p>
                ) : null}
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 border-r border-zinc-200">
            {activeView === 'overview' ? (
              <div className="h-full overflow-auto">
                <table className="min-w-max border-collapse text-xs">
                  <thead className="sticky top-0 z-20 bg-zinc-50">
                    <tr>
                      {FIXED_LEFT_COLUMNS.map((column, index) => (
                        <th
                          key={column.key}
                          style={{ width: column.width, minWidth: column.width, left: fixedLeftOffsets[index] }}
                          className="sticky top-0 z-30 border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-center font-semibold text-zinc-600"
                        >
                          {column.label}
                        </th>
                      ))}
                      {filteredTaskColumns.map((column) => (
                        <th
                          key={column.code}
                          className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-center font-semibold text-zinc-600"
                          style={{ width: 180, minWidth: 180 }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompanies.map((company, rowIndex) => (
                      <tr key={company.id} className="odd:bg-white even:bg-zinc-50/40">
                        <td
                          style={{ left: fixedLeftOffsets[0], width: FIXED_LEFT_COLUMNS[0].width }}
                          className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center"
                        >
                          {rowIndex + 1}
                        </td>
                        <td
                          style={{ left: fixedLeftOffsets[1], width: FIXED_LEFT_COLUMNS[1].width }}
                          className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center"
                        >
                          {company.kind}
                        </td>
                        <td
                          style={{ left: fixedLeftOffsets[2], width: FIXED_LEFT_COLUMNS[2].width }}
                          className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center"
                        >
                          {company.isLaborFirm ? 'Y' : 'N'}
                        </td>
                        <td
                          style={{ left: fixedLeftOffsets[3], width: FIXED_LEFT_COLUMNS[3].width }}
                          className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-left"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCompanyId(company.id)
                              setActiveView('detail')
                            }}
                            className="truncate text-sky-700 hover:underline"
                          >
                            {company.name}
                          </button>
                        </td>
                        <td
                          style={{ left: fixedLeftOffsets[4], width: FIXED_LEFT_COLUMNS[4].width }}
                          className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center"
                        >
                          {company.filingCycle}
                        </td>
                        <td style={{ left: fixedLeftOffsets[5], width: FIXED_LEFT_COLUMNS[5].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.labor ? 'Y' : '-'}</td>
                        <td style={{ left: fixedLeftOffsets[6], width: FIXED_LEFT_COLUMNS[6].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.retirement ? 'Y' : '-'}</td>
                        <td style={{ left: fixedLeftOffsets[7], width: FIXED_LEFT_COLUMNS[7].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.business ? 'Y' : '-'}</td>
                        <td style={{ left: fixedLeftOffsets[8], width: FIXED_LEFT_COLUMNS[8].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.etc ? 'Y' : '-'}</td>
                        <td style={{ left: fixedLeftOffsets[9], width: FIXED_LEFT_COLUMNS[9].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.daily ? 'Y' : '-'}</td>
                        <td style={{ left: fixedLeftOffsets[10], width: FIXED_LEFT_COLUMNS[10].width }} className="sticky z-10 border-b border-r border-zinc-200 bg-inherit px-2 py-2 text-center">{company.taskFlags.interestDividend ? 'Y' : '-'}</td>
                        {filteredTaskColumns.map((task) => (
                          <td key={`${company.id}:${task.code}`} className="border-b border-r border-zinc-200 px-1.5 py-1.5 align-top">
                            {renderStateCard(company, currentYearMonth, task)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full p-3">
                {selectedCompany ? (
                  <div className="flex h-full flex-col">
                    <div className="mb-3 flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{selectedCompany.name} 월 히스토리</p>
                        <p className="text-xs text-zinc-500">업체 상세뷰 · {activeTab === 'monthly' ? '월별 업무' : '연간 업무'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <UiButton size="iconSm" variant="secondary" onClick={() => setDetailCenterYearMonth((prev) => shiftYearMonth(prev, -1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </UiButton>
                        <span className="w-24 text-center text-sm font-semibold text-zinc-700">
                          {formatYearMonthLabel(detailCenterYearMonth)}
                        </span>
                        <UiButton size="iconSm" variant="secondary" onClick={() => setDetailCenterYearMonth((prev) => shiftYearMonth(prev, 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </UiButton>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-zinc-50">
                          <tr>
                            <th className="w-24 border-b border-r border-zinc-200 px-2 py-2 text-center font-semibold text-zinc-600">대상월</th>
                            {filteredTaskColumns.map((task) => (
                              <th key={task.code} className="border-b border-r border-zinc-200 px-2 py-2 text-center font-semibold text-zinc-600">
                                {task.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detailMonths.map((yearMonth) => (
                            <tr key={yearMonth} className="odd:bg-white even:bg-zinc-50/40">
                              <td className="border-b border-r border-zinc-200 px-2 py-2 text-center font-medium text-zinc-700">
                                {formatYearMonthLabel(yearMonth)}
                              </td>
                              {filteredTaskColumns.map((task) => (
                                <td key={`${yearMonth}:${task.code}`} className="border-b border-r border-zinc-200 px-1.5 py-1.5 align-top">
                                  {renderStateCard(selectedCompany, yearMonth, task)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-300 text-sm text-zinc-400">
                    좌측에서 업체를 선택해 주세요.
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="p-3">
            <p className="mb-2 text-xs font-semibold text-zinc-500">선택 셀 상세 액션</p>
            {selectedCell && selectedCellState && selectedCellCompany ? (
              <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-800">{selectedCellCompany.name}</p>
                  <p className="text-xs text-zinc-500">{selectedCellTaskLabel} · {formatYearMonthLabel(selectedCell.yearMonth)}</p>
                </div>
                <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">현재 상태</span>
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${WORK_STATUS_CLASS[selectedCellState.status]}`}>
                      {WORK_STATUS_LABEL[selectedCellState.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">완료일</span>
                    <span className="font-medium text-zinc-700">{formatDateLabel(selectedCellState.completedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">발송일</span>
                    <span className="font-medium text-zinc-700">{formatDateLabel(selectedCellState.sentAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">증빙파일 수</span>
                    <span className="font-medium text-zinc-700">{selectedCellState.attachmentCount}건</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <UiButton className="w-full justify-center" size="sm" variant="secondary" onClick={handleAttachmentRegister}>
                    증빙파일 등록
                  </UiButton>
                  <UiButton className="w-full justify-center" size="sm" variant="primary" onClick={handleDone}>
                    완료 처리
                  </UiButton>
                  <UiButton className="w-full justify-center" size="sm" variant="soft" onClick={handleSent}>
                    메일 발송
                  </UiButton>
                  <UiButton
                    className="w-full justify-center"
                    size="sm"
                    variant="tabInactive"
                    onClick={() => setSelectedCell(null)}
                  >
                    닫기
                  </UiButton>
                </div>
                <div className="rounded-md border border-sky-100 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-700">
                  업무산출물(전용) 중심으로 처리하고, 문서함 연동(보조)은 후속 단계에서 연결합니다.
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-zinc-300 px-3 py-10 text-center text-sm text-zinc-400">
                셀을 선택하면 작업 패널이 열립니다.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
