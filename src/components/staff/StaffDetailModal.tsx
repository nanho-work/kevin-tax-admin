// ✅ 직원 상세 정보 모달
// - 상세 보기 버튼 클릭 시 오픈
// - 전달된 직원(Admin) 데이터를 보여주는 UI
// - 수정폼 연동 또는 상태 토글 가능

'use client'

import { AdminOut } from '@/types/admin'
import { useEffect, useRef, useState } from 'react'
import { updateAdminStaff } from '@/services/adminService'
import { getRoles } from '@/services/roleService'
import { getDepartments } from '@/services/departmentService'
import { getTeams } from '@/services/teamService'
import type { UpdateStaffRequest } from '@/types/admin'
import type { RoleOut } from '@/types/role'
import type { DepartmentOut } from '@/types/department'
import type { TeamOut } from '@/types/team'
import { gsap } from 'gsap'

type StaffRole = NonNullable<UpdateStaffRequest['role_id']>

interface Props {
  staff: AdminOut
  onClose: () => void
}

export default function StaffDetailModal({ staff, onClose }: Props) {
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
    retired_at: staff.retired_at || '',
    team_id: staff.team_id || undefined,
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
        retired_at: staff.retired_at || '',
        team_id: staff.team_id || undefined,
        role_id: staff.role_id || undefined,
      })
    }
  }, [staff])

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }
      )
    }
  }, [])

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

  console.log('초기 데이터:', staff);

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const formData = new FormData()
      if (form.name) formData.append('name', form.name)
      if (form.phone) formData.append('phone', form.phone)
      if (form.role_id !== undefined) formData.append('role_id', String(form.role_id))
      if (form.team_id !== undefined) formData.append('team_id', String(form.team_id))
      if (form.hired_at) formData.append('hired_at', form.hired_at)
      if (form.retired_at) formData.append('retired_at', form.retired_at)
      if (form.profile_image) {
        formData.append('file', form.profile_image)  // 'profile_image' → 'file'
      }

      const result = await updateAdminStaff(staff.id, formData)
      setSuccess('정보가 저장되었습니다.')

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
      setError('저장 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded w-96 shadow-lg space-y-3">
        <h2 className="text-lg font-bold mb-2">직원 상세 정보</h2>
        <div className="flex flex-col items-center space-y-2">
          <img
            src={
              form.profile_image_url
                ? form.profile_image_url
                : '/default-profile.png'
            }
            alt="사용자 이미지"
            className="w-24 h-24 rounded-full object-cover border-2 border-white"
          />
          <div className="text-lg font-semibold">
            {staff.name} {staff.role?.name || ''}님
          </div>
        </div>

        {success && <p className="text-green-600 text-sm text-center">{success}</p>}
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}



        <div>
          <label className="block font-medium">이메일:</label>
          <p>{staff.email}</p>
        </div>

        <div>
          <label className="block font-medium">연락처:</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="border px-2 py-1 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium">직급:</label>
          {staff.role_id === 1 || staff.role_id === 2 ? (
            <p>{staff.role?.name || ''}</p>
          ) : (
            <select
              value={form.role_id ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, role_id: Number(e.target.value) }))}
              className="border px-2 py-1 w-full rounded"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block font-medium">팀:</label>
          <select
            value={form.team_id ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, team_id: Number(e.target.value) }))}
            className="border px-2 py-1 w-full rounded"
          >
            <option value="">선택</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.department?.name ? `(${t.department.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">부서:</label>
          <select
            value={
              teams.find((t) => t.id === form.team_id)?.department?.id ?? ''
            }
            disabled
            className="border px-2 py-1 w-full rounded bg-gray-100 cursor-not-allowed"
          >
            <option value="">(자동 선택)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">입사일:</label>
          <input
            type="date"
            value={form.hired_at}
            onChange={(e) => setForm((prev) => ({ ...prev, hired_at: e.target.value }))}
            className="border px-2 py-1 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium">퇴사일:</label>
          <input
            type="date"
            value={form.retired_at}
            onChange={(e) => setForm((prev) => ({ ...prev, retired_at: e.target.value }))}
            className="border px-2 py-1 w-full rounded"
          />
        </div>

        <div>
          <label className="block font-medium">프로필 이미지 변경:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                profile_image: e.target.files?.[0] || null
              }))
            }
            className="mt-1"
          />
        </div>

        {loading && <p className="text-blue-600 text-sm text-center mb-2">처리 중입니다...</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded"
          >
            저장
          </button>
          <button
            onClick={() => {
              onClose()
              location.reload()  // ✅ 페이지 리로드 추가
            }}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}