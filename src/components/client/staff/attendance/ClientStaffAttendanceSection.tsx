'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  type ClientAttendanceBoardItem,
  getClientStaffAttendanceBoard,
  getClientStaffs,
} from '@/services/client/clientStaffService'
import { fetchClientAnnualLeaves } from '@/services/client/clientAnnualLeaveService'
import { fetchClientAnnualLeaveRequests } from '@/services/client/clientAnnualLeaveRequestService'
import { getRoles } from '@/services/client/roleService'
import { getTeams } from '@/services/client/teamService'
import type { AdminOut } from '@/types/admin'
import type { AnnualLeave } from '@/types/annualLeave'
import type { AnnualLeaveRequest } from '@/types/annualLeaveRequest'
import type { RoleOut } from '@/types/role'
import type { TeamOut } from '@/types/team'

type ViewMode = 'all' | 'single'

const weekdayHeaders = ['월', '화', '수', '목', '금', '토', '일']
const ALL_STAFF_LABEL = '전체 직원'
const inputClass =
  'h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const secondaryButtonClass =
  'inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50'

function toDateParam(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const date = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function startOfWeekMonday(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const dayIndex = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dayIndex)
  return date
}

function endOfWeekMonday(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

function moveWeek(value: Date, amount: number) {
  const moved = new Date(value)
  moved.setDate(moved.getDate() + amount * 7)
  return moved
}

function moveMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getNearestExpiredAt(current: string | null, next: string | null) {
  if (!current) return next
  if (!next) return current
  return new Date(current).getTime() <= new Date(next).getTime() ? current : next
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function isNearExpiry(value?: string | null) {
  if (!value) return false
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return false
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isExpired(value?: string | null) {
  if (!value) return false
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return false
  return target.getTime() < new Date().getTime()
}

function getLeaveStatusMeta(row: { remaining_days: number; expired_at: string | null }) {
  if (row.remaining_days <= 0) {
    return { label: '사용 완료', className: 'inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700' }
  }
  if (isExpired(row.expired_at)) {
    return { label: '소멸', className: 'inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700' }
  }
  if (row.expired_at && isNearExpiry(row.expired_at)) {
    return { label: '만료 임박', className: 'inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700' }
  }
  if (row.expired_at) {
    return { label: '사용 가능', className: 'inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700' }
  }
  return { label: '-', className: 'text-zinc-400' }
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
  }
  const matched = String(value).match(/(\d{2}:\d{2})/)
  return matched?.[1] || value
}

function formatWorkedMinutes(value: number | null | undefined) {
  const minutes = Number(value || 0)
  if (!Number.isFinite(minutes) || minutes <= 0) return '-'
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  if (hour > 0 && minute > 0) return `${hour}시간 ${minute}분`
  if (hour > 0) return `${hour}시간`
  return `${minute}분`
}

function formatHoursFromMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0시간'
  const hour = Math.floor(value / 60)
  const minute = value % 60
  if (hour > 0 && minute > 0) return `${hour}시간 ${minute}분`
  if (hour > 0) return `${hour}시간`
  return `${minute}분`
}

function getWeekdayTextClass(weekdayIndex: number) {
  if (weekdayIndex === 6) return 'text-rose-600'
  if (weekdayIndex === 5) return 'text-blue-600'
  return 'text-zinc-700'
}

function buildMonthlyCalendar(anchorDate: Date) {
  const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const lastDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  const leadBlankCount = (firstDay.getDay() + 6) % 7
  const dayCount = lastDay.getDate()
  const totalCellCount = Math.ceil((leadBlankCount + dayCount) / 7) * 7

  return Array.from({ length: totalCellCount }, (_, idx) => {
    const dayNumber = idx - leadBlankCount + 1
    if (dayNumber < 1 || dayNumber > dayCount) {
      return null
    }
    const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), dayNumber)
    return { date, dayNumber }
  })
}

export default function ClientStaffAttendanceSection() {
  const today = new Date()
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())
  const [offset, setOffset] = useState(0)
  const [limit] = useState(10)
  const [loading, setLoading] = useState(false)

  const [teams, setTeams] = useState<TeamOut[]>([])
  const [roles, setRoles] = useState<RoleOut[]>([])
  const [staffs, setStaffs] = useState<AdminOut[]>([])

  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [staffQueryInput, setStaffQueryInput] = useState('')
  const deferredStaffQuery = useDeferredValue(staffQueryInput.trim().toLowerCase())
  const [showStaffDropdown, setShowStaffDropdown] = useState(false)

  const [weekColumns, setWeekColumns] = useState<Array<{ date: string; weekday: string; weekday_index: number }>>([])
  const [weekItems, setWeekItems] = useState<ClientAttendanceBoardItem[]>([])
  const [weekStaffTotal, setWeekStaffTotal] = useState(0)

  const [monthColumns, setMonthColumns] = useState<Array<{ date: string; weekday: string; weekday_index: number }>>([])
  const [selectedMonthItem, setSelectedMonthItem] = useState<ClientAttendanceBoardItem | null>(null)
  const [leaveBoardMonth, setLeaveBoardMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [approvedLeaveRequests, setApprovedLeaveRequests] = useState<AnnualLeaveRequest[]>([])
  const [annualLeaves, setAnnualLeaves] = useState<AnnualLeave[]>([])
  const [leaveLoading, setLeaveLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadMeta = async () => {
      try {
        const [teamRows, roleRows] = await Promise.all([getTeams(), getRoles()])
        if (!mounted) return
        setTeams(Array.isArray(teamRows) ? teamRows : [])
        setRoles(Array.isArray(roleRows) ? roleRows : [])
      } catch {
        if (!mounted) return
        setTeams([])
        setRoles([])
      }
    }

    const loadStaffs = async () => {
      try {
        const merged: AdminOut[] = []
        const pageSize = 200
        let page = 1
        let total = 0

        do {
          const res = await getClientStaffs(page, pageSize)
          merged.push(...(res.items || []))
          total = Number(res.total || 0)
          page += 1
        } while (merged.length < total)

        if (!mounted) return
        const active = merged.filter((staff) => Boolean(staff.is_active))
        setStaffs(active.sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      } catch {
        if (!mounted) return
        setStaffs([])
      }
    }

    void Promise.all([loadMeta(), loadStaffs()])

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadAnnualLeaves = async () => {
      try {
        const merged: AnnualLeave[] = []
        const limit = 200
        let offsetCursor = 0
        let total = 0

        do {
          const res = await fetchClientAnnualLeaves({
            year: leaveBoardMonth.getFullYear(),
            offset: offsetCursor,
            limit,
          })
          merged.push(...(res.items || []))
          total = Number(res.total || 0)
          offsetCursor += limit
        } while (merged.length < total)

        if (!mounted) return
        setAnnualLeaves(merged)
      } catch {
        if (!mounted) return
        setAnnualLeaves([])
      }
    }

    void loadAnnualLeaves()

    return () => {
      mounted = false
    }
  }, [leaveBoardMonth])

  useEffect(() => {
    let mounted = true

    const loadApprovedLeaves = async () => {
      try {
        setLeaveLoading(true)
        const merged: AnnualLeaveRequest[] = []
        const limit = 200
        let offsetCursor = 0
        let total = 0

        do {
          const res = await fetchClientAnnualLeaveRequests({
            status: 'approved',
            offset: offsetCursor,
            limit,
          })
          merged.push(...(res.items || []))
          total = Number(res.total || 0)
          offsetCursor += limit
        } while (merged.length < total)

        if (!mounted) return
        setApprovedLeaveRequests(merged)
      } catch {
        if (!mounted) return
        setApprovedLeaveRequests([])
      } finally {
        if (mounted) setLeaveLoading(false)
      }
    }

    void loadApprovedLeaves()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(event.target as Node)) {
        setShowStaffDropdown(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [])

  useEffect(() => {
    if (viewMode !== 'all') return
    setOffset(0)
  }, [anchorDate, viewMode])

  useEffect(() => {
    let mounted = true

    const loadWeekly = async () => {
      try {
        setLoading(true)
        const res = await getClientStaffAttendanceBoard({
          period: 'week',
          anchor_date: toDateParam(anchorDate),
          offset,
          limit,
        })
        if (!mounted) return
        setWeekColumns(Array.isArray(res.columns) ? res.columns : [])
        setWeekItems(Array.isArray(res.items) ? res.items : [])
        setWeekStaffTotal(Number(res.staff_total || 0))
      } catch {
        if (!mounted) return
        toast.error('직원 근태 보드를 불러오지 못했습니다.')
        setWeekColumns([])
        setWeekItems([])
        setWeekStaffTotal(0)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const loadSingleMonthly = async () => {
      const selected = staffs.find((row) => row.id === selectedStaffId)
      if (!selected) {
        setMonthColumns([])
        setSelectedMonthItem(null)
        return
      }

      try {
        setLoading(true)
        const res = await getClientStaffAttendanceBoard({
          period: 'month',
          anchor_date: toDateParam(anchorDate),
          keyword: selected.name,
          offset: 0,
          limit: 200,
        })

        if (!mounted) return
        const target = (res.items || []).find((item) => Number(item.admin_id) === Number(selected.id)) || null
        setMonthColumns(Array.isArray(res.columns) ? res.columns : [])
        setSelectedMonthItem(target)
      } catch {
        if (!mounted) return
        toast.error('직원 월간 근태를 불러오지 못했습니다.')
        setMonthColumns([])
        setSelectedMonthItem(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (viewMode === 'all') {
      void loadWeekly()
    } else {
      void loadSingleMonthly()
    }

    return () => {
      mounted = false
    }
  }, [viewMode, anchorDate, offset, limit, selectedStaffId, staffs])

  const teamNameById = useMemo(() => new Map(teams.map((row) => [Number(row.id), row.name])), [teams])
  const roleNameById = useMemo(() => new Map(roles.map((row) => [Number(row.id), row.name])), [roles])

  const selectedStaff = useMemo(() => staffs.find((row) => row.id === selectedStaffId) || null, [staffs, selectedStaffId])

  const filteredStaffs = useMemo(() => {
    const query = deferredStaffQuery === ALL_STAFF_LABEL.toLowerCase() ? '' : deferredStaffQuery
    if (!query) return staffs.slice(0, 100)
    return staffs
      .filter((staff) => {
        const name = String(staff.name || '').toLowerCase()
        const loginId = String(staff.login_id || '').toLowerCase()
        const email = String(staff.email || '').toLowerCase()
        return name.includes(query) || loginId.includes(query) || email.includes(query)
      })
      .slice(0, 100)
  }, [staffs, deferredStaffQuery])

  const weeklyAttendanceReadyCount = useMemo(() => {
    return weekItems.filter((item) =>
      item.days.some((day) => Boolean(day.check_in) || Boolean(day.check_out) || Number(day.worked_minutes || 0) > 0)
    ).length
  }, [weekItems])

  const monthlyStats = useMemo(() => {
    if (!selectedMonthItem) {
      return { workedMinutes: 0, workedDays: 0 }
    }
    const workedMinutes = selectedMonthItem.days.reduce((acc, day) => acc + Number(day.worked_minutes || 0), 0)
    const workedDays = selectedMonthItem.days.filter((day) =>
      Boolean(day.check_in) || Boolean(day.check_out) || Number(day.worked_minutes || 0) > 0
    ).length
    return { workedMinutes, workedDays }
  }, [selectedMonthItem])

  const weeklyStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate])
  const weeklyEnd = useMemo(() => endOfWeekMonday(weeklyStart), [weeklyStart])
  const monthlyLabel = `${anchorDate.getFullYear()}년 ${anchorDate.getMonth() + 1}월`

  const centerHeaderLabel = useMemo(() => {
    if (viewMode === 'single') return monthlyLabel
    const monthLabel = `${weeklyStart.getFullYear()}년 ${weeklyStart.getMonth() + 1}월`
    const rangeLabel = `${weeklyStart.getMonth() + 1}/${weeklyStart.getDate()}~${weeklyEnd.getMonth() + 1}/${weeklyEnd.getDate()}`
    return `${monthLabel} (${rangeLabel})`
  }, [viewMode, monthlyLabel, weeklyStart, weeklyEnd])

  const canMoveNext = useMemo(() => {
    if (viewMode === 'all') {
      const todayWeekStart = startOfWeekMonday(today)
      return weeklyStart.getTime() < todayWeekStart.getTime()
    }
    const anchorMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return anchorMonthStart.getTime() < currentMonthStart.getTime()
  }, [viewMode, anchorDate, weeklyStart, today])

  const handleMovePrevious = () => {
    if (viewMode === 'all') {
      setAnchorDate((prev) => moveWeek(prev, -1))
      return
    }
    setAnchorDate((prev) => moveMonth(prev, -1))
  }

  const handleMoveNext = () => {
    if (!canMoveNext) return
    if (viewMode === 'all') {
      setAnchorDate((prev) => moveWeek(prev, 1))
      return
    }
    setAnchorDate((prev) => moveMonth(prev, 1))
  }

  const totalPages = useMemo(() => {
    if (weekStaffTotal <= 0) return 1
    return Math.max(1, Math.ceil(weekStaffTotal / limit))
  }, [weekStaffTotal, limit])
  const currentPage = Math.floor(offset / limit) + 1

  const calendarCells = useMemo(() => buildMonthlyCalendar(anchorDate), [anchorDate])
  const monthDayMap = useMemo(() => {
    const map = new Map<string, { check_in: string | null; check_out: string | null; worked_minutes: number }>()
    if (!selectedMonthItem) return map
    for (const day of selectedMonthItem.days) {
      map.set(day.date, { check_in: day.check_in, check_out: day.check_out, worked_minutes: day.worked_minutes })
    }
    return map
  }, [selectedMonthItem])

  const leaveCalendarCells = useMemo(() => buildMonthlyCalendar(leaveBoardMonth), [leaveBoardMonth])
  const leaveDayMap = useMemo(() => {
    const monthStart = new Date(leaveBoardMonth.getFullYear(), leaveBoardMonth.getMonth(), 1)
    const monthEnd = new Date(leaveBoardMonth.getFullYear(), leaveBoardMonth.getMonth() + 1, 0)
    const tempMap = new Map<string, Set<string>>()

    for (const request of approvedLeaveRequests) {
      const start = parseDateOnly(request.start_date)
      const end = parseDateOnly(request.end_date)
      if (!start || !end) continue
      if (end.getTime() < monthStart.getTime() || start.getTime() > monthEnd.getTime()) continue

      const overlapStart = new Date(Math.max(start.getTime(), monthStart.getTime()))
      const overlapEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()))
      const cursor = new Date(overlapStart.getFullYear(), overlapStart.getMonth(), overlapStart.getDate())

      while (cursor.getTime() <= overlapEnd.getTime()) {
        const key = toDateParam(cursor)
        const name = request.admin_name || `직원#${request.admin_id}`
        if (!tempMap.has(key)) tempMap.set(key, new Set())
        tempMap.get(key)?.add(name)
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const result = new Map<string, string[]>()
    for (const [key, value] of tempMap.entries()) {
      result.set(key, Array.from(value).sort((a, b) => a.localeCompare(b, 'ko')))
    }
    return result
  }, [approvedLeaveRequests, leaveBoardMonth])

  const leaveSummaryRows = useMemo(() => {
    const grouped = annualLeaves.reduce<
      Record<
        number,
        {
          admin_id: number
          admin_name: string
          granted_days: number
          consumed_days: number
          remaining_days: number
          expired_at: string | null
        }
      >
    >((acc, item) => {
      const grantedDays = toSafeNumber((item as any).granted_days)
      const consumedDays = toSafeNumber((item as any).consumed_days ?? (item as any).used_days)
      const remainingDaysRaw = (item as any).remaining_days
      const remainingDays = remainingDaysRaw == null ? Math.max(0, grantedDays - consumedDays) : toSafeNumber(remainingDaysRaw)

      const current = acc[item.admin_id] || {
        admin_id: item.admin_id,
        admin_name: item.admin_name,
        granted_days: 0,
        consumed_days: 0,
        remaining_days: 0,
        expired_at: null,
      }

      current.granted_days += grantedDays
      current.consumed_days += consumedDays
      current.remaining_days += remainingDays
      current.expired_at = getNearestExpiredAt(current.expired_at, item.expired_at)
      acc[item.admin_id] = current
      return acc
    }, {})

    return Object.values(grouped).sort((a, b) => a.admin_name.localeCompare(b.admin_name, 'ko'))
  }, [annualLeaves])

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="space-y-2 sm:space-y-0 sm:relative sm:flex sm:min-h-8 sm:items-center">
              <div ref={pickerRef} className="relative z-40 w-[140px] shrink-0">
                <div className="relative">
                  <input
                    className={`${inputClass} pr-10`}
                    placeholder={ALL_STAFF_LABEL}
                    value={staffQueryInput}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setStaffQueryInput(nextValue)
                      setShowStaffDropdown(true)
                      if (!nextValue.trim()) {
                        setSelectedStaffId(null)
                        setViewMode('all')
                        setOffset(0)
                      }
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffDropdown((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
                  >
                    ▾
                  </button>
                </div>
                {showStaffDropdown ? (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(null)
                        setStaffQueryInput('')
                        setShowStaffDropdown(false)
                        setViewMode('all')
                        setOffset(0)
                      }}
                      className={`block w-full px-3 py-2 text-left hover:bg-zinc-50 ${
                        selectedStaffId == null ? 'bg-zinc-50' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-zinc-900">{ALL_STAFF_LABEL}</p>
                    </button>
                    {filteredStaffs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-500">일치하는 직원이 없습니다.</div>
                    ) : (
                      filteredStaffs.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(staff.id)
                            setStaffQueryInput(staff.name)
                            setShowStaffDropdown(false)
                            setViewMode('single')
                            setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1))
                          }}
                          className="block w-full px-3 py-2 text-left hover:bg-zinc-50"
                        >
                          <p className="text-sm font-medium text-zinc-900">{staff.name}</p>
                          <p className="text-xs text-zinc-500">{staff.team?.name || '팀 미지정'}</p>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-center gap-1.5 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                  <button type="button" onClick={handleMovePrevious} className={secondaryButtonClass}>
                    &lt;
                  </button>
                  <p className="min-w-[180px] text-center text-sm font-semibold text-zinc-900">{centerHeaderLabel}</p>
                  <button type="button" onClick={handleMoveNext} disabled={!canMoveNext} className={secondaryButtonClass}>
                    &gt;
                  </button>
              </div>
              <div className="sm:ml-auto">
                {viewMode === 'all' ? (
                  <p className="text-right text-xs text-zinc-600">
                    전체 {weekStaffTotal.toLocaleString('ko-KR')}명 · 반영 {weeklyAttendanceReadyCount.toLocaleString('ko-KR')}명
                  </p>
                ) : (
                  <p className="text-right text-xs text-zinc-600">
                    {selectedStaff?.name || '-'} · {monthlyStats.workedDays.toLocaleString('ko-KR')}일 · {formatHoursFromMinutes(monthlyStats.workedMinutes)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {viewMode === 'all' ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="min-w-[480px] w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="sticky left-0 z-20 min-w-[96px] border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-center">직원</th>
                      {weekColumns.map((column) => (
                        <th
                          key={column.date}
                          className={`min-w-[65px] border-r border-zinc-100 px-2 py-2 text-center ${getWeekdayTextClass(column.weekday_index)}`}
                        >
                          {column.date.slice(5)} ({column.weekday})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {loading ? (
                      <tr>
                        <td colSpan={Math.max(2, weekColumns.length + 1)} className="px-3 py-10 text-center text-zinc-500">
                          조회 중...
                        </td>
                      </tr>
                    ) : weekItems.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(2, weekColumns.length + 1)} className="px-3 py-10 text-center text-zinc-500">
                          조회된 직원이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      weekItems.map((row) => {
                        const dayMap = new Map(row.days.map((day) => [day.date, day]))
                        return (
                          <tr key={row.admin_id}>
                            <td className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-2 py-2 text-center align-middle">
                              <div className="space-y-0.5 leading-tight">
                                <p className="text-[11px] text-zinc-500">{row.team_id ? teamNameById.get(row.team_id) || '-' : '팀 미지정'}</p>
                                <p className="text-xs font-semibold text-zinc-900">{row.admin_name}</p>
                                <p className="text-[11px] text-zinc-500">{row.role_id ? roleNameById.get(row.role_id) || '-' : '직급 미지정'}</p>
                              </div>
                            </td>
                            {weekColumns.map((column) => {
                              const day = dayMap.get(column.date)
                              const hasLog =
                                Boolean(day?.check_in) || Boolean(day?.check_out) || Number(day?.worked_minutes || 0) > 0

                              return (
                                <td key={`${row.admin_id}-${column.date}`} className="border-r border-zinc-100 px-2 py-1.5 text-center align-top">
                                  {hasLog ? (
                                    <div className="rounded-md border border-zinc-100 bg-zinc-50/60 px-1.5 py-1 text-[10px] text-zinc-700">
                                      <div>
                                        <span className="text-zinc-500">출근 </span>
                                        <span className="font-medium text-zinc-900">{formatTime(day?.check_in)}</span>
                                      </div>
                                      <div>
                                        <span className="text-zinc-500">퇴근 </span>
                                        <span className="font-medium text-zinc-900">{formatTime(day?.check_out)}</span>
                                      </div>
                                      <div className="mt-0.5 border-t border-zinc-200 pt-0.5 text-zinc-500">{formatWorkedMinutes(day?.worked_minutes)}</div>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-300">-</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset(0)}
                    disabled={currentPage <= 1 || loading}
                    className={secondaryButtonClass}
                  >
                    처음
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                    disabled={currentPage <= 1 || loading}
                    className={secondaryButtonClass}
                  >
                    이전
                  </button>
                  <div className="min-w-[120px] text-center text-sm text-zinc-700">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffset((prev) => prev + limit)}
                    disabled={currentPage >= totalPages || loading}
                    className={secondaryButtonClass}
                  >
                    다음
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset(Math.max(0, (totalPages - 1) * limit))}
                    disabled={currentPage >= totalPages || loading}
                    className={secondaryButtonClass}
                  >
                    마지막
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-7 gap-2 border-b border-zinc-200 pb-2 text-center text-xs font-medium">
                {weekdayHeaders.map((weekday, idx) => (
                  <div
                    key={weekday}
                    className={idx === 5 ? 'text-blue-600' : idx === 6 ? 'text-rose-600' : 'text-zinc-600'}
                  >
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`blank-${idx}`} className="h-28 rounded-md border border-transparent bg-zinc-50/40" />
                  }

                  const dateKey = toDateParam(cell.date)
                  const log = monthDayMap.get(dateKey)
                  const hasLog = Boolean(log?.check_in) || Boolean(log?.check_out) || Number(log?.worked_minutes || 0) > 0
                  const weekdayIndex = (cell.date.getDay() + 6) % 7
                  const dayTextClass = weekdayIndex === 6 ? 'text-rose-600' : weekdayIndex === 5 ? 'text-blue-600' : 'text-zinc-700'

                  return (
                    <div key={dateKey} className="h-28 rounded-md border border-zinc-200 bg-white p-2">
                      <p className={`text-sm font-semibold ${dayTextClass}`}>{cell.dayNumber}</p>
                      {hasLog ? (
                        <div className="mt-1 space-y-0.5 text-[11px] text-zinc-700">
                          <div>
                            <span className="text-zinc-500">출근 </span>
                            <span className="font-medium text-zinc-900">{formatTime(log?.check_in)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">퇴근 </span>
                            <span className="font-medium text-zinc-900">{formatTime(log?.check_out)}</span>
                          </div>
                          <div className="text-zinc-500">{formatWorkedMinutes(log?.worked_minutes)}</div>
                        </div>
                      ) : (
                        <div className="mt-6 text-center text-xs text-zinc-300">-</div>
                      )}
                    </div>
                  )
                })}
              </div>
              {loading ? <p className="mt-3 text-center text-sm text-zinc-500">조회 중...</p> : null}
              {!loading && !selectedMonthItem ? (
                <p className="mt-3 text-center text-sm text-zinc-500">선택한 직원의 월간 데이터가 없습니다.</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">휴가 월간 보드</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLeaveBoardMonth((prev) => moveMonth(prev, -1))} className={secondaryButtonClass}>
                  &lt;
                </button>
                <p className="min-w-[120px] text-center text-sm font-semibold text-zinc-900">
                  {leaveBoardMonth.getFullYear()}년 {leaveBoardMonth.getMonth() + 1}월
                </p>
                <button type="button" onClick={() => setLeaveBoardMonth((prev) => moveMonth(prev, 1))} className={secondaryButtonClass}>
                  &gt;
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-2 border-b border-zinc-200 pb-2 text-center text-xs font-medium">
              {weekdayHeaders.map((weekday, idx) => (
                <div key={weekday} className={idx === 5 ? 'text-blue-600' : idx === 6 ? 'text-rose-600' : 'text-zinc-600'}>
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {leaveCalendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`leave-blank-${idx}`} className="h-28 rounded-md border border-transparent bg-zinc-50/40" />
                }

                const dateKey = toDateParam(cell.date)
                const names = leaveDayMap.get(dateKey) || []
                const weekdayIndex = (cell.date.getDay() + 6) % 7
                const dayTextClass = weekdayIndex === 6 ? 'text-rose-600' : weekdayIndex === 5 ? 'text-blue-600' : 'text-zinc-700'

                return (
                  <div key={dateKey} className="h-28 rounded-md border border-zinc-200 bg-white p-2">
                    <p className={`text-sm font-semibold ${dayTextClass}`}>{cell.dayNumber}</p>
                    {names.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {names.slice(0, 2).map((name) => (
                          <p key={`${dateKey}-${name}`} className="truncate rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                            {name}
                          </p>
                        ))}
                        {names.length > 2 ? <p className="text-[11px] text-zinc-500">+{names.length - 2}명</p> : null}
                      </div>
                    ) : (
                      <div className="mt-6 text-center text-xs text-zinc-300">-</div>
                    )}
                  </div>
                )
              })}
            </div>
            {leaveLoading ? <p className="mt-3 text-center text-sm text-zinc-500">휴가 보드 조회 중...</p> : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-3 text-left">이름</th>
                  <th className="px-3 py-3 text-right">부여연차</th>
                  <th className="px-3 py-3 text-right">사용연차</th>
                  <th className="px-3 py-3 text-right">잔여연차</th>
                  <th className="px-3 py-3 text-center">만료일</th>
                  <th className="px-3 py-3 text-center">상태</th>
                  <th className="px-3 py-3 text-center">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {leaveSummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                      조회된 휴가 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  leaveSummaryRows.map((row) => {
                    const statusMeta = getLeaveStatusMeta({
                      remaining_days: row.remaining_days,
                      expired_at: row.expired_at,
                    })
                    return (
                      <tr key={row.admin_id}>
                        <td className="px-3 py-3 text-left font-medium text-zinc-900">{row.admin_name}</td>
                        <td className="px-3 py-3 text-right text-zinc-700">{row.granted_days.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-3 text-right text-zinc-700">{row.consumed_days.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-3 text-right font-semibold text-zinc-900">{row.remaining_days.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-3 text-center text-zinc-700">{formatDate(row.expired_at)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={statusMeta.className}>{statusMeta.label}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaffId(row.admin_id)
                              setStaffQueryInput(row.admin_name)
                              setViewMode('single')
                              setAnchorDate(new Date(leaveBoardMonth.getFullYear(), leaveBoardMonth.getMonth(), 1))
                            }}
                            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
