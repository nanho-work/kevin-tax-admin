'use client'

import { useEffect, useState } from 'react'
import { listTaskBoards, type TaskBoardListItem, type TaskBoardScope } from '@/services/workflowTaskBoard'
import { getMonthlyWorkPeriod, summarizeMonthlyWork } from '@/utils/monthlyWorkProgress'

export default function MonthlyWorkProgressWidget({ scope }: { scope: TaskBoardScope }) {
  const period = getMonthlyWorkPeriod()
  const [rows, setRows] = useState<TaskBoardListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    async function load() {
      const all: TaskBoardListItem[] = []
      for (let page = 1; ; page++) {
        const result = await listTaskBoards(scope, { attribution_month: period.attribution, report_month: period.report,
          include_excluded: false, page, size: 100, sort_by: 'todo_count', order: 'desc' })
        all.push(...result.items)
        if (all.length >= result.total) break
        if (!result.items.length) throw new Error('Incomplete pagination')
      }
      if (!cancelled) setRows(all)
    }
    void load().catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, period.attribution, period.report, revision])
  const summary = summarizeMonthlyWork(rows)
  const boardUrl = (name?: string) => `/${scope}/workflow/board?attribution_month=${period.attribution}${name ? `&q=${encodeURIComponent(name)}` : ''}`
  return <div className="flex h-full min-h-0 flex-col text-sm">
    <div className="flex items-center justify-between gap-2">
      <h2 data-widget-title title="끌어서 위젯 이동" className="cursor-grab touch-none select-none font-semibold text-slate-800">이번 달 업무 진행</h2>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="shrink-0 text-xs text-slate-500 disabled:opacity-50">새로고침</button>
    </div>
    <p className="mt-1 text-xs text-slate-500">신고월 {period.report} · 귀속월 {period.attribution}</p>
    {loading ? <p role="status" className="py-6 text-xs text-slate-500">업무 현황을 불러오는 중…</p>
      : error ? <p role="alert" className="py-6 text-xs text-red-600">업무 현황을 불러오지 못했습니다. 권한 또는 연결을 확인하고 새로고침해 주세요.</p>
      : <>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong className="text-xl text-slate-900">{summary.percent === null ? '집계 대상 없음' : `${summary.percent}%`}</strong>
          <span className="text-xs text-slate-600">완료 {summary.done} · 미완료 {summary.todo}건</span>
        </div>
        {summary.percent !== null && <progress aria-label="이번 달 업무 완료율" value={summary.done} max={summary.done + summary.todo} className="mt-2 h-1.5 w-full accent-sky-600" />}
        <p className="mt-2 text-xs text-slate-500">미완료 거래처 {summary.pending.length}곳 · 업무 미등록 {summary.unregistered}곳{summary.na > 0 ? ` · 해당없음 ${summary.na}건` : ''}</p>
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          {summary.pending.map(row => <a key={row.company_id} href={boardUrl(row.company_name)} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 hover:bg-slate-50">
            <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-800">{row.company_name}</p><p className="text-[11px] text-slate-500">{row.assignee_name || '담당자 미지정'}</p></div>
            <span className="shrink-0 text-xs text-sky-700">미완료 {row.todo_count}건</span>
          </a>)}
          {!summary.pending.length && <p className="py-3 text-xs text-slate-500">{summary.done > 0 ? '등록된 처리 대상 업무가 모두 완료되었습니다.' : '등록된 미완료 업무가 없습니다.'}</p>}
        </div>
        <a href={boardUrl()} className="mt-2 shrink-0 text-right text-xs text-sky-700">업무보드 보기 →</a>
      </>}
  </div>
}
