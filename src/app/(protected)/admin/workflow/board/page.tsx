'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Mail, Paperclip, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

type CompanyKind = '법인' | '개인'
type WorkStatus = 'not_started' | 'in_progress' | 'done' | 'excluded' | 'na'
type AddTab = 'template' | 'custom'

type TaskItem = {
  id: string
  name: string
  status: WorkStatus
  attachmentCount: number
  completedAt: string | null
  note: string
  delayedDays: number
}

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

export default function WorkflowBoardPage() {
  const [attributionMonth, setAttributionMonth] = useState('2026-02')
  const [reportMonth, setReportMonth] = useState('2026-03')
  const [incompleteOnly, setIncompleteOnly] = useState(true)
  const [kindFilter, setKindFilter] = useState<'all' | CompanyKind>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [companies, setCompanies] = useState<CompanyBoard[]>(() => seedCompanies())
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTab, setAddTab] = useState<AddTab>('template')
  const [templateTaskName, setTemplateTaskName] = useState(TASK_TEMPLATES[0])
  const [customTaskName, setCustomTaskName] = useState('')
  const [fileModalTaskId, setFileModalTaskId] = useState<string | null>(null)

  const assignees = useMemo(
    () => ['all', ...Array.from(new Set(companies.map((item) => item.assignee)))],
    [companies]
  )

  const selectedCompany = useMemo(
    () => companies.find((item) => item.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  )

  const listRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return companies.filter((company) => {
      if (q && !company.name.toLowerCase().includes(q)) return false
      if (kindFilter !== 'all' && company.kind !== kindFilter) return false
      if (assigneeFilter !== 'all' && company.assignee !== assigneeFilter) return false
      if (!incompleteOnly) return true
      return company.tasks.some((task) => task.status === 'not_started' || task.status === 'in_progress')
    })
  }, [assigneeFilter, companies, incompleteOnly, keyword, kindFilter])

  const fileModalTask = useMemo(() => {
    if (!selectedCompany || !fileModalTaskId) return null
    return selectedCompany.tasks.find((task) => task.id === fileModalTaskId) ?? null
  }, [fileModalTaskId, selectedCompany])

  const fileModalItems = useMemo(() => {
    if (!selectedCompany || !fileModalTask) return []
    return seedFiles(selectedCompany.id, fileModalTask.id)
  }, [fileModalTask, selectedCompany])

  const statsByCompany = useMemo(() => {
    const map = new Map<number, { done: number; total: number; incomplete: number; chips: string[] }>()
    companies.forEach((company) => {
      const activeTasks = company.tasks.filter((task) => task.status !== 'na' && task.status !== 'excluded')
      const done = activeTasks.filter((task) => task.status === 'done').length
      const incompleteTasks = activeTasks.filter((task) => task.status === 'not_started' || task.status === 'in_progress')
      map.set(company.id, {
        done,
        total: activeTasks.length,
        incomplete: incompleteTasks.length,
        chips: incompleteTasks.slice(0, 3).map((task) => task.name),
      })
    })
    return map
  }, [companies])

  const updateCompany = (companyId: number, updater: (prev: CompanyBoard) => CompanyBoard) => {
    setCompanies((prev) => prev.map((company) => (company.id === companyId ? updater(company) : company)))
  }

  const handleToggleExclude = (companyId: number) => {
    updateCompany(companyId, (prev) => ({ ...prev, excluded: !prev.excluded }))
    toast.success('대상 제외 상태를 변경했습니다.')
  }

  const handleOpenDetail = (companyId: number) => {
    setSelectedCompanyId(companyId)
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

  return (
    <div className="space-y-4">
      {selectedCompany ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <header className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
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

          <div className="overflow-x-auto rounded-lg border border-zinc-200">
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
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
          <header className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1">
                <UiButton size="iconXs" variant="ghost" onClick={() => setAttributionMonth((prev) => monthShift(prev, -1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </UiButton>
                <span className="text-xs font-semibold text-zinc-700">귀속월 {attributionMonth}</span>
                <UiButton size="iconXs" variant="ghost" onClick={() => setAttributionMonth((prev) => monthShift(prev, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </UiButton>
              </div>
              <div className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1">
                <UiButton size="iconXs" variant="ghost" onClick={() => setReportMonth((prev) => monthShift(prev, -1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </UiButton>
                <span className="text-xs font-semibold text-zinc-700">신고월 {reportMonth}</span>
                <UiButton size="iconXs" variant="ghost" onClick={() => setReportMonth((prev) => monthShift(prev, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </UiButton>
              </div>
              <label className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-700">
                <input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} />
                미완료만
              </label>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
              >
                {assignees.map((item) => (
                  <option key={item} value={item}>
                    {item === 'all' ? '담당자 전체' : item}
                  </option>
                ))}
              </select>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as 'all' | CompanyKind)}
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
              >
                <option value="all">구분 전체</option>
                <option value="법인">법인</option>
                <option value="개인">개인</option>
              </select>
              <div className="ml-auto w-full max-w-xs">
                <UiSearchInput value={keyword} onChange={setKeyword} placeholder="업체명 검색" wrapperClassName="h-8" inputClassName="text-xs" />
              </div>
            </div>
            <div className="text-xs text-zinc-600">
              <p>메인 화면은 전체 현황, 상세 화면은 해당 업무만 노출됩니다.</p>
              <p>완료는 증빙 첨부 후 처리 권장</p>
            </div>
          </header>

          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-xs">
              <thead className="bg-zinc-100 text-zinc-700">
                <tr>
                  <th className="w-12 px-2 py-2 text-center font-semibold">No</th>
                  <th className="w-16 px-2 py-2 text-center font-semibold">구분</th>
                  <th className="px-2 py-2 text-left font-semibold">상호</th>
                  <th className="w-28 px-2 py-2 text-center font-semibold">진행률</th>
                  <th className="w-20 px-2 py-2 text-center font-semibold">미완료수</th>
                  <th className="w-80 px-2 py-2 text-left font-semibold">주요업무</th>
                  <th className="px-2 py-2 text-left font-semibold">비고</th>
                  <th className="w-44 px-2 py-2 text-center font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((company, idx) => {
                  const stat = statsByCompany.get(company.id) || { done: 0, total: 0, incomplete: 0, chips: [] }
                  const progress = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : null
                  return (
                    <tr key={company.id} className="border-t border-zinc-200">
                      <td className="px-2 py-2 text-center text-zinc-600">{idx + 1}</td>
                      <td className="px-2 py-2 text-center">{company.kind}</td>
                      <td className="px-2 py-2 text-zinc-800">{company.name}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{company.excluded ? '—' : `${progress ?? 0}%`}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{company.excluded ? 'N/A' : stat.incomplete}</td>
                      <td className="px-2 py-2">
                        {company.excluded ? (
                          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">N/A</span>
                        ) : stat.chips.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {stat.chips.map((chip) => (
                              <span key={chip} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
                                {chip}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-zinc-600">{company.note || '—'}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <UiButton size="xs" variant="secondary" onClick={() => handleOpenDetail(company.id)}>
                            상세
                          </UiButton>
                          <UiButton size="xs" variant={company.excluded ? 'soft' : 'tabInactive'} onClick={() => handleToggleExclude(company.id)}>
                            {company.excluded ? '제외 해제' : '대상 제외'}
                          </UiButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {listRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-16 text-center text-zinc-400">
                      조건에 맞는 업체가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

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

