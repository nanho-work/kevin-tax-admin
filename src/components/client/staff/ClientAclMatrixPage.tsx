'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  reorderDepartments,
  updateDepartment,
} from '@/services/client/departmentService'
import {
  getPermissionCodes,
  getStaffPermissions,
  updateStaffPermissions,
} from '@/services/client/clientPermissionService'
import { getClientStaffs } from '@/services/client/clientStaffService'
import { createRole, deleteRole, getRoles, reorderRoles } from '@/services/client/roleService'
import { createTeam, deleteTeam, getTeams, reorderTeams, updateTeam } from '@/services/client/teamService'
import type { AdminOut } from '@/types/admin'
import type { PermissionCodeOut } from '@/types/clientPermission'
import type { DepartmentOut } from '@/types/department'
import type { RoleOut } from '@/types/role'
import type { TeamOut } from '@/types/team'
import { getRoleRank } from '@/utils/roleRank'

type StaffPermissionRow = {
  staff: AdminOut
  values: Record<string, boolean>
  baseline: Record<string, boolean>
  saving: boolean
}

type DrawerType = 'department' | 'team' | 'role' | null

const ACL_EXCLUDED_CODES = new Set(['annual_leave.read', 'attendance.read'])

function buildCodeMap(codes: PermissionCodeOut[], source?: { code: string; is_allowed: boolean }[]) {
  const map: Record<string, boolean> = {}
  const allowed = new Map((source || []).map((item) => [item.code, item.is_allowed]))
  codes.forEach((code) => {
    map[code.code] = Boolean(allowed.get(code.code))
  })
  return map
}

function hasChanges(row: StaffPermissionRow, codes: PermissionCodeOut[]) {
  return codes.some((code) => row.values[code.code] !== row.baseline[code.code])
}

function getErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim().length > 0) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first?.msg === 'string') return first.msg
  }
  return fallback
}

function filterAclCodes(items: PermissionCodeOut[]) {
  return (items || []).filter((code) => !ACL_EXCLUDED_CODES.has(code.code))
}

export default function ClientAclMatrixPage() {
  const { session } = useClientSessionContext()
  const companyName = (session as any)?.client_company_name || `회사 ${session?.client_id ?? ''}`.trim()
  const ownerName = session?.name || '관리자'
  const [activeTab, setActiveTab] = useState<'org' | 'acl'>('org')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState<DrawerType>(null)

  const [codes, setCodes] = useState<PermissionCodeOut[]>([])
  const [rows, setRows] = useState<StaffPermissionRow[]>([])
  const [aclLoading, setAclLoading] = useState(true)
  const [aclError, setAclError] = useState<string | null>(null)

  const [departments, setDepartments] = useState<DepartmentOut[]>([])
  const [teams, setTeams] = useState<TeamOut[]>([])
  const [roles, setRoles] = useState<RoleOut[]>([])
  const [orgStaffs, setOrgStaffs] = useState<AdminOut[]>([])
  const [orgLoading, setOrgLoading] = useState(true)

  const [departmentName, setDepartmentName] = useState('')
  const [departmentDescription, setDepartmentDescription] = useState('')
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false)
  const [departmentReordering, setDepartmentReordering] = useState(false)
  const [draggingDepartmentId, setDraggingDepartmentId] = useState<number | null>(null)
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null)
  const [editingDepartmentName, setEditingDepartmentName] = useState('')
  const [editingDepartmentSaving, setEditingDepartmentSaving] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [teamDepartmentId, setTeamDepartmentId] = useState<number | ''>('')
  const [teamSubmitting, setTeamSubmitting] = useState(false)
  const [teamReordering, setTeamReordering] = useState(false)
  const [draggingTeamId, setDraggingTeamId] = useState<number | null>(null)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [editingTeamSaving, setEditingTeamSaving] = useState(false)
  const departmentRowRef = useRef<HTMLDivElement | null>(null)
  const departmentNodeRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const teamRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const teamNodeRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [departmentLine, setDepartmentLine] = useState({ left: 0, width: 0 })
  const [teamLines, setTeamLines] = useState<Record<string, { left: number; width: number }>>({})

  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleReordering, setRoleReordering] = useState(false)

  const groupedCodes = useMemo(() => {
    const grouped = new Map<string, PermissionCodeOut[]>()
    codes.forEach((code) => {
      const prev = grouped.get(code.group_name) || []
      prev.push(code)
      grouped.set(code.group_name, prev)
    })
    return [...grouped.entries()]
  }, [codes])

  const roleRankById = useMemo(() => {
    const map = new Map<number, number>()
    roles.forEach((role) => {
      map.set(role.id, getRoleRank(role))
    })
    return map
  }, [roles])

  const staffByTeamId = useMemo(() => {
    const map = new Map<number, AdminOut[]>()
    orgStaffs.forEach((staff) => {
      const teamId = staff.team_id ?? staff.team?.id
      if (!teamId) return
      const prev = map.get(teamId) || []
      prev.push(staff)
      map.set(teamId, prev)
    })
    map.forEach((members, teamId) => {
      members.sort((a, b) => {
        const rankA =
          typeof a.rank_order === 'number'
            ? a.rank_order
            : a.role_id
              ? roleRankById.get(a.role_id) ?? 999
              : 999
        const rankB =
          typeof b.rank_order === 'number'
            ? b.rank_order
            : b.role_id
              ? roleRankById.get(b.role_id) ?? 999
              : 999
        if (rankA !== rankB) return rankA - rankB
        const nameCompared = a.name.localeCompare(b.name, 'ko')
        if (nameCompared !== 0) return nameCompared
        return a.id - b.id
      })
      map.set(teamId, members)
    })
    return map
  }, [orgStaffs, roleRankById])

  const teamsByDepartmentId = useMemo(() => {
    const map = new Map<number, TeamOut[]>()
    teams.forEach((team) => {
      if (!team.department_id) return
      const prev = map.get(team.department_id) || []
      prev.push(team)
      map.set(team.department_id, prev)
    })
    return map
  }, [teams])

  const unassignedTeams = useMemo(() => teams.filter((team) => !team.department_id), [teams])

  const roleNameById = useMemo(() => {
    const map = new Map<number, string>()
    roles.forEach((role) => {
      map.set(role.id, role.name)
    })
    return map
  }, [roles])

  const loadAllClientStaffs = async () => {
    const limit = 100
    let pageCursor = 1
    let total = 0
    const merged: AdminOut[] = []
    do {
      const res = await getClientStaffs(pageCursor, limit)
      merged.push(...(res.items || []))
      total = res.total || 0
      pageCursor += 1
    } while (merged.length < total)
    return (merged || []).filter((staff) => staff.is_active)
  }

  const loadOrganizationResources = async () => {
    try {
      setOrgLoading(true)
      const [departmentItems, teamItems, roleItems, staffItems] = await Promise.all([
        getDepartments(),
        getTeams(),
        getRoles(),
        loadAllClientStaffs(),
      ])
      setDepartments((departmentItems || []).slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
      setTeams(
        (teamItems || [])
          .slice()
          .sort((a, b) => {
            const depA = a.department_id ?? Number.MAX_SAFE_INTEGER
            const depB = b.department_id ?? Number.MAX_SAFE_INTEGER
            if (depA !== depB) return depA - depB
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
            return a.id - b.id
          })
      )
      setRoles((roleItems || []).slice().sort((a, b) => getRoleRank(a) - getRoleRank(b) || a.name.localeCompare(b.name, 'ko')))
      setOrgStaffs((staffItems || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')))
    } catch (error) {
      toast.error(getErrorMessage(error, '조직 정보를 불러오지 못했습니다.'))
      setDepartments([])
      setTeams([])
      setRoles([])
      setOrgStaffs([])
    } finally {
      setOrgLoading(false)
    }
  }

  useEffect(() => {
    void loadOrganizationResources()
  }, [])

  useEffect(() => {
    const loadAcl = async () => {
      try {
        setAclLoading(true)
        setAclError(null)

        const [codeRes, staffRes] = await Promise.all([getPermissionCodes(true), getClientStaffs(1, 100)])
        const codeItems = filterAclCodes(codeRes.items || [])
        const staffItems = (staffRes.items || []).filter((staff) => staff.is_active)

        const permissionResponses = await Promise.all(
          staffItems.map(async (staff) => {
            try {
              const res = await getStaffPermissions(staff.id)
              return { staff, items: res.items, error: null as any }
            } catch (error) {
              return { staff, items: [], error }
            }
          })
        )

        const forbidden = permissionResponses.find((item) => item.error?.response?.status === 403)
        if (forbidden) {
          setAclError('ACL 권한 조회 권한이 없습니다.')
          setCodes(codeItems)
          setRows([])
          return
        }

        const nextRows: StaffPermissionRow[] = permissionResponses.map(({ staff, items }) => {
          const baseline = buildCodeMap(codeItems, items)
          return {
            staff,
            values: { ...baseline },
            baseline,
            saving: false,
          }
        })

        setCodes(codeItems)
        setRows(nextRows)
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setAclError('ACL 권한 조회 권한이 없습니다.')
        } else {
          setAclError('ACL 권한 정보를 불러오지 못했습니다.')
        }
      } finally {
        setAclLoading(false)
      }
    }

    void loadAcl()
  }, [])

  useLayoutEffect(() => {
    if (activeTab !== 'org' || orgLoading || departments.length < 2) {
      setDepartmentLine({ left: 0, width: 0 })
      return
    }

    const updateLine = () => {
      const row = departmentRowRef.current
      const firstDepartmentId = departments[0]?.id
      const lastDepartmentId = departments[departments.length - 1]?.id
      const firstNode = firstDepartmentId ? departmentNodeRefs.current[firstDepartmentId] : null
      const lastNode = lastDepartmentId ? departmentNodeRefs.current[lastDepartmentId] : null
      if (!row || !firstNode || !lastNode) {
        setDepartmentLine({ left: 0, width: 0 })
        return
      }

      const rowRect = row.getBoundingClientRect()
      const firstRect = firstNode.getBoundingClientRect()
      const lastRect = lastNode.getBoundingClientRect()
      const left = firstRect.left + firstRect.width / 2 - rowRect.left
      const right = lastRect.left + lastRect.width / 2 - rowRect.left
      setDepartmentLine({
        left: Math.max(0, left),
        width: Math.max(0, right - left),
      })
    }

    updateLine()
    window.addEventListener('resize', updateLine)
    return () => window.removeEventListener('resize', updateLine)
  }, [activeTab, orgLoading, departments, teams])

  useLayoutEffect(() => {
    if (activeTab !== 'org' || orgLoading) {
      setTeamLines({})
      return
    }

    const updateTeamLines = () => {
      const next: Record<string, { left: number; width: number }> = {}
      const groups: Array<{ key: string; teamIds: number[] }> = [
        ...departments.map((department) => ({
          key: `dep-${department.id}`,
          teamIds: (teamsByDepartmentId.get(department.id) || []).map((team) => team.id),
        })),
      ]
      if (unassignedTeams.length > 0) {
        groups.push({ key: 'dep-none', teamIds: unassignedTeams.map((team) => team.id) })
      }

      groups.forEach((group) => {
        if (group.teamIds.length < 2) return
        const row = teamRowRefs.current[group.key]
        const firstNode = teamNodeRefs.current[group.teamIds[0]]
        const lastNode = teamNodeRefs.current[group.teamIds[group.teamIds.length - 1]]
        if (!row || !firstNode || !lastNode) return

        const rowRect = row.getBoundingClientRect()
        const firstRect = firstNode.getBoundingClientRect()
        const lastRect = lastNode.getBoundingClientRect()
        const left = firstRect.left + firstRect.width / 2 - rowRect.left
        const right = lastRect.left + lastRect.width / 2 - rowRect.left
        next[group.key] = {
          left: Math.max(0, left),
          width: Math.max(0, right - left),
        }
      })

      setTeamLines(next)
    }

    updateTeamLines()
    window.addEventListener('resize', updateTeamLines)
    return () => window.removeEventListener('resize', updateTeamLines)
  }, [activeTab, orgLoading, departments, teamsByDepartmentId, unassignedTeams])

  const openCreateDrawer = (type: Exclude<DrawerType, null>) => {
    setDrawerType(type)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerType(null)
  }

  const handleToggle = (staffId: number, code: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.staff.id === staffId
          ? {
              ...row,
              values: { ...row.values, [code]: checked },
            }
          : row
      )
    )
  }

  const handleToggleAll = (staffId: number, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.staff.id !== staffId) return row
        const nextValues: Record<string, boolean> = {}
        codes.forEach((code) => {
          nextValues[code.code] = checked
        })
        return { ...row, values: nextValues }
      })
    )
  }

  const handleSaveAcl = async (staffId: number) => {
    const row = rows.find((item) => item.staff.id === staffId)
    if (!row) return

    const changedItems = codes
      .filter((code) => row.values[code.code] !== row.baseline[code.code])
      .map((code) => ({ code: code.code, is_allowed: row.values[code.code] }))
      .filter((item) => !ACL_EXCLUDED_CODES.has(item.code))

    if (changedItems.length === 0) {
      toast('변경된 권한이 없습니다.')
      return
    }

    try {
      setRows((prev) => prev.map((item) => (item.staff.id === staffId ? { ...item, saving: true } : item)))
      const response = await updateStaffPermissions(staffId, { items: changedItems })
      toast.success(response.message || '권한이 저장되었습니다.')
      setRows((prev) =>
        prev.map((item) =>
          item.staff.id === staffId
            ? {
                ...item,
                saving: false,
                baseline: { ...item.values },
              }
            : item
        )
      )
    } catch (error: any) {
      setRows((prev) => prev.map((item) => (item.staff.id === staffId ? { ...item, saving: false } : item)))
      if (error?.response?.status === 403) {
        toast.error('권한이 없습니다.')
      } else {
        toast.error(getErrorMessage(error, '권한 저장 중 오류가 발생했습니다.'))
      }
    }
  }

  const handleCreateDepartment = async () => {
    if (!departmentName.trim()) {
      toast.error('부서명을 입력해 주세요.')
      return
    }

    try {
      setDepartmentSubmitting(true)
      await createDepartment({
        name: departmentName.trim(),
        description: departmentDescription.trim() || undefined,
      })
      toast.success('부서를 생성했습니다.')
      setDepartmentName('')
      setDepartmentDescription('')
      closeDrawer()
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '부서 생성에 실패했습니다.'))
    } finally {
      setDepartmentSubmitting(false)
    }
  }

  const handleDeleteDepartment = async (departmentId: number) => {
    if (!window.confirm('해당 부서를 삭제하시겠습니까?')) return
    try {
      await deleteDepartment(departmentId)
      toast.success('부서를 삭제했습니다.')
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '부서 삭제에 실패했습니다.'))
    }
  }

  const handleMoveDepartment = async (departmentId: number, direction: 'up' | 'down') => {
    const currentIndex = departments.findIndex((department) => department.id === departmentId)
    if (currentIndex < 0) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= departments.length) return

    const reordered = [...departments]
    const [target] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, target)

    try {
      setDepartmentReordering(true)
      await reorderDepartments({
        items: reordered.map((department, index) => ({
          department_id: department.id,
          sort_order: index + 1,
        })),
      })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '부서 순서 변경에 실패했습니다.'))
    } finally {
      setDepartmentReordering(false)
    }
  }

  const handleDropDepartment = async (targetDepartmentId: number) => {
    if (!draggingDepartmentId || draggingDepartmentId === targetDepartmentId) {
      setDraggingDepartmentId(null)
      return
    }
    const currentIndex = departments.findIndex((department) => department.id === draggingDepartmentId)
    const targetIndex = departments.findIndex((department) => department.id === targetDepartmentId)
    if (currentIndex < 0 || targetIndex < 0) {
      setDraggingDepartmentId(null)
      return
    }

    const reordered = [...departments]
    const [dragged] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, dragged)

    try {
      setDepartmentReordering(true)
      await reorderDepartments({
        items: reordered.map((department, index) => ({
          department_id: department.id,
          sort_order: index + 1,
        })),
      })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '부서 순서 변경에 실패했습니다.'))
    } finally {
      setDepartmentReordering(false)
      setDraggingDepartmentId(null)
    }
  }

  const handleStartEditDepartment = (department: DepartmentOut) => {
    setEditingDepartmentId(department.id)
    setEditingDepartmentName(department.name)
  }

  const handleSaveDepartmentName = async () => {
    if (!editingDepartmentId) return
    if (!editingDepartmentName.trim()) {
      toast.error('부서명을 입력해 주세요.')
      return
    }
    try {
      setEditingDepartmentSaving(true)
      await updateDepartment(editingDepartmentId, { name: editingDepartmentName.trim() })
      toast.success('부서명이 수정되었습니다.')
      setEditingDepartmentId(null)
      setEditingDepartmentName('')
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '부서명 수정에 실패했습니다.'))
    } finally {
      setEditingDepartmentSaving(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('팀명을 입력해 주세요.')
      return
    }

    try {
      setTeamSubmitting(true)
      await createTeam({
        name: teamName.trim(),
        department_id: typeof teamDepartmentId === 'number' ? teamDepartmentId : undefined,
        description: teamDescription.trim() || undefined,
      })
      toast.success('팀을 생성했습니다.')
      setTeamName('')
      setTeamDescription('')
      setTeamDepartmentId('')
      closeDrawer()
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀 생성에 실패했습니다.'))
    } finally {
      setTeamSubmitting(false)
    }
  }

  const handleDeleteTeam = async (teamId: number) => {
    if (!window.confirm('해당 팀을 삭제하시겠습니까?')) return
    try {
      await deleteTeam(teamId)
      toast.success('팀을 삭제했습니다.')
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀 삭제에 실패했습니다.'))
    }
  }

  const handleMoveTeam = async (teamId: number, direction: 'up' | 'down') => {
    const currentTeam = teams.find((team) => team.id === teamId)
    if (!currentTeam) return
    const departmentId = currentTeam.department_id ?? null
    const siblingTeams = teams.filter((team) => (team.department_id ?? null) === departmentId)
    const currentIndex = siblingTeams.findIndex((team) => team.id === teamId)
    if (currentIndex < 0) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= siblingTeams.length) return

    const reordered = [...siblingTeams]
    const [target] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, target)

    try {
      setTeamReordering(true)
      await reorderTeams({
        items: reordered.map((team, index) => ({
          team_id: team.id,
          sort_order: index + 1,
          department_id: team.department_id,
        })),
      })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀 순서 변경에 실패했습니다.'))
    } finally {
      setTeamReordering(false)
    }
  }

  const handleDropTeam = async (targetTeamId: number, targetDepartmentId: number | null) => {
    if (!draggingTeamId) return
    const draggedTeam = teams.find((team) => team.id === draggingTeamId)
    if (!draggedTeam || draggingTeamId === targetTeamId) {
      setDraggingTeamId(null)
      return
    }

    const sourceDepartmentId = draggedTeam.department_id ?? null
    const targetDepartment = targetDepartmentId ?? null

    const sourceTeams = teams.filter((team) => (team.department_id ?? null) === sourceDepartmentId && team.id !== draggingTeamId)
    const targetTeamsBase =
      sourceDepartmentId === targetDepartment
        ? sourceTeams
        : teams.filter((team) => (team.department_id ?? null) === targetDepartment)
    const targetIndex = targetTeamsBase.findIndex((team) => team.id === targetTeamId)
    if (targetIndex < 0) {
      setDraggingTeamId(null)
      return
    }

    const nextDragged: TeamOut = { ...draggedTeam, department_id: targetDepartment ?? undefined }
    const targetTeams = [...targetTeamsBase]
    targetTeams.splice(targetIndex, 0, nextDragged)

    const payloadItems =
      sourceDepartmentId === targetDepartment
        ? targetTeams.map((team, index) => ({
            team_id: team.id,
            sort_order: index + 1,
            department_id: team.department_id,
          }))
        : [
            ...sourceTeams.map((team, index) => ({
              team_id: team.id,
              sort_order: index + 1,
              department_id: sourceDepartmentId ?? undefined,
            })),
            ...targetTeams.map((team, index) => ({
              team_id: team.id,
              sort_order: index + 1,
              department_id: targetDepartment ?? undefined,
            })),
          ]

    try {
      setTeamReordering(true)
      await reorderTeams({ items: payloadItems })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀 순서 변경에 실패했습니다.'))
    } finally {
      setTeamReordering(false)
      setDraggingTeamId(null)
    }
  }

  const handleDropTeamToDepartmentEnd = async (targetDepartmentId: number | null) => {
    if (!draggingTeamId) return
    const draggedTeam = teams.find((team) => team.id === draggingTeamId)
    if (!draggedTeam) {
      setDraggingTeamId(null)
      return
    }

    const sourceDepartmentId = draggedTeam.department_id ?? null
    const targetDepartment = targetDepartmentId ?? null

    const sourceTeams = teams.filter((team) => (team.department_id ?? null) === sourceDepartmentId && team.id !== draggingTeamId)
    const targetTeamsBase =
      sourceDepartmentId === targetDepartment
        ? sourceTeams
        : teams.filter((team) => (team.department_id ?? null) === targetDepartment)
    const nextDragged: TeamOut = { ...draggedTeam, department_id: targetDepartment ?? undefined }
    const targetTeams = [...targetTeamsBase, nextDragged]

    const payloadItems =
      sourceDepartmentId === targetDepartment
        ? targetTeams.map((team, index) => ({
            team_id: team.id,
            sort_order: index + 1,
            department_id: team.department_id,
          }))
        : [
            ...sourceTeams.map((team, index) => ({
              team_id: team.id,
              sort_order: index + 1,
              department_id: sourceDepartmentId ?? undefined,
            })),
            ...targetTeams.map((team, index) => ({
              team_id: team.id,
              sort_order: index + 1,
              department_id: targetDepartment ?? undefined,
            })),
          ]

    try {
      setTeamReordering(true)
      await reorderTeams({ items: payloadItems })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀 순서 변경에 실패했습니다.'))
    } finally {
      setTeamReordering(false)
      setDraggingTeamId(null)
    }
  }

  const handleStartEditTeam = (team: TeamOut) => {
    setEditingTeamId(team.id)
    setEditingTeamName(team.name)
  }

  const handleSaveTeamName = async () => {
    if (!editingTeamId) return
    if (!editingTeamName.trim()) {
      toast.error('팀명을 입력해 주세요.')
      return
    }
    try {
      setEditingTeamSaving(true)
      await updateTeam(editingTeamId, { name: editingTeamName.trim() })
      toast.success('팀명이 수정되었습니다.')
      setEditingTeamId(null)
      setEditingTeamName('')
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '팀명 수정에 실패했습니다.'))
    } finally {
      setEditingTeamSaving(false)
    }
  }

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      toast.error('직급명을 입력해 주세요.')
      return
    }

    try {
      setRoleSubmitting(true)
      await createRole({
        name: roleName.trim(),
        description: roleDescription.trim() || undefined,
      })
      toast.success('직급을 생성했습니다.')
      setRoleName('')
      setRoleDescription('')
      closeDrawer()
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '직급 생성에 실패했습니다.'))
    } finally {
      setRoleSubmitting(false)
    }
  }

  const handleMoveRole = async (roleId: number, direction: 'up' | 'down') => {
    const currentIndex = roles.findIndex((role) => role.id === roleId)
    if (currentIndex < 0) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= roles.length) return

    const reordered = [...roles]
    const [target] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, target)

    try {
      setRoleReordering(true)
      await reorderRoles({
        items: reordered.map((role, index) => ({
          role_id: role.id,
          rank_order: index + 1,
        })),
      })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '직급 순서 변경에 실패했습니다.'))
    } finally {
      setRoleReordering(false)
    }
  }

  const handleDeleteRole = async (roleId: number) => {
    if (!window.confirm('해당 직급을 삭제하시겠습니까?')) return
    try {
      await deleteRole(roleId)
      toast.success('직급을 삭제했습니다.')
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '직급 삭제에 실패했습니다.'))
    }
  }

  const handleMoveMember = async (teamId: number, memberId: number, direction: 'up' | 'down') => {
    const members = staffByTeamId.get(teamId) || []
    const currentIndex = members.findIndex((member) => member.id === memberId)
    if (currentIndex < 0) return
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= members.length) return

    const currentMember = members[currentIndex]
    const nextMember = members[nextIndex]

    if (!currentMember.role_id || !nextMember.role_id) {
      toast.error('직급이 설정된 직원만 순서를 조정할 수 있습니다.')
      return
    }

    if (currentMember.role_id === nextMember.role_id) {
      toast('동일 직급 내 순서는 직급 순서로 변경할 수 없습니다.')
      return
    }

    const currentRoleIndex = roles.findIndex((role) => role.id === currentMember.role_id)
    const nextRoleIndex = roles.findIndex((role) => role.id === nextMember.role_id)
    if (currentRoleIndex < 0 || nextRoleIndex < 0) {
      toast.error('직급 정보를 찾을 수 없습니다.')
      return
    }

    const reorderedRoles = [...roles]
    ;[reorderedRoles[currentRoleIndex], reorderedRoles[nextRoleIndex]] = [
      reorderedRoles[nextRoleIndex],
      reorderedRoles[currentRoleIndex],
    ]

    try {
      setRoleReordering(true)
      await reorderRoles({
        items: reorderedRoles.map((role, index) => ({
          role_id: role.id,
          rank_order: index + 1,
        })),
      })
      await loadOrganizationResources()
    } catch (error) {
      toast.error(getErrorMessage(error, '직원 순서 변경에 실패했습니다.'))
    } finally {
      setRoleReordering(false)
    }
  }

  const renderTeamNode = (team: TeamOut, departmentId: number | null) => {
    const members = staffByTeamId.get(team.id) || []
    return (
      <div
        key={team.id}
        className="flex shrink-0 flex-col items-center px-1.5"
        ref={(node) => {
          teamNodeRefs.current[team.id] = node
        }}
        onDragOver={(event) => {
          if (!draggingTeamId) return
          event.preventDefault()
        }}
        onDrop={(event) => {
          if (!draggingTeamId) return
          event.preventDefault()
          void handleDropTeam(team.id, departmentId)
        }}
      >
        <div className="h-3 w-[2px] bg-zinc-300" />
        <div
          draggable
          onDragStart={() => setDraggingTeamId(team.id)}
          onDragEnd={() => setDraggingTeamId(null)}
          className="w-fit max-w-[320px] cursor-move rounded-md border border-zinc-200 bg-white px-3 py-2"
        >
          <p className="text-center text-sm font-semibold text-zinc-900">{team.name}</p>
        </div>
        <div className="h-3 w-px bg-zinc-300" />
        <div className="w-fit max-w-[320px] rounded-md border border-zinc-200 bg-transparent p-2">
          {members.length === 0 ? (
            <p className="text-xs text-zinc-400">소속 직원 없음</p>
          ) : (
            <ul className="space-y-1">
              {members.map((member, index) => (
                <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={roleReordering || index === 0}
                      onClick={() => handleMoveMember(team.id, member.id, 'up')}
                      className="rounded border border-zinc-300 px-1 text-[10px] leading-4 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={roleReordering || index === members.length - 1}
                      onClick={() => handleMoveMember(team.id, member.id, 'down')}
                      className="rounded border border-zinc-300 px-1 text-[10px] leading-4 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <span className="truncate text-zinc-700">{member.name}</span>
                  </div>
                  <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                    {member.role_id ? roleNameById.get(member.role_id) || '직급미정' : '직급미정'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">조직도 보기</span>
            <button
              type="button"
              onClick={() => setActiveTab((prev) => (prev === 'org' ? 'acl' : 'org'))}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'org'
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {activeTab === 'org' ? 'ON' : 'OFF'}
            </button>
            <span className="text-xs text-zinc-500">
              {activeTab === 'org' ? '리스트형 + 이동형 조직도' : 'ACL 권한 설정 화면'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('acl')}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              권한설정
            </button>
            {activeTab === 'org' ? (
              <>
                <button
                  type="button"
                  onClick={() => openCreateDrawer('department')}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  부서관리
                </button>
                <button
                  type="button"
                  onClick={() => openCreateDrawer('team')}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  팀관리
                </button>
                <button
                  type="button"
                  onClick={() => openCreateDrawer('role')}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  직급관리
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('org')}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                조직도 화면으로
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'org' ? (
        <section className="space-y-4">
          {orgLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-12 text-center text-sm text-zinc-500">조직도 조회 중...</div>
          ) : departments.length === 0 && unassignedTeams.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">아직 조직도가 없습니다.</p>
              <p className="mt-1 text-xs text-zinc-500">상단 + 버튼으로 부서 또는 팀을 먼저 생성해 주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-1">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">리스트형 조직도</p>
                  <div className="mt-3 space-y-3">
                    {departments.map((department) => {
                      const departmentTeams = teamsByDepartmentId.get(department.id) || []
                      return (
                        <div key={`list-dep-${department.id}`} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-900">{department.name}</p>
                            <span className="rounded bg-white px-2 py-0.5 text-[11px] text-zinc-500">
                              {departmentTeams.length}팀
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {departmentTeams.length === 0 ? (
                              <p className="text-xs text-zinc-400">등록된 팀이 없습니다.</p>
                            ) : (
                              departmentTeams.map((team) => {
                                const members = staffByTeamId.get(team.id) || []
                                return (
                                  <div key={`list-team-${team.id}`} className="rounded border border-zinc-200 bg-white px-2.5 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-zinc-800">{team.name}</p>
                                      <span className="text-[11px] text-zinc-500">{members.length}명</span>
                                    </div>
                                    {members.length > 0 ? (
                                      <div className="mt-1.5 space-y-1">
                                        {members.map((member) => (
                                          <div key={`list-member-${member.id}`} className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="truncate text-zinc-700">{member.name}</span>
                                            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                                              {member.role_id ? roleNameById.get(member.role_id) || '직급미정' : '직급미정'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-1.5 text-[11px] text-zinc-400">소속 직원 없음</p>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {unassignedTeams.length > 0 ? (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                        <p className="text-sm font-semibold text-zinc-900">미분류 팀</p>
                        <div className="mt-2 space-y-2">
                          {unassignedTeams.map((team) => {
                            const members = staffByTeamId.get(team.id) || []
                            return (
                              <div key={`list-unassigned-${team.id}`} className="rounded border border-zinc-200 bg-white px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-zinc-800">{team.name}</p>
                                  <span className="text-[11px] text-zinc-500">{members.length}명</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-4 xl:col-span-2">
                {departments.length > 0 ? (
                  <div className="flex flex-col items-center rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="h-4 w-px bg-zinc-300" />
                    <div className="relative inline-flex flex-col items-center">
                      {departmentLine.width > 0 ? (
                        <div
                          className="pointer-events-none absolute top-0 h-[2px] bg-zinc-300"
                          style={{ left: `${departmentLine.left}px`, width: `${departmentLine.width}px` }}
                        />
                      ) : null}
                      <div ref={departmentRowRef} className="flex flex-nowrap items-start gap-0">
                        {departments.map((department) => {
                          const departmentTeams = teamsByDepartmentId.get(department.id) || []
                          return (
                            <div
                              key={department.id}
                              className="flex shrink-0 flex-col items-center px-3"
                              ref={(node) => {
                                departmentNodeRefs.current[department.id] = node
                              }}
                              onDragOver={(event) => {
                                if (!draggingDepartmentId && !draggingTeamId) return
                                event.preventDefault()
                              }}
                              onDrop={(event) => {
                                event.preventDefault()
                                if (draggingDepartmentId) {
                                  void handleDropDepartment(department.id)
                                  return
                                }
                                if (draggingTeamId) {
                                  void handleDropTeamToDepartmentEnd(department.id)
                                }
                              }}
                            >
                              <div className="h-4 w-[2px] bg-zinc-300" />
                              <div
                                draggable
                                onDragStart={() => setDraggingDepartmentId(department.id)}
                                onDragEnd={() => setDraggingDepartmentId(null)}
                                className="cursor-move rounded-md border border-zinc-200 bg-white px-4 py-2"
                              >
                                <p className="text-sm font-semibold text-zinc-900">{department.name}</p>
                              </div>
                              <div className="h-3 w-px bg-zinc-300" />
                              {departmentTeams.length === 0 ? (
                                <button
                                  type="button"
                                  className="rounded border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500"
                                  onDragOver={(event) => {
                                    if (!draggingTeamId) return
                                    event.preventDefault()
                                  }}
                                  onDrop={(event) => {
                                    if (!draggingTeamId) return
                                    event.preventDefault()
                                    void handleDropTeamToDepartmentEnd(department.id)
                                  }}
                                >
                                  부서 내 팀 없음
                                </button>
                              ) : (
                                <div className="inline-flex flex-col items-center">
                                  <div
                                    className="relative"
                                    ref={(node) => {
                                      teamRowRefs.current[`dep-${department.id}`] = node
                                    }}
                                    onDragOver={(event) => {
                                      if (!draggingTeamId) return
                                      event.preventDefault()
                                    }}
                                    onDrop={(event) => {
                                      if (!draggingTeamId) return
                                      event.preventDefault()
                                      void handleDropTeamToDepartmentEnd(department.id)
                                    }}
                                  >
                                    {teamLines[`dep-${department.id}`]?.width ? (
                                      <div
                                        className="pointer-events-none absolute top-0 h-[2px] bg-zinc-300"
                                        style={{
                                          left: `${teamLines[`dep-${department.id}`].left}px`,
                                          width: `${teamLines[`dep-${department.id}`].width}px`,
                                        }}
                                      />
                                    ) : null}
                                    <div className="flex flex-nowrap items-start gap-0">
                                      {departmentTeams.map((team) => renderTeamNode(team, department.id))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {unassignedTeams.length > 0 ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 pt-2">
                    <p className="text-sm font-semibold text-zinc-900">미분류 팀</p>
                    <div className="mt-3">
                      <div
                        className="relative flex flex-nowrap items-start gap-0"
                        ref={(node) => {
                          teamRowRefs.current['dep-none'] = node
                        }}
                        onDragOver={(event) => {
                          if (!draggingTeamId) return
                          event.preventDefault()
                        }}
                        onDrop={(event) => {
                          if (!draggingTeamId) return
                          event.preventDefault()
                          void handleDropTeamToDepartmentEnd(null)
                        }}
                      >
                        {teamLines['dep-none']?.width ? (
                          <div
                            className="pointer-events-none absolute top-0 h-[2px] bg-zinc-300"
                            style={{ left: `${teamLines['dep-none'].left}px`, width: `${teamLines['dep-none'].width}px` }}
                          />
                        ) : null}
                        {unassignedTeams.map((team) => renderTeamNode(team, null))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

        </section>
      ) : aclLoading ? (
        <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
          ACL 권한 정보를 불러오는 중...
        </section>
      ) : aclError ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
          {aclError}
        </section>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            내휴가관리/출퇴근관리는 기본 권한으로 제공되어 목록에서 제외됩니다. 메일은 기본 기능 권한(mail.read)과 삭제 권한(mail.delete)을 분리해서 운영합니다.
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-[1100px] w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 text-zinc-700">
                  <th className="border border-zinc-200 px-3 py-2 text-left" rowSpan={2}>
                    직원
                  </th>
                  <th className="border border-zinc-200 px-3 py-2 text-center" rowSpan={2}>
                    전체
                  </th>
                  {groupedCodes.map(([group, groupCodes]) => (
                    <th key={group} className="border border-zinc-200 px-3 py-2 text-center" colSpan={groupCodes.length}>
                      {group}
                    </th>
                  ))}
                  <th className="border border-zinc-200 px-3 py-2 text-center" rowSpan={2}>
                    저장
                  </th>
                </tr>
                <tr className="bg-zinc-50 text-zinc-500">
                  {groupedCodes.flatMap(([_, groupCodes]) =>
                    groupCodes.map((code) => (
                      <th key={code.code} className="border border-zinc-200 px-2 py-2 text-center whitespace-nowrap">
                        {code.action_name}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const allChecked = codes.length > 0 && codes.every((code) => row.values[code.code])
                  const changed = hasChanges(row, codes)
                  return (
                    <tr key={row.staff.id} className="even:bg-zinc-50/50">
                      <td className="border border-zinc-200 px-3 py-2 text-left text-zinc-800">
                        {row.staff.name}
                        <span className="ml-2 text-zinc-400">({row.staff.birth_date || '생일 미등록'})</span>
                      </td>
                      <td className="border border-zinc-200 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(e) => handleToggleAll(row.staff.id, e.target.checked)}
                        />
                      </td>
                      {codes.map((code) => (
                        <td key={`${row.staff.id}-${code.code}`} className="border border-zinc-200 px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(row.values[code.code])}
                            onChange={(e) => handleToggle(row.staff.id, code.code, e.target.checked)}
                          />
                        </td>
                      ))}
                      <td className="border border-zinc-200 px-3 py-2 text-center">
                        <button
                          type="button"
                          disabled={!changed || row.saving}
                          onClick={() => void handleSaveAcl(row.staff.id)}
                          className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          {row.saving ? '저장중...' : '저장'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 bg-black/25">
          <div className="absolute inset-y-0 left-0 w-full max-w-md overflow-y-auto border-r border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {drawerType === 'department'
                    ? '부서 관리'
                    : drawerType === 'team'
                      ? '팀 관리'
                      : drawerType === 'role'
                        ? '직급 관리'
                        : '조직도 추가'}
                </p>
                <p className="text-xs text-zinc-500">입력 후 바로 아래 리스트에서 현재 항목을 확인하고 삭제할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {drawerType === 'department' ? (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-800">부서 관리</p>
                  <input
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="부서명"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <input
                    value={departmentDescription}
                    onChange={(e) => setDepartmentDescription(e.target.value)}
                    placeholder="설명(선택)"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateDepartment}
                    disabled={departmentSubmitting}
                    className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {departmentSubmitting ? '생성 중...' : '부서 생성'}
                  </button>
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white">
                    <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto">
                      {departments.length === 0 ? (
                        <li className="px-3 py-4 text-center text-xs text-zinc-500">등록된 부서가 없습니다.</li>
                      ) : (
                        departments.map((department, index) => (
                          <li key={department.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            {editingDepartmentId === department.id ? (
                              <>
                                <input
                                  value={editingDepartmentName}
                                  onChange={(e) => setEditingDepartmentName(e.target.value)}
                                  className="h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={editingDepartmentSaving}
                                    onClick={handleSaveDepartmentName}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    disabled={editingDepartmentSaving}
                                    onClick={() => {
                                      setEditingDepartmentId(null)
                                      setEditingDepartmentName('')
                                    }}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                  >
                                    취소
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="truncate text-xs text-zinc-700">{department.name}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={departmentReordering || index === 0}
                                    onClick={() => handleMoveDepartment(department.id, 'up')}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={departmentReordering || index === departments.length - 1}
                                    onClick={() => handleMoveDepartment(department.id, 'down')}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditDepartment(department)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDepartment(department.id)}
                                    className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}

              {drawerType === 'team' ? (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-800">팀 관리</p>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="팀명"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <select
                    value={teamDepartmentId}
                    onChange={(e) => setTeamDepartmentId(e.target.value ? Number(e.target.value) : '')}
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  >
                    <option value="">부서 미지정</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="설명(선택)"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTeam}
                    disabled={teamSubmitting}
                    className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {teamSubmitting ? '생성 중...' : '팀 생성'}
                  </button>
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white">
                    <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto">
                      {teams.length === 0 ? (
                        <li className="px-3 py-4 text-center text-xs text-zinc-500">등록된 팀이 없습니다.</li>
                      ) : (
                        teams.map((team) => {
                          const siblingTeams = teams.filter(
                            (item) => (item.department_id ?? null) === (team.department_id ?? null)
                          )
                          const siblingIndex = siblingTeams.findIndex((item) => item.id === team.id)
                          return (
                          <li key={team.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            {editingTeamId === team.id ? (
                              <>
                                <input
                                  value={editingTeamName}
                                  onChange={(e) => setEditingTeamName(e.target.value)}
                                  className="h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-zinc-500"
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={editingTeamSaving}
                                    onClick={handleSaveTeamName}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    disabled={editingTeamSaving}
                                    onClick={() => {
                                      setEditingTeamId(null)
                                      setEditingTeamName('')
                                    }}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                  >
                                    취소
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="truncate text-xs text-zinc-700">
                                  {team.name}
                                  {team.department?.name ? ` (${team.department.name})` : ''}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={teamReordering || siblingIndex === 0}
                                    onClick={() => handleMoveTeam(team.id, 'up')}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={teamReordering || siblingIndex === siblingTeams.length - 1}
                                    onClick={() => handleMoveTeam(team.id, 'down')}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTeam(team)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTeam(team.id)}
                                    className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        )})
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}

              {drawerType === 'role' ? (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-medium text-zinc-800">직급 관리</p>
                  <input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="직급명"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <input
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="설명(선택)"
                    className="h-9 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateRole}
                    disabled={roleSubmitting}
                    className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {roleSubmitting ? '생성 중...' : '직급 생성'}
                  </button>
                  <div className="mt-3 rounded-md border border-zinc-200 bg-white">
                    <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto">
                      {roles.length === 0 ? (
                        <li className="px-3 py-4 text-center text-xs text-zinc-500">등록된 직급이 없습니다.</li>
                      ) : (
                        roles.map((role, index) => (
                          <li key={role.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="truncate text-xs text-zinc-700">{role.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={roleReordering || index === 0}
                                onClick={() => handleMoveRole(role.id, 'up')}
                                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={roleReordering || index === roles.length - 1}
                                onClick={() => handleMoveRole(role.id, 'down')}
                                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(role.id)}
                                className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
                              >
                                삭제
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
