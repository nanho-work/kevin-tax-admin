// ✅ 직원 등록/수정 폼
// - createAdminStaff 또는 updateAdminStaff를 호출
// - props로 수정 모드 / 기존 데이터 받을 수 있음
// - role, name, phone, email, password 입력 필드 구성

'use client'

import { useState, useEffect } from 'react'
import type { CreateStaffRequest } from '@/types/admin'
import { createAdminStaff, fetchAdminSession } from '@/services/adminService'
import { getRoles } from '@/services/roleService'
import { getTeams } from '@/services/teamService'
import { getDepartments } from '@/services/departmentService'
import type { RoleOut } from '@/types/role'
import type { TeamOut } from '@/types/team'
import type { DepartmentOut } from '@/types/department'

// ✅ 직원 등록 폼 컴포넌트
// - 신규 직원을 등록할 때 사용하는 폼
// - 입력 필드: 이메일, 이름, 비밀번호, 전화번호, 역할
// - 제출 시 createAdminStaff() 서비스 호출

export default function StaffForm() {
    // 📌 form 상태 선언
    // - CreateStaffRequest 타입 기반으로 초기값 설정
    // - role은 기본값 'CLERK_ASSIST'로 설정
    const [form, setForm] = useState<CreateStaffRequest>({
        login_id: '',
        email: '',
        name: '',
        password: '',
        phone: '',
        hired_at: '',
        birth_date: '',
        client_id: 0,
        team_id: undefined,
        role_id: 0,
        // department_id: undefined,
    })
    // 프로필 이미지 상태 추가
    const [profileImage, setProfileImage] = useState<File | null>(null)
    const [roles, setRoles] = useState<RoleOut[]>([])
    const [teams, setTeams] = useState<TeamOut[]>([])
    const [departments, setDepartments] = useState<DepartmentOut[]>([])

    const [visibleTeams, setVisibleTeams] = useState<TeamOut[]>([])
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('')

    useEffect(() => {
        async function loadData() {
            const [roleRes, teamRes, deptRes, sessionRes] = await Promise.all([
                getRoles(),
                getTeams(),
                getDepartments(),
                fetchAdminSession(),
            ])
            setRoles(roleRes)
            setTeams(teamRes)
            setDepartments(deptRes)
            setVisibleTeams(teamRes)
            setForm((prev) => ({
            ...prev,
            client_id: sessionRes.client_id,
        }))
        }
        loadData()
    }, [])

    const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedDeptId = Number(e.target.value)
        const filteredTeams = departments.find(dep => dep.id === selectedDeptId)
          ? teams.filter(team => team.department_id === selectedDeptId)
          : teams

        setForm({ ...form, team_id: undefined })
        setVisibleTeams(filteredTeams)
        setSelectedDepartmentId(selectedDeptId)
    }

    // 📌 입력 값 변경 핸들러
    // - input/select 요소의 name과 value를 추출하여 form 상태를 업데이트
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setForm({ ...form, [name]: value }) // 기존 값 유지 + 수정된 필드만 업데이트
    }

    // 📌 폼 제출 시 호출되는 함수
    // - FormData를 사용하여 파일 포함 제출
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const formData = new FormData()
            formData.append('login_id', form.login_id)
            formData.append('email', form.email)
            formData.append('name', form.name)
            formData.append('password', form.password)
            formData.append('phone', form.phone ?? '')
            formData.append('hired_at', form.hired_at ?? '')
            formData.append('birth_date', form.birth_date ?? '')
            formData.append('client_id', String(form.client_id))
            formData.append('team_id', form.team_id ? String(form.team_id) : '')
            formData.append('role_id', form.role_id ? String(form.role_id) : '')
            // Removed department_id append line
            if (profileImage) {
                formData.append('profile_image', profileImage)
            }

            const res = await createAdminStaff(formData)
            alert(`직원 등록 완료: ${res.email}`)
            window.location.reload();
        } catch (err) {
            alert('직원 등록 실패')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mx-auto max-w-2xl w-full">
            {/* 이메일 + 전화번호 */}
            <div className="flex gap-6">
                <div className="flex flex-col w-full">
                    <label htmlFor="login_id" className="font-medium">로그인 아이디</label>
                    <input
                        id="login_id"
                        name="login_id"
                        value={form.login_id}
                        onChange={handleChange}
                        placeholder="로그인 아이디"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="email" className="font-medium">이메일</label>
                    <input
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="이메일"
                        type="email"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="phone" className="font-medium">전화번호</label>
                    <input
                        id="phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="전화번호"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
            </div>

            {/* 이름 + 비밀번호 */}
            <div className="flex gap-6">
                <div className="flex flex-col w-full">
                    <label htmlFor="name" className="font-medium">이름</label>
                    <input
                        id="name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="이름"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="password" className="font-medium">비밀번호</label>
                    <input
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="비밀번호"
                        type="password"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
            </div>



            {/* 입사일 + 역할 */}
            <div className="flex gap-6">
                <div className="flex flex-col w-full">
                    <label htmlFor="hired_at" className="font-medium">입사일</label>
                    <input
                        id="hired_at"
                        name="hired_at"
                        value={form.hired_at}
                        onChange={handleChange}
                        type="date"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="birth_date" className="font-medium">생일</label>
                    <input
                        id="birth_date"
                        name="birth_date"
                        value={form.birth_date ?? ''}
                        onChange={handleChange}
                        type="date"
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="role_id" className="font-medium">역할</label>
                    <select
                        id="role_id"
                        name="role_id"
                        value={form.role_id}
                        onChange={handleChange}
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                        <option value="">권한을 선택하세요</option>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="department_id" className="font-medium">소속 부서</label>
                    <select
                        id="department_id"
                        name="department_id"
                        value={selectedDepartmentId}
                        onChange={handleDepartmentChange}
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                        <option value="">부서를 선택하세요</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>
                                {dept.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col w-full">
                    <label htmlFor="team_id" className="font-medium">소속 팀</label>
                    <select
                        id="team_id"
                        name="team_id"
                        value={form.team_id ?? ''}
                        onChange={handleChange}
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                        <option value="">팀을 선택하세요</option>
                        {visibleTeams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {/* 프로필 업로드 + 미리보기 */}
            <div className="flex gap-6 items-end">
                <div className="flex flex-col w-60">
                    <label htmlFor="profile_image" className="font-medium">프로필 이미지</label>
                    <input
                        id="profile_image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            if (e.target.files?.[0]) {
                                setProfileImage(e.target.files[0])
                            }
                        }}
                        className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    />
                </div>
                {profileImage && (
                    <img
                        src={URL.createObjectURL(profileImage)}
                        alt="프로필 미리보기"
                        className="rounded-md w-20 h-20 object-cover border"
                    />
                )}
            </div>

            {/* 등록 버튼 */}
            <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 transition font-semibold mt-5 w-40 self-center"
            >
                등록
            </button>
        </form>
    )
}
