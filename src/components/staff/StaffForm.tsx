// ✅ 직원 등록/수정 폼
// - createAdminStaff 또는 updateAdminStaff를 호출
// - props로 수정 모드 / 기존 데이터 받을 수 있음
// - role, name, phone, email, password 입력 필드 구성

'use client'

import { useState } from 'react'
import type { CreateStaffRequest } from '@/types/staff'
import { createAdminStaff } from '@/services/staffService'

// ✅ 직원 등록 폼 컴포넌트
// - 신규 직원을 등록할 때 사용하는 폼
// - 입력 필드: 이메일, 이름, 비밀번호, 전화번호, 역할
// - 제출 시 createAdminStaff() 서비스 호출

export default function StaffForm() {
    // 📌 form 상태 선언
    // - CreateStaffRequest 타입 기반으로 초기값 설정
    // - role은 기본값 'CLERK_ASSIST'로 설정
    const [form, setForm] = useState<CreateStaffRequest>({
        email: '',
        name: '',
        password: '',
        phone: '',
        role: 'CLERK_ASSIST',
    })

    // 📌 입력 값 변경 핸들러
    // - input/select 요소의 name과 value를 추출하여 form 상태를 업데이트
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setForm({ ...form, [name]: value }) // 기존 값 유지 + 수정된 필드만 업데이트
    }

    // 📌 폼 제출 시 호출되는 함수
    // - 기본 동작 막고(createAdminStaff 호출)
    // - 성공 시 alert, 실패 시 alert
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await createAdminStaff(form) // 서버에 form 데이터를 전송
            alert(`직원 등록 완료: ${res.email}`)    // 성공 메시지
            // TODO: 등록 후 목록 리프레시 또는 폼 초기화 등 후속 처리 필요
        } catch (err) {
            alert('직원 등록 실패') // 에러 발생 시 사용자 알림
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex items-end gap-4 flex-wrap">
            <input name="email" value={form.email} onChange={handleChange} placeholder="이메일" className="border px-2 py-1 w-60" />
            <input name="name" value={form.name} onChange={handleChange} placeholder="이름" className="border px-2 py-1 w-36" />
            <input name="password" value={form.password} onChange={handleChange} placeholder="비밀번호" type="password" className="border px-2 py-1 w-36" />
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="전화번호" className="border px-2 py-1 w-40" />
            <select name="role" value={form.role} onChange={handleChange} className="border px-2 py-1 w-48">
                <option value="CLERK_ASSIST">CLERK_ASSIST</option>
                <option value="CLERK_SENIOR">CLERK_SENIOR</option>
                <option value="CLERK_MANAGER">CLERK_MANAGER</option>
                <option value="TAX_JUNIOR">TAX_JUNIOR</option>
                <option value="TAX_SENIOR">TAX_SENIOR</option>
                <option value="TAX_MANAGER">TAX_MANAGER</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">등록</button>
        </form>
    )
}