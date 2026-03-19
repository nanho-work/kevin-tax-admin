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

type Props = {
    title?: string
    onCancel?: () => void
    onSuccess?: () => void
}

function formatPhoneNumber(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formatFlexibleDateInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (!digits) return ''
    if (digits.length <= 4) return digits
    if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

function normalizeFlexibleDate(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return ''
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function createInitialForm(): CreateStaffRequest {
    return {
        login_id: '',
        email: '',
        name: '',
        password: '',
        phone: '',
        hired_at: '',
        birth_date: '',
        initial_remaining_days: '',
        client_id: 0,
        team_id: undefined,
        role_id: undefined,
    }
}

export default function StaffForm({ title = '직원 등록 정보', onCancel, onSuccess }: Props) {
    const inputClass =
        'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

    const [form, setForm] = useState<CreateStaffRequest>(createInitialForm())
    const [profileImage, setProfileImage] = useState<File | null>(null)
    const [roles, setRoles] = useState<RoleOut[]>([])
    const [teams, setTeams] = useState<TeamOut[]>([])
    const [departments, setDepartments] = useState<DepartmentOut[]>([])
    const [visibleTeams, setVisibleTeams] = useState<TeamOut[]>([])
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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
        setMessage(null)
        const normalizedValue =
            name === 'initial_remaining_days'
                ? value.replace(/[^0-9.]/g, '')
                : name === 'phone'
                  ? formatPhoneNumber(value)
                  : name === 'hired_at' || name === 'birth_date'
                    ? formatFlexibleDateInput(value)
                    : value
        setForm({
            ...form,
            [name]: normalizedValue,
        })
    }

    const handleNumberSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target
        setMessage(null)
        setForm({
            ...form,
            [name]: value ? Number(value) : undefined,
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setSubmitting(true)
            setMessage(null)
            if (!form.login_id.trim()) {
                setMessage({ type: 'error', text: '로그인 아이디를 입력해 주세요.' })
                return
            }
            if (form.initial_remaining_days !== '') {
                const parsedInitialRemainingDays = Number(form.initial_remaining_days)
                if (!Number.isFinite(parsedInitialRemainingDays) || parsedInitialRemainingDays < 0) {
                    setMessage({ type: 'error', text: '초기 잔여 연차는 0 이상으로 입력해 주세요.' })
                    return
                }
            }

            await createClientStaff({
              ...form,
              login_id: form.login_id.trim(),
              hired_at: normalizeFlexibleDate(form.hired_at ?? ''),
              birth_date: normalizeFlexibleDate(form.birth_date ?? ''),
              initial_remaining_days:
                form.initial_remaining_days !== '' ? String(Number(form.initial_remaining_days)) : '',
              profile_image: profileImage,
            })
            setMessage({ type: 'success', text: '직원 등록이 완료되었습니다.' })
            setForm((prev) => ({ ...createInitialForm(), client_id: prev.client_id }))
            setProfileImage(null)
            setSelectedDepartmentId('')
            setVisibleTeams(teams)
            onSuccess?.()
        } catch (err: any) {
            const detail = err?.response?.data?.detail
            const messageText =
              typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((item: any) => item?.msg).filter(Boolean).join(', ')
                  : '직원 등록에 실패했습니다.'
            setMessage({ type: 'error', text: messageText })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                        닫기
                    </button>
                ) : null}
            </div>
            {message ? (
                <div
                    className={`mt-3 rounded-md px-3 py-2 text-sm ${
                        message.type === 'success'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                >
                    {message.text}
                </div>
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                    <label htmlFor="login_id" className="mb-1 block text-xs text-zinc-600">로그인 아이디</label>
                    <input
                        id="login_id"
                        name="login_id"
                        value={form.login_id}
                        onChange={handleChange}
                        placeholder="로그인 아이디"
                        className={inputClass}
                    />
                </div>
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
                        inputMode="numeric"
                        placeholder="YYYY.MM.DD"
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
                        inputMode="numeric"
                        placeholder="YYYY.MM.DD"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="initial_remaining_days" className="mb-1 block text-xs text-zinc-600">초기 잔여 연차</label>
                    <input
                        id="initial_remaining_days"
                        name="initial_remaining_days"
                        type="text"
                        inputMode="decimal"
                        value={form.initial_remaining_days ?? ''}
                        onChange={handleChange}
                        placeholder="예: 11.5"
                        className={inputClass}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">기존 직원 도입 시 현재 남은 연차를 입력합니다.</p>
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
                    disabled={submitting}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? '등록 중...' : '등록'}
                </button>
            </div>
        </form>
    )
}
