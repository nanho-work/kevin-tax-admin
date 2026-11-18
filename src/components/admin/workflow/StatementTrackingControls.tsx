import { useEffect, useState } from 'react'
import type { StatementTrackingChange, TaskBoardStatement, TaskItemStatus } from '@/services/workflowTaskBoard'

interface Props {
  statement: TaskBoardStatement
  label: string
  pendingLabel: string
  disabled: boolean
  onSave: (change: StatementTrackingChange) => Promise<boolean>
}

const kstDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
})

const statusColors = {
  not_started: 'border-rose-200 bg-rose-50 text-rose-800',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  na: 'border-zinc-200 bg-zinc-50 text-zinc-600',
}

export default function StatementTrackingControls({ statement, label, pendingLabel, disabled, onSave }: Props) {
  const savedStatus = statement.work_status ?? (statement.status === 'submitted' ? 'done' : 'not_started')
  const savedDate = statement.processed_on ?? ''
  const [date, setDate] = useState(savedDate)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDate(savedDate), [savedDate])

  async function save(change: StatementTrackingChange) {
    setSaving(true)
    try {
      if (!await onSave(change)) setDate(savedDate)
    } finally {
      setSaving(false)
    }
  }

  function changeStatus(next: TaskItemStatus) {
    if (next === savedStatus) return
    void save(next === 'done'
      ? { status: next, processed_on: date || kstDate.format(new Date()) }
      : { status: next })
  }

  function saveDate(input: HTMLInputElement) {
    if (disabled || saving || !input.validity.valid) return
    if (date !== savedDate && (date || savedStatus !== 'done')) {
      void save({ processed_on: date || null })
    } else if (savedStatus === 'done' && !date) {
      setDate(savedDate)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1" aria-busy={saving}>
      <select
        aria-label={`${label} 상태`}
        className={`h-7 rounded border px-1 text-[11px] font-medium ${statusColors[savedStatus]}`}
        disabled={disabled || saving}
        value={savedStatus}
        onChange={event => changeStatus(event.target.value as TaskItemStatus)}
      >
        <option value="not_started">{pendingLabel}</option>
        <option value="in_progress">진행중</option>
        <option value="done">완료</option>
        <option value="na">해당없음</option>
      </select>
      <input
        aria-label={`${label} 실제 처리일`}
        type="date"
        className="h-7 rounded border border-zinc-200 px-1 text-[11px] text-zinc-700"
        disabled={disabled || saving}
        value={date}
        onChange={event => setDate(event.target.value)}
        onBlur={event => saveDate(event.currentTarget)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
      {savedStatus === 'done' && !date && <span className="text-amber-800">처리일 입력 필요</span>}
    </div>
  )
}
