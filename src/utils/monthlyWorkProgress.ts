import type { TaskBoardListItem } from '@/services/workflowTaskBoard'

export function getMonthlyWorkPeriod(date = new Date()) {
  const report = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(date)
  const [year, month] = report.split('-').map(Number)
  const attribution = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
  return { report, attribution }
}

export function summarizeMonthlyWork(rows: TaskBoardListItem[]) {
  const eligible = rows.filter(row => !row.is_excluded)
  const done = eligible.reduce((sum, row) => sum + row.done_count, 0)
  const todo = eligible.reduce((sum, row) => sum + row.todo_count, 0)
  return {
    done, todo, percent: done + todo ? Math.round(done / (done + todo) * 100) : null,
    na: eligible.reduce((sum, row) => sum + Math.max(0, row.total_count - row.done_count - row.todo_count), 0),
    unregistered: eligible.filter(row => !row.board_id || row.total_count === 0).length,
    pending: eligible.filter(row => row.todo_count > 0).sort((a, b) => b.todo_count - a.todo_count || a.company_name.localeCompare(b.company_name, 'ko')),
  }
}
