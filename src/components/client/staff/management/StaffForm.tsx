'use client'

import { useState, useEffect } from 'react'
import type { CreateStaffRequest } from '@/types/admin'
import { createClientStaff } from '@/services/client/clientStaffService'
import { getRoles } from '@/services/client/roleService'
import { getTeams } from '@/services/client/teamService'
import { getDepartments } from '@/services/client/departmentService'
import type { RoleOut } from '@/types/role'
import type { TeamOut } from '@/types/team'
import type { DepartmentOut } from '@/types/department'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'

export default function StaffForm() {
    const inputClass =
        'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

    const [form, setForm] = useState<CreateStaffRequest>({
        email: '',
        name: '',
        password: '',
        phone: '',
        hired_at: '',
        birth_date: '',
        client_id: 0,
        team_id: undefined,
        role_id: undefined,
        // department_id: undefined,
    })
    // 프로필 이미지 상태 추가
    const [profileImage, setProfileImage] = useState<File | null>(null)
    const [roles, setRoles] = useState<RoleOut[]>([])
    const [teams, setTeams] = useState<TeamOut[]>([])
    const [departments, setDepartments] = useState<DepartmentOut[]>([])

    const [visibleTeams, setVisibleTeams] = useState<TeamOut[]>([])
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('')
    const { session } = useClientSessionContext()

    useEffect(() => {
        async function loadData() {
            const [roleRes, teamRes, deptRes] = await Promise.allSettled([
                getRoles(),
                getTeams(),
                getDepartments(),
            ])

            const rolesData = roleRes.status === 'fulfilled' ? roleRes.value : []
            const teamsData = teamRes.status === 'fulfilled' ? teamRes.value : []
            const departmentsData = deptRes.status === 'fulfilled' ? deptRes.value : []

            setRoles(rolesData)
            setTeams(teamsData)
            setDepartments(departmentsData)
            setVisibleTeams(teamsData)
        }
        loadData()
    }, [])

    useEffect(() => {
      setForm((prev) => ({ ...prev, client_id: session?.client_id ?? 0 }))
    }, [session?.client_id])

    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedDeptId = Number(e.target.value)
        const filteredTeams = departments.find(dep => dep.id === selectedDeptId)
          ? teams.filter(team => team.department_id === selectedDeptId)
          : teams

        setForm({ ...form, team_id: undefined })
        setVisibleTeams(filteredTeams)
        setSelectedDepartmentId(selectedDeptId)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setForm({ ...form, [name]: value })
    }

    const handleNumberSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target
        setForm({
            ...form,
            [name]: value ? Number(value) : undefined,
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const formData = new FormData()
            formData.append('email', form.email)
            formData.append('name', form.name)
            formData.append('password', form.password)
            formData.append('phone', form.phone ?? '')
            formData.append('hired_at', form.hired_at ?? '')
            formData.append('birth_date', form.birth_date ?? '')
            formData.append('client_id', String(form.client_id))
            if (form.team_id) formData.append('team_id', String(form.team_id))
            if (form.role_id) formData.append('role_id', String(form.role_id))
            // Removed department_id append line
            if (profileImage) {
                formData.append('profile_image', profileImage)
            }

            await createClientStaff(formData)
            alert('직원 등록 완료')
            window.location.reload();
        } catch (err) {
            alert('직원 등록 실패')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">직원 등록 정보</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                    <label htmlFor="email" className="mb-1 block text-xs text-zinc-600">이메일</label>
                    <input
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="이메일"
                        type="email"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="phone" className="mb-1 block text-xs text-zinc-600">전화번호</label>
                    <input
                        id="phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="전화번호"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="name" className="mb-1 block text-xs text-zinc-600">이름</label>
                    <input
                        id="name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="이름"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1 block text-xs text-zinc-600">비밀번호</label>
                    <input
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="비밀번호"
                        type="password"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="hired_at" className="mb-1 block text-xs text-zinc-600">입사일</label>
                    <input
                        id="hired_at"
                        name="hired_at"
                        value={form.hired_at}
                        onChange={handleChange}
                        type="date"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="birth_date" className="mb-1 block text-xs text-zinc-600">생일</label>
                    <input
                        id="birth_date"
                        name="birth_date"
                        value={form.birth_date ?? ''}
                        onChange={handleChange}
                        type="date"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="role_id" className="mb-1 block text-xs text-zinc-600">역할</label>
                    <select
                        id="role_id"
                        name="role_id"
                        value={form.role_id ?? ''}
                        onChange={handleNumberSelectChange}
                        className={inputClass}
                    >
                        <option value="">권한을 선택하세요</option>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="department_id" className="mb-1 block text-xs text-zinc-600">소속 부서</label>
                    <select
                        id="department_id"
                        name="department_id"
                        value={selectedDepartmentId}
                        onChange={handleDepartmentChange}
                        className={inputClass}
                    >
                        <option value="">부서를 선택하세요</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>
                                {dept.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="team_id" className="mb-1 block text-xs text-zinc-600">소속 팀</label>
                    <select
                        id="team_id"
                        name="team_id"
                        value={form.team_id ?? ''}
                        onChange={handleNumberSelectChange}
                        className={inputClass}
                    >
                        <option value="">팀을 선택하세요</option>
                        {visibleTeams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2 xl:col-span-4">
                    <label htmlFor="profile_image" className="mb-1 block text-xs text-zinc-600">프로필 이미지</label>
                    <div className="flex items-end gap-3">
                        <input
                            id="profile_image"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setProfileImage(e.target.files[0])
                                }
                            }}
                            className={inputClass}
                        />
                        {profileImage ? (
                            <img
                                src={URL.createObjectURL(profileImage)}
                                alt="프로필 미리보기"
                                className="h-16 w-16 rounded-md border border-zinc-300 object-cover"
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    type="submit"
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                    등록
                </button>
            </div>
        </form>
    )
}
