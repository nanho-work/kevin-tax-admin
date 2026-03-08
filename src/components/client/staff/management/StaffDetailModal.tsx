'use client'

import { AdminOut } from '@/types/admin'
import { useEffect, useState } from 'react'
import { patchClientStaffTeam, updateClientStaff } from '@/services/client/clientStaffService'
import { getRoles } from '@/services/client/roleService'
import { getDepartments } from '@/services/client/departmentService'
import { getTeams } from '@/services/client/teamService'
import type { UpdateStaffRequest } from '@/types/admin'
import type { RoleOut } from '@/types/role'
import type { DepartmentOut } from '@/types/department'
import type { TeamOut } from '@/types/team'

type StaffRole = NonNullable<UpdateStaffRequest['role_id']>

interface Props {
  staff: AdminOut
  onClose: () => void
  onSaved?: () => void | Promise<void>
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

export default function StaffDetailModal({ staff, onClose, onSaved }: Props) {
  const inputClass =
    'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roles, setRoles] = useState<RoleOut[]>([])
  const [departments, setDepartments] = useState<DepartmentOut[]>([])
  const [teams, setTeams] = useState<TeamOut[]>([])

  const [form, setForm] = useState({
    name: staff.name || '',
    phone: staff.phone || '',
    profile_image: null as File | null,
    profile_image_url: staff.profile_image_url || '',
    hired_at: staff.hired_at || '',
    birth_date: staff.birth_date || '',
    retired_at: staff.retired_at || '',
    team_id: staff.team_id ?? staff.team?.id ?? null,
    role_id: staff.role_id || undefined,
  })
  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name || '',
        phone: staff.phone || '',
        profile_image: null,
        profile_image_url: staff.profile_image_url || '',
        hired_at: staff.hired_at || '',
        birth_date: staff.birth_date || '',
        retired_at: staff.retired_at || '',
        team_id: staff.team_id ?? staff.team?.id ?? null,
        role_id: staff.role_id || undefined,
      })
    }
  }, [staff])

  useEffect(() => {
    async function loadOptions() {
      const [roleList, departmentList, teamList] = await Promise.all([
        getRoles(),
        getDepartments(),
        getTeams(),
      ])
      setRoles(roleList)
      setDepartments(departmentList)
      setTeams(teamList)
    }
    loadOptions()
  }, [])

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const prevTeamId = staff.team_id ?? staff.team?.id ?? null
      const nextTeamId = form.team_id ?? null
      const teamChanged = prevTeamId !== nextTeamId

      const nameChanged = form.name !== (staff.name || '')
      const phoneChanged = form.phone !== (staff.phone || '')
      const roleChanged = (form.role_id ?? null) !== (staff.role_id ?? null)
      const hiredAtChanged = form.hired_at !== (staff.hired_at || '')
      const birthDateChanged = form.birth_date !== (staff.birth_date || '')
      const retiredAtChanged = form.retired_at !== (staff.retired_at || '')

      const formData = new FormData()
      let hasGeneralChanges = false
      if (nameChanged && form.name) {
        formData.append('name', form.name)
        hasGeneralChanges = true
      }
      if (phoneChanged && form.phone) {
        formData.append('phone', form.phone)
        hasGeneralChanges = true
      }
      if (roleChanged && form.role_id !== undefined) {
        formData.append('role_id', String(form.role_id))
        hasGeneralChanges = true
      }
      if (hiredAtChanged && form.hired_at) {
        formData.append('hired_at', form.hired_at)
        hasGeneralChanges = true
      }
      if (birthDateChanged && form.birth_date) {
        formData.append('birth_date', form.birth_date)
        hasGeneralChanges = true
      }
      if (retiredAtChanged && form.retired_at) {
        formData.append('retired_at', form.retired_at)
        hasGeneralChanges = true
      }
      if (form.profile_image) {
        formData.append('file', form.profile_image)
        hasGeneralChanges = true
      }

      if (!hasGeneralChanges && !teamChanged) {
        setSuccess('변경된 내용이 없습니다.')
        setError('')
        return
      }

      if (hasGeneralChanges) {
        await updateClientStaff(staff.id, formData)
      }

      if (teamChanged) {
        await patchClientStaffTeam(staff.id, nextTeamId)
      }

      setSuccess('정보가 저장되었습니다.')
      setError('')
      await onSaved?.()

      if (form.profile_image) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setForm((prev) => ({
            ...prev,
            profile_image_url: reader.result as string,
            profile_image: null,
          }))
        }
        reader.readAsDataURL(form.profile_image)
      }
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, '저장 실패'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <img
              src={form.profile_image_url || '/default-profile.png'}
              alt="사용자 이미지"
              className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
            />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{staff.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {staff.role?.name || '직급 미지정'}
                {staff.email ? ` · ${staff.email}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">처리 중입니다...</div> : null}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">이메일</label>
                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">{staff.email || '-'}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">연락처</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">직급</label>
                {staff.role_id === 1 || staff.role_id === 2 ? (
                  <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">{staff.role?.name || '-'}</div>
                ) : (
                  <select
                    value={form.role_id ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, role_id: Number(e.target.value) as StaffRole }))}
                    className={inputClass}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">팀</label>
                <select
                  value={form.team_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      team_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">선택 안함</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.department?.name ? `(${t.department.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">부서</label>
                <select
                  value={teams.find((t) => t.id === form.team_id)?.department?.id ?? ''}
                  disabled
                  className={`${inputClass} cursor-not-allowed bg-zinc-100 text-zinc-500`}
                >
                  <option value="">(자동 선택)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">입사일</label>
                <input
                  type="date"
                  value={form.hired_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, hired_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">생일</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">퇴사일</label>
                <input
                  type="date"
                  value={form.retired_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, retired_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600">프로필 이미지 변경</label>
                <div className="flex items-end gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile_image: e.target.files?.[0] || null,
                      }))
                    }
                    className={inputClass}
                  />
                  {form.profile_image ? (
                    <img
                      src={URL.createObjectURL(form.profile_image)}
                      alt="프로필 미리보기"
                      className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
