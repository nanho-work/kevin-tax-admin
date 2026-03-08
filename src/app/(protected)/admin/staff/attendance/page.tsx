'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { getAttendanceLogs } from '@/services/admin/attendanceLogService'
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

export default function AdminAttendancePage() {
  const { session, loading: sessionLoading } = useAdminSessionContext()
  const sessionAccountId = (session as any)?.account_id ?? (session as any)?.id
  const hiredAt = session?.hired_at

  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()))
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<AnnualLeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [attendanceForbidden, setAttendanceForbidden] = useState(false)
  const monthInputRef = useRef<HTMLInputElement | null>(null)

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
        const [attendanceRes, leaveRes] = await Promise.all([
          getAttendanceLogs({
            offset: 0,
            limit: 200,
            date_from: startText,
            date_to: endText,
          }),
          fetchMyAnnualLeaveRequests({
            status: 'approved',
            offset: 0,
            limit: 200,
          }),
        ])

        setLogs(attendanceRes.items || [])
        setLeaveRequests(
          (leaveRes.items || []).filter((request) => request.end_date >= startText && request.start_date <= endText)
        )
      } catch (error) {
        const status = (error as any)?.response?.status
        if (status === 403) {
          setAttendanceForbidden(true)
          return
        }
        setLogs([])
        setLeaveRequests([])
        console.error('출퇴근 기록 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [selectedMonth, sessionAccountId, attendanceForbidden])

  const logMap = useMemo(() => {
    return logs.reduce<Record<string, AttendanceLog>>((acc, log) => {
      acc[log.date] = log
      return acc
    }, {})
  }, [logs])

  const leaveMap = useMemo(() => {
    return leaveRequests.reduce<Record<string, AnnualLeaveRequest[]>>((acc, request) => {
      const dateTexts = getDateRangeTexts(request.start_date, request.end_date)
      dateTexts.forEach((dateText) => {
        if (!acc[dateText]) {
          acc[dateText] = []
        }
        acc[dateText].push(request)
      })
      return acc
    }, {})
  }, [leaveRequests])

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
      <div className={`${cardClass} p-4`}>
        <div className="mx-auto grid w-full max-w-[280px] grid-cols-[44px_1fr_44px] items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
            disabled={Boolean(minMonth) && selectedMonth <= minMonth}
            className="h-11 rounded-lg border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            ‹
          </button>
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
          <button
            type="button"
            onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))}
            disabled={selectedMonth >= maxMonth}
            className="h-11 rounded-lg border border-neutral-300 text-lg text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
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
    </section>
  )
}
