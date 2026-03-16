'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Settings } from 'lucide-react'
import {
  type ClientAttendanceCalendarDay,
  type ClientAttendanceMonthlySummaryItem,
  type ClientAttendanceMonthlySettlementItem,
  type ClientAttendancePolicy,
  type ClientAttendanceBoardItem,
  deleteClientAttendanceCalendarDay,
  getClientAttendanceCalendar,
  getClientAttendancePolicy,
  getClientStaffAttendanceBoard,
  getClientStaffAttendanceMonthlySettlement,
  getClientStaffAttendanceMonthlySummary,
  getClientStaffs,
  upsertClientAttendanceCalendarDay,
  updateClientAttendancePolicy,
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
type LeaveDayType = 'full' | 'half'
type AllBoardMode = 'attendance' | 'leave'

const weekdayHeaders = ['월', '화', '수', '목', '금', '토', '일']
const ALL_STAFF_LABEL = '전체 직원'
const inputClass =
  'h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const secondaryButtonClass =
  'inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50'
const TIMELINE_START_HOUR = 6
const TIMELINE_END_HOUR = 22
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60
const DEFAULT_POLICY: ClientAttendancePolicy = {
  client_id: 0,
  timezone: 'Asia/Seoul',
  work_start_time: '09:00:00',
  work_end_time: '18:00:00',
  late_grace_minutes: 0,
  half_day_minutes: 240,
  quarter_day_minutes: 120,
  is_half_day_enabled: true,
  is_quarter_day_enabled: true,
}

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

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0)
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

function toTimeInputValue(value: string | null | undefined) {
  if (!value) return ''
  const matched = String(value).match(/^\d{2}:\d{2}/)
  if (matched) return matched[0]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function toSecondsTime(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '00:00:00'
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  return trimmed
}

function formatLeaveUnitHint(value: string | null | undefined) {
  if (!value) return null
  if (value === 'half_day') return '권장: 반차'
  if (value === 'quarter_day') return '권장: 반반차'
  if (value === 'hourly') return '권장: 시간차'
  return null
}

function normalizeCalendarRows(
  payload: { items?: ClientAttendanceCalendarDay[] } | ClientAttendanceCalendarDay[] | null | undefined
) {
  if (!payload) return [] as ClientAttendanceCalendarDay[]
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  return [] as ClientAttendanceCalendarDay[]
}

function formatHoursFromMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0시간'
  const hour = Math.floor(value / 60)
  const minute = value % 60
  if (hour > 0 && minute > 0) return `${hour}시간 ${minute}분`
  if (hour > 0) return `${hour}시간`
  return `${minute}분`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toMinutesInDay(value: string | null | undefined) {
  const normalized = formatTime(value)
  const match = normalized.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function buildLeaveDayMap(requests: AnnualLeaveRequest[]) {
  const result = new Map<string, LeaveDayType>()
  for (const request of requests) {
    const start = parseDateOnly(request.start_date)
    const end = parseDateOnly(request.end_date)
    if (!start || !end) continue
    const isHalf = start.getTime() === end.getTime() && Number(request.days || 0) <= 0.5
    const leaveType: LeaveDayType = isHalf ? 'half' : 'full'
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())

    while (cursor.getTime() <= end.getTime()) {
      const key = `${request.admin_id}:${toDateParam(cursor)}`
      const current = result.get(key)
      if (current !== 'full') {
        result.set(key, leaveType)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return result
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
  const [allBoardMode, setAllBoardMode] = useState<AllBoardMode>('attendance')
  const [attendanceSettingsOpen, setAttendanceSettingsOpen] = useState(false)
  const [policy, setPolicy] = useState<ClientAttendancePolicy>(DEFAULT_POLICY)
  const [policyForm, setPolicyForm] = useState({
    timezone: 'Asia/Seoul',
    work_start_time: '09:00',
    work_end_time: '18:00',
    late_grace_minutes: 0,
    half_day_minutes: 240,
    quarter_day_minutes: 120,
    is_half_day_enabled: true,
    is_quarter_day_enabled: true,
  })
  const [policySaving, setPolicySaving] = useState(false)
  const [policyVersion, setPolicyVersion] = useState(0)
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false)
  const [monthlySummaryItems, setMonthlySummaryItems] = useState<ClientAttendanceMonthlySummaryItem[]>([])
  const [monthlySettlementLoading, setMonthlySettlementLoading] = useState(false)
  const [monthlySettlementItems, setMonthlySettlementItems] = useState<ClientAttendanceMonthlySettlementItem[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [calendarItems, setCalendarItems] = useState<ClientAttendanceCalendarDay[]>([])
  const [calendarForm, setCalendarForm] = useState<{
    target_date: string
    day_type: 'holiday' | 'workday'
    name: string
    note: string
  }>({
    target_date: '',
    day_type: 'holiday',
    name: '',
    note: '',
  })

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
  const applyPolicy = (value: ClientAttendancePolicy | null | undefined) => {
    if (!value) return
    setPolicy(value)
    setPolicyForm({
      timezone: value.timezone || 'Asia/Seoul',
      work_start_time: toTimeInputValue(value.work_start_time) || '09:00',
      work_end_time: toTimeInputValue(value.work_end_time) || '18:00',
      late_grace_minutes: Number(value.late_grace_minutes || 0),
      half_day_minutes: Number(value.half_day_minutes || 240),
      quarter_day_minutes: Number(value.quarter_day_minutes || 120),
      is_half_day_enabled: Boolean(value.is_half_day_enabled),
      is_quarter_day_enabled: Boolean(value.is_quarter_day_enabled),
    })
  }

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
    const loadPolicy = async () => {
      try {
        const res = await getClientAttendancePolicy()
        if (!mounted) return
        applyPolicy(res)
      } catch {
        if (!mounted) return
        applyPolicy(DEFAULT_POLICY)
      }
    }
    void loadPolicy()
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
    if (!attendanceSettingsOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAttendanceSettingsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [attendanceSettingsOpen])

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
        if (res.policy) applyPolicy(res.policy)
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
        if (res.policy) applyPolicy(res.policy)
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
  }, [viewMode, anchorDate, offset, limit, selectedStaffId, staffs, policyVersion])

  useEffect(() => {
    let mounted = true
    const loadMonthlySummary = async () => {
      if (viewMode !== 'all') return
      try {
        setMonthlySummaryLoading(true)
        const year = anchorDate.getFullYear()
        const month = anchorDate.getMonth() + 1
        const res = await getClientStaffAttendanceMonthlySummary({
          year,
          month,
          offset: 0,
          limit: 200,
        })
        if (!mounted) return
        setMonthlySummaryItems(Array.isArray(res.items) ? res.items : [])
      } catch {
        if (!mounted) return
        setMonthlySummaryItems([])
      } finally {
        if (mounted) setMonthlySummaryLoading(false)
      }
    }
    void loadMonthlySummary()
    return () => {
      mounted = false
    }
  }, [anchorDate, viewMode, policyVersion])

  useEffect(() => {
    let mounted = true
    const loadMonthlySettlement = async () => {
      if (viewMode !== 'all') return
      try {
        setMonthlySettlementLoading(true)
        const year = anchorDate.getFullYear()
        const month = anchorDate.getMonth() + 1
        const res = await getClientStaffAttendanceMonthlySettlement({
          year,
          month,
          offset: 0,
          limit: 200,
        })
        if (!mounted) return
        setMonthlySettlementItems(Array.isArray(res.items) ? res.items : [])
      } catch {
        if (!mounted) return
        setMonthlySettlementItems([])
      } finally {
        if (mounted) setMonthlySettlementLoading(false)
      }
    }
    void loadMonthlySettlement()
    return () => {
      mounted = false
    }
  }, [anchorDate, viewMode, policyVersion])

  useEffect(() => {
    let mounted = true
    const loadCalendar = async () => {
      if (viewMode !== 'all') return
      try {
        setCalendarLoading(true)
        const monthStart = startOfMonth(anchorDate)
        const monthEnd = endOfMonth(anchorDate)
        const res = await getClientAttendanceCalendar({
          year: anchorDate.getFullYear(),
          month: anchorDate.getMonth() + 1,
          date_from: toDateParam(monthStart),
          date_to: toDateParam(monthEnd),
        })
        if (!mounted) return
        setCalendarItems(normalizeCalendarRows(res))
      } catch {
        if (!mounted) return
        setCalendarItems([])
      } finally {
        if (mounted) setCalendarLoading(false)
      }
    }
    void loadCalendar()
    return () => {
      mounted = false
    }
  }, [anchorDate, viewMode, policyVersion])

  useEffect(() => {
    if (calendarForm.target_date) return
    setCalendarForm((prev) => ({ ...prev, target_date: toDateParam(anchorDate) }))
  }, [anchorDate, calendarForm.target_date])

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
    const map = new Map<
      string,
      {
        check_in: string | null
        check_out: string | null
        worked_minutes: number
        is_holiday?: boolean
        late_minutes?: number
        early_leave_minutes?: number
        short_minutes?: number
        overtime_minutes?: number
      }
    >()
    if (!selectedMonthItem) return map
    for (const day of selectedMonthItem.days) {
      map.set(day.date, {
        check_in: day.check_in,
        check_out: day.check_out,
        worked_minutes: day.worked_minutes,
        is_holiday: day.is_holiday,
        late_minutes: day.late_minutes,
        early_leave_minutes: day.early_leave_minutes,
        short_minutes: day.short_minutes,
        overtime_minutes: day.overtime_minutes,
      })
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
  const approvedLeaveDayMap = useMemo(() => buildLeaveDayMap(approvedLeaveRequests), [approvedLeaveRequests])
  const leaveSummaryByAdminId = useMemo(() => {
    const map = new Map<number, (typeof leaveSummaryRows)[number]>()
    leaveSummaryRows.forEach((row) => {
      map.set(Number(row.admin_id), row)
    })
    return map
  }, [leaveSummaryRows])
  const allViewColumnCount = useMemo(() => {
    if (allBoardMode === 'attendance') return Math.max(2, weekColumns.length + 1)
    return 6
  }, [allBoardMode, weekColumns.length])
  const monthlySummaryTotals = useMemo(() => {
    return monthlySummaryItems.reduce(
      (acc, item) => {
        acc.staffCount += 1
        acc.lateDays += Number(item.late_days || 0)
        acc.lateMinutes += Number(item.total_late_minutes || 0)
        acc.earlyLeaveDays += Number(item.early_leave_days || 0)
        acc.earlyLeaveMinutes += Number(item.total_early_leave_minutes || 0)
        acc.shortMinutes += Number(item.total_short_minutes || 0)
        return acc
      },
      { staffCount: 0, lateDays: 0, lateMinutes: 0, earlyLeaveDays: 0, earlyLeaveMinutes: 0, shortMinutes: 0 }
    )
  }, [monthlySummaryItems])
  const monthlySummarySorted = useMemo(() => {
    return [...monthlySummaryItems]
      .sort((a, b) => {
        const bScore = Number(b.total_short_minutes || 0) + Number(b.total_late_minutes || 0) + Number(b.total_early_leave_minutes || 0)
        const aScore = Number(a.total_short_minutes || 0) + Number(a.total_late_minutes || 0) + Number(a.total_early_leave_minutes || 0)
        return bScore - aScore
      })
      .slice(0, 10)
  }, [monthlySummaryItems])
  const monthlySettlementTotals = useMemo(() => {
    return monthlySettlementItems.reduce(
      (acc, item) => {
        const overtimeMinutes = Number(
          (item.total_overtime_minutes as number | undefined) ?? (item.overtime_minutes as number | undefined) ?? 0
        )
        const payableMinutes = Number(
          (item.payable_minutes as number | undefined) ??
            (item.total_payable_minutes as number | undefined) ??
            ((item.weighted_overtime_minutes as number | undefined) || 0) +
              ((item.total_worked_minutes as number | undefined) || 0) -
              ((item.total_short_minutes as number | undefined) || 0)
        )
        acc.staffCount += 1
        acc.overtimeMinutes += overtimeMinutes
        acc.payableMinutes += Math.max(0, payableMinutes)
        return acc
      },
      { staffCount: 0, overtimeMinutes: 0, payableMinutes: 0 }
    )
  }, [monthlySettlementItems])
  const monthlySettlementSorted = useMemo(() => {
    return [...monthlySettlementItems]
      .sort((a, b) => {
        const bScore = Number(
          (b.payable_minutes as number | undefined) ??
            (b.total_payable_minutes as number | undefined) ??
            (b.total_worked_minutes as number | undefined) ??
            0
        )
        const aScore = Number(
          (a.payable_minutes as number | undefined) ??
            (a.total_payable_minutes as number | undefined) ??
            (a.total_worked_minutes as number | undefined) ??
            0
        )
        return bScore - aScore
      })
      .slice(0, 10)
  }, [monthlySettlementItems])
  const calendarByDate = useMemo(() => {
    const map = new Map<string, ClientAttendanceCalendarDay>()
    calendarItems.forEach((item) => {
      if (item?.target_date) map.set(item.target_date, item)
    })
    return map
  }, [calendarItems])

  const handleSavePolicy = async () => {
    const startMinutes = toMinutesInDay(policyForm.work_start_time)
    const endMinutes = toMinutesInDay(policyForm.work_end_time)
    const lateGraceMinutes = Number(policyForm.late_grace_minutes)
    const halfDayMinutes = Number(policyForm.half_day_minutes)
    const quarterDayMinutes = Number(policyForm.quarter_day_minutes)

    if (startMinutes == null || endMinutes == null) {
      toast.error('출근/퇴근 시간을 확인해주세요.')
      return
    }
    if (endMinutes <= startMinutes) {
      toast.error('퇴근 시각은 출근 시각보다 늦어야 합니다.')
      return
    }
    if (lateGraceMinutes < 0 || halfDayMinutes < 0 || quarterDayMinutes < 0) {
      toast.error('분 단위 값은 0 이상이어야 합니다.')
      return
    }
    if (halfDayMinutes < quarterDayMinutes) {
      toast.error('반차 기준은 반반차 기준보다 크거나 같아야 합니다.')
      return
    }

    try {
      setPolicySaving(true)
      const payload = {
        timezone: policyForm.timezone || 'Asia/Seoul',
        work_start_time: toSecondsTime(policyForm.work_start_time),
        work_end_time: toSecondsTime(policyForm.work_end_time),
        late_grace_minutes: Math.floor(lateGraceMinutes),
        half_day_minutes: Math.floor(halfDayMinutes),
        quarter_day_minutes: Math.floor(quarterDayMinutes),
        is_half_day_enabled: Boolean(policyForm.is_half_day_enabled),
        is_quarter_day_enabled: Boolean(policyForm.is_quarter_day_enabled),
      }
      const res = await updateClientAttendancePolicy(payload)
      applyPolicy(res)
      setPolicyVersion((prev) => prev + 1)
      toast.success('근무정책을 저장했습니다.')
    } catch {
      toast.error('근무정책 저장에 실패했습니다.')
    } finally {
      setPolicySaving(false)
    }
  }

  const handleSaveCalendarDay = async () => {
    const targetDate = calendarForm.target_date
    if (!targetDate) {
      toast.error('적용 날짜를 선택해 주세요.')
      return
    }

    try {
      setCalendarSaving(true)
      await upsertClientAttendanceCalendarDay({
        target_date: targetDate,
        day_type: calendarForm.day_type,
        name: calendarForm.name || undefined,
        note: calendarForm.note || undefined,
      })
      setPolicyVersion((prev) => prev + 1)
      toast.success('캘린더 적용일을 저장했습니다.')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '캘린더 저장에 실패했습니다.')
    } finally {
      setCalendarSaving(false)
    }
  }

  const handleDeleteCalendarDay = async () => {
    const targetDate = calendarForm.target_date
    if (!targetDate) {
      toast.error('삭제할 날짜를 선택해 주세요.')
      return
    }
    try {
      setCalendarSaving(true)
      await deleteClientAttendanceCalendarDay(targetDate)
      setPolicyVersion((prev) => prev + 1)
      toast.success('캘린더 오버라이드를 삭제했습니다.')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '캘린더 삭제에 실패했습니다.')
    } finally {
      setCalendarSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className={`grid grid-cols-1 items-start gap-4 ${viewMode === 'all' ? 'xl:grid-cols-1' : 'xl:grid-cols-2'}`}>
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
                  <div className="flex items-center justify-end gap-2">
                    <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setAllBoardMode('attendance')}
                        className={`rounded px-2 py-1 text-[11px] font-medium ${
                          allBoardMode === 'attendance' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        근태
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllBoardMode('leave')}
                        className={`rounded px-2 py-1 text-[11px] font-medium ${
                          allBoardMode === 'leave' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        휴가요약
                      </button>
                    </div>
                    <p className="text-right text-xs text-zinc-600">
                      전체 {weekStaffTotal.toLocaleString('ko-KR')}명
                    </p>
                    <button
                      type="button"
                      onClick={() => setAttendanceSettingsOpen(true)}
                      className={secondaryButtonClass}
                      title="근무정책/예외 설정"
                    >
                      <Settings className="mr-1 h-3.5 w-3.5" />
                      설정
                    </button>
                  </div>
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
                      {allBoardMode === 'attendance' ? (
                        weekColumns.map((column) => (
                          <th
                            key={column.date}
                            className={`min-w-[65px] border-r border-zinc-100 px-2 py-2 text-center ${getWeekdayTextClass(column.weekday_index)}`}
                          >
                            {column.date.slice(5)} ({column.weekday})
                          </th>
                        ))
                      ) : (
                        <>
                          <th className="border-r border-zinc-100 px-3 py-2 text-right">부여연차</th>
                          <th className="border-r border-zinc-100 px-3 py-2 text-right">사용연차</th>
                          <th className="border-r border-zinc-100 px-3 py-2 text-right">잔여연차</th>
                          <th className="border-r border-zinc-100 px-3 py-2 text-center">만료일</th>
                          <th className="px-3 py-2 text-center">상태</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {loading ? (
                      <tr>
                        <td colSpan={allViewColumnCount} className="px-3 py-10 text-center text-zinc-500">
                          조회 중...
                        </td>
                      </tr>
                    ) : weekItems.length === 0 ? (
                      <tr>
                        <td colSpan={allViewColumnCount} className="px-3 py-10 text-center text-zinc-500">
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
                            {allBoardMode === 'attendance' ? (
                              weekColumns.map((column) => {
                                const day = dayMap.get(column.date)
                                const leaveType = approvedLeaveDayMap.get(`${row.admin_id}:${column.date}`)
                                const hasLog =
                                  Boolean(day?.check_in) || Boolean(day?.check_out) || Number(day?.worked_minutes || 0) > 0
                                const isHoliday = Boolean(day?.is_holiday)
                                const lateMinutes = Number(day?.late_minutes || 0)
                                const earlyLeaveMinutes = Number(day?.early_leave_minutes || 0)
                                const shortMinutes = Number(day?.short_minutes || 0)
                                const overtimeMinutes = Number(day?.overtime_minutes || 0)
                                const leaveUnitHint = formatLeaveUnitHint(day?.leave_unit_hint)
                                const arrivalStatus = day?.arrival_status || 'unknown'
                                const departureStatus = day?.departure_status || 'unknown'
                                const checkInMinutes = toMinutesInDay(day?.check_in)
                                const checkOutMinutes = toMinutesInDay(day?.check_out)
                                const barStart =
                                  checkInMinutes != null
                                    ? clamp(checkInMinutes, TIMELINE_START_HOUR * 60, TIMELINE_END_HOUR * 60)
                                    : null
                                const barEnd =
                                  checkOutMinutes != null
                                    ? clamp(checkOutMinutes, TIMELINE_START_HOUR * 60, TIMELINE_END_HOUR * 60)
                                    : null
                                const hasTimeline =
                                  barStart != null &&
                                  barEnd != null &&
                                  Number.isFinite(barStart) &&
                                  Number.isFinite(barEnd) &&
                                  barEnd > barStart
                                const barLeftPct = hasTimeline
                                  ? ((barStart - TIMELINE_START_HOUR * 60) / TIMELINE_TOTAL_MINUTES) * 100
                                  : 0
                                const barWidthPct = hasTimeline ? ((barEnd - barStart) / TIMELINE_TOTAL_MINUTES) * 100 : 0
                                const cellBoxClass = leaveType
                                  ? leaveType === 'half'
                                    ? 'rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-[10px] text-amber-800'
                                    : 'rounded-md border border-violet-200 bg-violet-50 px-1.5 py-1 text-[10px] text-violet-800'
                                  : hasLog
                                    ? 'rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] text-sky-800'
                                    : ''

                                return (
                                  <td key={`${row.admin_id}-${column.date}`} className="border-r border-zinc-100 px-2 py-1.5 text-center align-top">
                                    {hasLog || leaveType ? (
                                      <div className={cellBoxClass}>
                                        {hasLog ? (
                                          <div className="mb-0.5 text-[10px] font-medium text-zinc-700">
                                            {formatTime(day?.check_in)} ~ {formatTime(day?.check_out)}
                                          </div>
                                        ) : null}
                                        <div className="mb-0.5 flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-semibold">
                                            {leaveType ? (leaveType === 'half' ? '반차' : '휴가') : '근태'}
                                          </span>
                                          {isHoliday ? <span className="text-[10px] font-medium text-rose-700">휴일</span> : null}
                                        </div>
                                        {hasTimeline ? (
                                          <div className="mb-1 h-1.5 w-full rounded-full bg-zinc-200/70">
                                            <div
                                              className={`h-1.5 rounded-full ${
                                                leaveType === 'full'
                                                  ? 'bg-violet-500'
                                                  : leaveType === 'half'
                                                    ? 'bg-amber-500'
                                                    : 'bg-sky-500'
                                              }`}
                                              style={{ marginLeft: `${barLeftPct}%`, width: `${barWidthPct}%` }}
                                            />
                                          </div>
                                        ) : null}
                                        <div className="mt-0.5 border-t border-current/15 pt-0.5 text-[10px] opacity-80">
                                          근무시간 {formatWorkedMinutes(day?.worked_minutes)}
                                        </div>
                                        {lateMinutes > 0 ||
                                        earlyLeaveMinutes > 0 ||
                                        shortMinutes > 0 ||
                                        overtimeMinutes > 0 ||
                                        leaveUnitHint ||
                                        arrivalStatus === 'on_time' ||
                                        departureStatus === 'normal' ? (
                                          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px]">
                                            {lateMinutes > 0 ? (
                                              <span className="font-medium text-rose-600">지각 {lateMinutes}분</span>
                                            ) : arrivalStatus === 'on_time' ? (
                                              <span className="font-medium text-emerald-700">정시 출근</span>
                                            ) : (
                                              <span />
                                            )}
                                            {earlyLeaveMinutes > 0 ? (
                                              <span className="font-medium text-orange-700">조퇴 {earlyLeaveMinutes}분</span>
                                            ) : departureStatus === 'normal' ? (
                                              <span className="font-medium text-emerald-700">정상 퇴근</span>
                                            ) : null}
                                            {shortMinutes > 0 ? <span className="font-medium text-amber-700">부족 {shortMinutes}분</span> : null}
                                            {overtimeMinutes > 0 ? <span className="font-medium text-blue-700">초과 {overtimeMinutes}분</span> : null}
                                            {leaveUnitHint ? <span className="font-medium text-emerald-700">{leaveUnitHint}</span> : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-zinc-300">-</span>
                                    )}
                                  </td>
                                )
                              })
                            ) : (
                              (() => {
                                const leaveRow = leaveSummaryByAdminId.get(Number(row.admin_id))
                                const grantedDays = Number(leaveRow?.granted_days || 0)
                                const consumedDays = Number(leaveRow?.consumed_days || 0)
                                const remainingDays = Number(leaveRow?.remaining_days || 0)
                                const expiredAt = leaveRow?.expired_at || null
                                const statusMeta = getLeaveStatusMeta({ remaining_days: remainingDays, expired_at: expiredAt })

                                return (
                                  <>
                                    <td className="border-r border-zinc-100 px-3 py-2 text-right text-zinc-700">{grantedDays.toLocaleString('ko-KR')}</td>
                                    <td className="border-r border-zinc-100 px-3 py-2 text-right text-zinc-700">{consumedDays.toLocaleString('ko-KR')}</td>
                                    <td className="border-r border-zinc-100 px-3 py-2 text-right font-semibold text-zinc-900">
                                      {remainingDays.toLocaleString('ko-KR')}
                                    </td>
                                    <td className="border-r border-zinc-100 px-3 py-2 text-center text-zinc-700">{formatDate(expiredAt)}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={statusMeta.className}>{statusMeta.label}</span>
                                    </td>
                                  </>
                                )
                              })()
                            )}
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
                  const isHoliday = Boolean(log?.is_holiday)
                  const weekdayIndex = (cell.date.getDay() + 6) % 7
                  const dayTextClass = weekdayIndex === 6 ? 'text-rose-600' : weekdayIndex === 5 ? 'text-blue-600' : 'text-zinc-700'

                  return (
                    <div key={dateKey} className="h-28 rounded-md border border-zinc-200 bg-white p-2">
                      <p className={`text-sm font-semibold ${dayTextClass}`}>{cell.dayNumber}</p>
                      {hasLog ? (
                        <div className="mt-1 space-y-0.5 text-[11px] text-zinc-700">
                          {isHoliday ? (
                            <div>
                              <span className="inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">휴일</span>
                            </div>
                          ) : null}
                          <div>
                            <span className="text-zinc-500">출근 </span>
                            <span className="font-medium text-zinc-900">{formatTime(log?.check_in)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">퇴근 </span>
                            <span className="font-medium text-zinc-900">{formatTime(log?.check_out)}</span>
                          </div>
                          <div className="text-zinc-500">{formatWorkedMinutes(log?.worked_minutes)}</div>
                          {Number(log?.late_minutes || 0) > 0 ? (
                            <div className="text-rose-600">지각 {Number(log?.late_minutes || 0)}분</div>
                          ) : null}
                          {Number(log?.early_leave_minutes || 0) > 0 ? (
                            <div className="text-orange-700">조퇴 {Number(log?.early_leave_minutes || 0)}분</div>
                          ) : null}
                          {Number(log?.overtime_minutes || 0) > 0 ? (
                            <div className="text-blue-700">초과 {Number(log?.overtime_minutes || 0)}분</div>
                          ) : null}
                          {Number(log?.short_minutes || 0) > 0 ? (
                            <div className="text-amber-700">부족 {Number(log?.short_minutes || 0)}분</div>
                          ) : null}
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
        {viewMode === 'single' ? (
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
        ) : null}
      </div>
      {attendanceSettingsOpen && viewMode === 'all' ? (
        <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setAttendanceSettingsOpen(false)}>
          <div
            className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">근무정책 / 근무일 예외 설정</p>
                <p className="text-xs text-zinc-500">근무 기준 시간과 특정일 예외(휴일/근무일)를 설정합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceSettingsOpen(false)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">근무정책</h3>
                  <button type="button" onClick={handleSavePolicy} disabled={policySaving} className={secondaryButtonClass}>
                    {policySaving ? '저장 중...' : '정책 저장'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">출근 시각</span>
                    <input
                      type="time"
                      className={inputClass}
                      value={policyForm.work_start_time}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, work_start_time: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">퇴근 시각</span>
                    <input
                      type="time"
                      className={inputClass}
                      value={policyForm.work_end_time}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, work_end_time: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">지각 유예(분)</span>
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={policyForm.late_grace_minutes}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, late_grace_minutes: Number(e.target.value || 0) }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">타임존</span>
                    <input
                      type="text"
                      className={`${inputClass} bg-zinc-50`}
                      value={policyForm.timezone}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">반차 기준(분)</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!policyForm.is_half_day_enabled}
                      className={`${inputClass} ${!policyForm.is_half_day_enabled ? 'cursor-not-allowed bg-zinc-100 text-zinc-400' : ''}`}
                      value={policyForm.half_day_minutes}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, half_day_minutes: Number(e.target.value || 0) }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">반반차 기준(분)</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!policyForm.is_quarter_day_enabled}
                      className={`${inputClass} ${!policyForm.is_quarter_day_enabled ? 'cursor-not-allowed bg-zinc-100 text-zinc-400' : ''}`}
                      value={policyForm.quarter_day_minutes}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, quarter_day_minutes: Number(e.target.value || 0) }))}
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={policyForm.is_half_day_enabled}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, is_half_day_enabled: e.target.checked }))}
                    />
                    반차 사용
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={policyForm.is_quarter_day_enabled}
                      onChange={(e) => setPolicyForm((prev) => ({ ...prev, is_quarter_day_enabled: e.target.checked }))}
                    />
                    반반차 사용
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    근무일 예외 설정 ({anchorDate.getFullYear()}년 {anchorDate.getMonth() + 1}월)
                  </h3>
                  {calendarLoading ? <span className="text-xs text-zinc-500">불러오는 중...</span> : null}
                </div>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">적용 날짜</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={calendarForm.target_date}
                      onChange={(e) => {
                        const nextDate = e.target.value
                        const selected = calendarByDate.get(nextDate)
                        setCalendarForm((prev) => ({
                          ...prev,
                          target_date: nextDate,
                          day_type: selected?.day_type || prev.day_type,
                          name: selected?.name || '',
                          note: selected?.note || '',
                        }))
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">유형</span>
                    <select
                      className={inputClass}
                      value={calendarForm.day_type}
                      onChange={(e) =>
                        setCalendarForm((prev) => ({ ...prev, day_type: e.target.value === 'workday' ? 'workday' : 'holiday' }))
                      }
                    >
                      <option value="holiday">휴일</option>
                      <option value="workday">근무일</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">명칭</span>
                    <input
                      type="text"
                      className={inputClass}
                      value={calendarForm.name}
                      onChange={(e) => setCalendarForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="예: 창립기념일"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-600">메모</span>
                    <input
                      type="text"
                      className={inputClass}
                      value={calendarForm.note}
                      onChange={(e) => setCalendarForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="선택 입력"
                    />
                  </label>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={handleSaveCalendarDay} disabled={calendarSaving} className={secondaryButtonClass}>
                    {calendarSaving ? '저장 중...' : '예외일 저장'}
                  </button>
                  <button type="button" onClick={handleDeleteCalendarDay} disabled={calendarSaving} className={secondaryButtonClass}>
                    예외일 삭제
                  </button>
                  <p className="text-xs text-zinc-500">기본 규칙(주말 휴무)에서 제외할 날짜를 휴일/근무일로 지정합니다.</p>
                </div>
                <div className="overflow-x-auto rounded-md border border-zinc-200">
                  <table className="min-w-[640px] w-full text-xs">
                    <thead className="bg-zinc-50 text-zinc-600">
                      <tr>
                        <th className="px-2 py-2 text-left">날짜</th>
                        <th className="px-2 py-2 text-left">유형</th>
                        <th className="px-2 py-2 text-left">명칭</th>
                        <th className="px-2 py-2 text-left">메모</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {calendarItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                            등록된 예외일이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        [...calendarItems]
                          .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))
                          .map((item) => (
                            <tr
                              key={item.id}
                              className="cursor-pointer hover:bg-zinc-50"
                              onClick={() =>
                                setCalendarForm({
                                  target_date: item.target_date,
                                  day_type: item.day_type,
                                  name: item.name || '',
                                  note: item.note || '',
                                })
                              }
                            >
                              <td className="px-2 py-2 text-zinc-900">{item.target_date}</td>
                              <td className="px-2 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    item.day_type === 'holiday' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {item.day_type === 'holiday' ? '휴일' : '근무일'}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-zinc-700">{item.name || '-'}</td>
                              <td className="px-2 py-2 text-zinc-500">{item.note || '-'}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
