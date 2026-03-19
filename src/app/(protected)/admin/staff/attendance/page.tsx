'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AdminLeaveRequestPanel from '@/components/admin/staff/AdminLeaveRequestPanel'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { getAttendanceLogs } from '@/services/admin/attendanceLogService'
import { fetchAnnualLeaves } from '@/services/admin/annualLeaveService'
import { fetchMyAnnualLeaveRequests } from '@/services/admin/annualLeaveRequestService'
import type { AttendanceLog } from '@/types/attendanceLog'
import type { AnnualLeaveRequest } from '@/types/annualLeaveRequest'

const weekLabels = ['일', '월', '화', '수', '목', '금', '토']
const cardClass = 'rounded-xl border border-neutral-200 bg-white'

function toMonthValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthValue(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function getMonthLabel(value: string) {
  const date = parseMonthValue(value)
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`
}

function getMonthBounds(value: string) {
  const date = parseMonthValue(value)
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  return {
    start,
    end,
    startText: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    endText: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  }
}

function shiftMonth(value: string, diff: number) {
  const date = parseMonthValue(value)
  return toMonthValue(new Date(date.getFullYear(), date.getMonth() + diff, 1))
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekLabels[date.getDay()]})`
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const rawTime = value.split('T')[1]?.slice(0, 8)
    if (!rawTime) return value
    const [hour = '00', minute = '00', second = '00'] = rawTime.split(':')
    return `${hour}시 ${minute}분 ${second}초`
  }
  return `${String(date.getHours()).padStart(2, '0')}시 ${String(date.getMinutes()).padStart(2, '0')}분 ${String(date.getSeconds()).padStart(2, '0')}초`
}

function toDateText(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDateRangeTexts(startText: string, endText: string) {
  const dates: string[] = []
  const current = new Date(`${startText}T00:00:00`)
  const end = new Date(`${endText}T00:00:00`)
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return dates
  }

  while (current <= end) {
    dates.push(toDateText(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function getStatusTokens(log?: AttendanceLog) {
  if (!log) return []

  const tokens: Array<{ label: string; className: string }> = []
  if (log.check_in) {
    tokens.push({ label: '출근', className: 'bg-emerald-100 text-emerald-700' })
  }
  if (log.check_out) {
    tokens.push({ label: '퇴근', className: 'bg-sky-100 text-sky-700' })
  }
  if (log.memo) {
    const tone =
      log.memo.includes('지각') ? 'bg-amber-100 text-amber-700' :
      log.memo.includes('휴가') ? 'bg-violet-100 text-violet-700' :
      'bg-neutral-100 text-neutral-700'
    tokens.push({ label: log.memo, className: tone })
  }
  return tokens
}

function formatMinutesToHourMinute(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes))
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${hours}시간 ${String(minutes).padStart(2, '0')}분`
}

function parseTimeMinutes(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.getHours() * 60 + date.getMinutes()
  }
  const rawTime = value.split('T')[1]?.slice(0, 5)
  if (!rawTime) return null
  const [hourText = '0', minuteText = '0'] = rawTime.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function formatMinutesAsTime(value: number | null) {
  if (value === null) return '-'
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatNumber(value: number) {
  return Math.round(value * 10) / 10
}

function calculateElapsedApprovedDays(request: AnnualLeaveRequest, todayDateText: string) {
  if (request.status !== 'approved') return 0

  if (request.days === 0.5) {
    return request.start_date <= todayDateText ? 0.5 : 0
  }

  const start = new Date(`${request.start_date}T00:00:00`)
  const end = new Date(`${request.end_date}T00:00:00`)
  const today = new Date(`${todayDateText}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(today.getTime())) return 0
  if (today < start) return 0

  const effectiveEnd = end < today ? end : today
  const diffMs = effectiveEnd.getTime() - start.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

export default function AdminAttendancePage() {
  const { session, loading: sessionLoading } = useAdminSessionContext()
  const sessionAccountId = (session as any)?.account_id ?? (session as any)?.id
  const hiredAt = session?.hired_at

  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()))
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<AnnualLeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [attendanceForbidden, setAttendanceForbidden] = useState(false)
  const [isLeaveRequestPanelOpen, setIsLeaveRequestPanelOpen] = useState(false)
  const [leaveLedgerSummary, setLeaveLedgerSummary] = useState({
    granted: 0,
    consumed: 0,
    remaining: 0,
  })
  const monthInputRef = useRef<HTMLInputElement | null>(null)
  const selectedYear = useMemo(() => Number(selectedMonth.split('-')[0]), [selectedMonth])

  const minMonth = useMemo(() => {
    if (!hiredAt) return ''
    const date = new Date(hiredAt)
    if (Number.isNaN(date.getTime())) return ''
    return toMonthValue(new Date(date.getFullYear(), date.getMonth(), 1))
  }, [hiredAt])

  const maxMonth = useMemo(() => toMonthValue(new Date()), [])

  useEffect(() => {
    if (minMonth && selectedMonth < minMonth) {
      setSelectedMonth(minMonth)
    }
  }, [minMonth, selectedMonth])

  useEffect(() => {
    if (typeof sessionAccountId !== 'number') return
    if (attendanceForbidden) return

    const fetchLogs = async () => {
      try {
        setLoading(true)
        const { startText, endText } = getMonthBounds(selectedMonth)
        const [attendanceRes, leaveRes, leaveLedgerRes] = await Promise.all([
          getAttendanceLogs({
            offset: 0,
            limit: 100,
            date_from: startText,
            date_to: endText,
          }),
          fetchMyAnnualLeaveRequests({
            offset: 0,
            limit: 100,
          }),
          fetchAnnualLeaves({
            year: selectedYear,
            offset: 0,
            limit: 100,
          }).catch(() => null),
        ])

        setLogs(attendanceRes.items || [])
        setLeaveRequests(
          leaveRes.items || []
        )
        if (leaveLedgerRes) {
          const nextSummary = (leaveLedgerRes.items || []).reduce(
            (acc, item) => {
              acc.granted += Number(item.granted_days || 0)
              acc.consumed += Number(item.consumed_days || item.used_days || 0)
              acc.remaining += Number(item.remaining_days || 0)
              return acc
            },
            { granted: 0, consumed: 0, remaining: 0 }
          )
          setLeaveLedgerSummary(nextSummary)
        } else {
          setLeaveLedgerSummary({ granted: 0, consumed: 0, remaining: 0 })
        }
      } catch (error) {
        const status = (error as any)?.response?.status
        if (status === 403) {
          setAttendanceForbidden(true)
          return
        }
        setLogs([])
        setLeaveRequests([])
        setLeaveLedgerSummary({ granted: 0, consumed: 0, remaining: 0 })
        console.error('출퇴근 기록 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [selectedMonth, selectedYear, sessionAccountId, attendanceForbidden])

  const logMap = useMemo(() => {
    return logs.reduce<Record<string, AttendanceLog>>((acc, log) => {
      acc[log.date] = log
      return acc
    }, {})
  }, [logs])

  const leaveMap = useMemo(() => {
    const { startText, endText } = getMonthBounds(selectedMonth)
    return leaveRequests
      .filter((request) => request.end_date >= startText && request.start_date <= endText)
      .filter((request) => request.status === 'approved' || request.status === 'pending')
      .reduce<Record<string, AnnualLeaveRequest[]>>((acc, request) => {
      const dateTexts = getDateRangeTexts(request.start_date, request.end_date)
      dateTexts.forEach((dateText) => {
        if (!acc[dateText]) {
          acc[dateText] = []
        }
        acc[dateText].push(request)
      })
      return acc
    }, {})
  }, [leaveRequests, selectedMonth])

  const calendarDays = useMemo(() => {
    const { start, end } = getMonthBounds(selectedMonth)
    const firstDayIndex = start.getDay()
    const totalDays = end.getDate()
    const cells: Array<{ key: string; date: Date | null }> = []

    for (let index = 0; index < firstDayIndex; index += 1) {
      cells.push({ key: `empty-start-${index}`, date: null })
    }

    for (let day = 1; day <= totalDays; day += 1) {
      cells.push({ key: `day-${day}`, date: new Date(start.getFullYear(), start.getMonth(), day) })
    }

    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-end-${cells.length}`, date: null })
    }

    return cells
  }, [selectedMonth])

  const monthlyDetails = useMemo(() => {
    const dates = new Set<string>([...logs.map((log) => log.date), ...Object.keys(leaveMap)])
    return [...dates]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        log: logMap[date],
        leaves: leaveMap[date] || [],
      }))
  }, [leaveMap, logMap, logs])

  const monthlySummary = useMemo(() => {
    let workedDays = 0
    let totalWorkedMinutes = 0
    let lateCount = 0
    let checkInMinutesSum = 0
    let checkInCount = 0
    let leaveDays = 0

    monthlyDetails.forEach((row) => {
      if (row.log?.check_in) {
        workedDays += 1
        const checkInMinutes = parseTimeMinutes(row.log.check_in)
        if (checkInMinutes !== null) {
          checkInMinutesSum += checkInMinutes
          checkInCount += 1
        }
      }

      if (row.log?.memo?.includes('지각')) {
        lateCount += 1
      }

      if (row.log?.check_in && row.log?.check_out) {
        const checkIn = new Date(row.log.check_in)
        const checkOut = new Date(row.log.check_out)
        if (!Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime())) {
          const diffMs = checkOut.getTime() - checkIn.getTime()
          if (diffMs > 0) {
            totalWorkedMinutes += Math.floor(diffMs / (1000 * 60))
          }
        }
      }

      row.leaves.forEach((leave) => {
        leaveDays += leave.days === 0.5 ? 0.5 : 1
      })
    })

    const avgCheckInMinutes = checkInCount > 0 ? Math.round(checkInMinutesSum / checkInCount) : null

    return {
      workedDays,
      totalWorkedMinutes,
      lateCount,
      leaveDays,
      avgCheckInMinutes,
    }
  }, [monthlyDetails])

  const cumulativeUsedDays = useMemo(() => {
    const todayDateText = toDateText(new Date())
    return leaveRequests.reduce((sum, request) => {
      return sum + calculateElapsedApprovedDays(request, todayDateText)
    }, 0)
  }, [leaveRequests])

  const nextUpcomingLeave = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const candidates = leaveRequests
      .filter((request) => request.status === 'approved' || request.status === 'pending')
      .map((request) => ({ request, start: new Date(`${request.start_date}T00:00:00`) }))
      .filter((entry) => !Number.isNaN(entry.start.getTime()) && entry.start >= today)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    return candidates[0]?.request || null
  }, [leaveRequests])

  const motivationMessage = useMemo(() => {
    const name = session?.name || '직원'
    if (!nextUpcomingLeave) return `${name}님, 예정된 휴가가 없습니다.`
    const start = new Date(`${nextUpcomingLeave.start_date}T00:00:00`)
    if (Number.isNaN(start.getTime())) return `${name}님, 휴가 일정을 확인해 주세요.`
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return `${name}님, 오늘은 즐거운 휴가일입니다.`
    if (diffDays === 1) return `${name}님, 내일은 즐거운 휴가일입니다.`
    return `${name}님 휴가까지 D-${diffDays}일 입니다. 화이팅!`
  }, [nextUpcomingLeave, session?.name])

  if (sessionLoading) {
    return <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">불러오는 중...</div>
  }

  if (typeof sessionAccountId !== 'number') {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">사용자 정보를 확인할 수 없습니다.</div>
  }

  if (attendanceForbidden) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-700">
        권한이 없습니다. 관리자에게 신청하세요.
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_320px]">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="mx-auto grid w-full max-w-[280px] grid-cols-[44px_1fr_44px] items-center gap-3">
                {Boolean(minMonth) && selectedMonth <= minMonth ? (
                  <div className="h-11" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
                    className="h-11 rounded-lg border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-50"
                  >
                    ‹
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (monthInputRef.current?.showPicker) {
                      monthInputRef.current.showPicker()
                    } else {
                      monthInputRef.current?.click()
                    }
                  }}
                  className="relative flex h-11 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 text-base font-semibold text-neutral-900"
                >
                  <span>{getMonthLabel(selectedMonth)}</span>
                  <input
                    ref={monthInputRef}
                    type="month"
                    value={selectedMonth}
                    min={minMonth || undefined}
                    max={maxMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </button>
                {selectedMonth >= maxMonth ? (
                  <div className="h-11" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))}
                    className="h-11 rounded-lg border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-50"
                  >
                    ›
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsLeaveRequestPanelOpen(true)}
                className="shrink-0 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
              >
                휴가 신청
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
            {weekLabels.map((label, index) => (
              <div
                key={label}
                className={`border-r border-neutral-200 px-3 py-3 text-center text-xs font-medium ${
                  index === 0 ? 'text-rose-500' : index === 6 ? 'text-sky-600' : 'text-neutral-500'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((cell) => {
              if (!cell.date) {
                return <div key={cell.key} className="min-h-[128px] border-b border-r border-neutral-200 bg-neutral-50/60" />
              }

              const dateText = toDateText(cell.date)
              const log = logMap[dateText]
              const leaves = leaveMap[dateText] || []
              const isToday = dateText === new Date().toISOString().slice(0, 10)

              return (
                <div key={cell.key} className="min-h-[128px] border-b border-r border-neutral-200 px-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isToday ? 'text-neutral-900' : 'text-neutral-700'}`}>{cell.date.getDate()}</span>
                    {isToday ? (
                      <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">오늘</span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {!log && leaves.length === 0 ? (
                      <p className="text-[11px] text-neutral-300">기록 없음</p>
                    ) : (
                      <>
                        {log ? (
                          <>
                            <p className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                              출근 : {formatTime(log.check_in)}
                            </p>
                            <p className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
                              퇴근 : {formatTime(log.check_out)}
                            </p>
                          </>
                        ) : null}
                        {leaves.map((leave) => {
                          const leaveLabel = leave.days === 0.5 ? '반차' : '휴가'
                          return (
                            <div
                              key={`leave-${leave.id}-${dateText}`}
                              className="inline-flex rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700"
                            >
                              {leaveLabel}
                            </div>
                          )
                        })}
                        {log?.memo ? (
                          <div className="inline-flex rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700">
                            {log.memo}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className={`${cardClass} h-fit p-4`}>
          <h2 className="text-sm font-semibold text-neutral-900">{getMonthLabel(selectedMonth)} 요약</h2>
          <p className="mt-1 text-xs text-neutral-500">이번 달 근태 현황을 빠르게 확인합니다.</p>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <p className="text-[11px] text-sky-700">휴가 안내</p>
              <p className="mt-1 text-sm font-semibold text-sky-900">{motivationMessage}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2">
                <p className="text-[11px] text-neutral-500">부여</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{formatNumber(leaveLedgerSummary.granted)}일</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2">
                <p className="text-[11px] text-neutral-500">누적 사용</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{formatNumber(cumulativeUsedDays)}일</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2">
                <p className="text-[11px] text-neutral-500">잔여</p>
                <p className="mt-1 text-sm font-semibold text-sky-700">{formatNumber(leaveLedgerSummary.remaining)}일</p>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">총 근무일</p>
              <p className="mt-1 text-base font-semibold text-neutral-900">{monthlySummary.workedDays}일</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">총 근무시간</p>
              <p className="mt-1 text-base font-semibold text-neutral-900">{formatMinutesToHourMinute(monthlySummary.totalWorkedMinutes)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">지각</p>
              <p className="mt-1 text-base font-semibold text-amber-700">{monthlySummary.lateCount}회</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">이번 달 사용(예정포함)</p>
              <p className="mt-1 text-base font-semibold text-violet-700">{Number(monthlySummary.leaveDays.toFixed(1))}일</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-[11px] text-neutral-500">평균 출근시각</p>
              <p className="mt-1 text-base font-semibold text-neutral-900">{formatMinutesAsTime(monthlySummary.avgCheckInMinutes)}</p>
            </div>
          </div>
        </aside>
      </div>

      <div className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">{getMonthLabel(selectedMonth)} 상세 기록</h2>
            <p className="mt-1 text-xs text-neutral-500">월별 출퇴근 기록을 날짜 단위로 확인합니다.</p>
          </div>
          {loading ? <span className="text-xs text-neutral-500">조회 중...</span> : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-3 text-left">날짜</th>
                <th className="px-3 py-3 text-left">출근</th>
                <th className="px-3 py-3 text-left">퇴근</th>
                <th className="px-3 py-3 text-left">상태</th>
                <th className="px-3 py-3 text-left">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">조회 중...</td>
                </tr>
              ) : monthlyDetails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">해당 월의 출퇴근 기록이 없습니다.</td>
                </tr>
              ) : (
                monthlyDetails.map((row) => {
                  const tokens = row.log ? getStatusTokens(row.log) : []
                  const leaveTokens = row.leaves.map((leave) => ({
                    label: leave.days === 0.5 ? '반차' : '휴가',
                    className: 'bg-violet-100 text-violet-700',
                  }))
                  const memoText = [
                    ...row.leaves.map((leave) => leave.reason).filter(Boolean),
                    row.log?.memo || '',
                  ]
                    .filter(Boolean)
                    .join(' / ')
                  return (
                    <tr key={row.date}>
                      <td className="px-3 py-3 text-left text-neutral-900">{formatDateLabel(row.date)}</td>
                      <td className="px-3 py-3 text-left text-neutral-700">{formatTime(row.log?.check_in)}</td>
                      <td className="px-3 py-3 text-left text-neutral-700">{formatTime(row.log?.check_out)}</td>
                      <td className="px-3 py-3 text-left">
                        <div className="flex flex-wrap gap-1">
                          {tokens.length === 0 && leaveTokens.length === 0 ? <span className="text-neutral-400">-</span> : null}
                          {tokens
                            .filter((token) => token.label !== row.log?.memo)
                            .map((token) => (
                            <span key={`${row.date}-${token.label}`} className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${token.className}`}>
                              {token.label}
                            </span>
                          ))}
                          {leaveTokens.map((token, index) => (
                            <span
                              key={`${row.date}-leave-${index}`}
                              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${token.className}`}
                            >
                              {token.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-left text-neutral-600">{memoText || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLeaveRequestPanelOpen ? (
        <AdminLeaveRequestPanel
          mode="panel"
          onClose={() => setIsLeaveRequestPanelOpen(false)}
          onSubmitted={async () => {
            setIsLeaveRequestPanelOpen(false)
            const { startText, endText } = getMonthBounds(selectedMonth)
            const [attendanceRes, leaveRes, leaveLedgerRes] = await Promise.all([
              getAttendanceLogs({
                offset: 0,
                limit: 100,
                date_from: startText,
                date_to: endText,
              }),
              fetchMyAnnualLeaveRequests({
                offset: 0,
                limit: 100,
              }),
              fetchAnnualLeaves({
                year: selectedYear,
                offset: 0,
                limit: 100,
              }).catch(() => null),
            ])
            setLogs(attendanceRes.items || [])
            setLeaveRequests(
              leaveRes.items || []
            )
            if (leaveLedgerRes) {
              const nextSummary = (leaveLedgerRes.items || []).reduce(
                (acc, item) => {
                  acc.granted += Number(item.granted_days || 0)
                  acc.consumed += Number(item.consumed_days || item.used_days || 0)
                  acc.remaining += Number(item.remaining_days || 0)
                  return acc
                },
                { granted: 0, consumed: 0, remaining: 0 }
              )
              setLeaveLedgerSummary(nextSummary)
            } else {
              setLeaveLedgerSummary({ granted: 0, consumed: 0, remaining: 0 })
            }
          }}
        />
      ) : null}
    </section>
  )
}
