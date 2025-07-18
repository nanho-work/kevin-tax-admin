// ✅ 직원 상세 정보 모달
// - 상세 보기 버튼 클릭 시 오픈
// - 전달된 직원(Admin) 데이터를 보여주는 UI
// - 수정폼 연동 또는 상태 토글 가능

'use client'

import { Admin } from '@/types/staff'
import { useEffect, useRef, useState } from 'react'
import { updateAdminStaff } from '@/services/staffService'
import type { UpdateStaffRequest } from '@/types/staff'

type StaffRole = NonNullable<UpdateStaffRequest['role']>

interface Props {
  staff: Admin
  onClose: () => void
}

export default function StaffDetailModal({ staff, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    phone: staff.phone || '',
    role: staff.role,
    profile_image: null as File | null,
    profile_image_url: staff.profile_image_url || '',
    hired_at: staff.hired_at || '',
    retired_at: staff.retired_at || '',
    name: staff.name || '',
  })
  useEffect(() => {
    if (staff) {
      setForm({
        phone: staff.phone || '',
        role: staff.role,
        profile_image: null,
        profile_image_url: staff.profile_image_url || '',
        hired_at: staff.hired_at || '',
        retired_at: staff.retired_at || '',
        name: staff.name || '',
      })
    }
  }, [staff])

  console.log('초기 데이터:', staff);

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('phone', form.phone)
      formData.append('role', form.role)
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
  const roleLabelMap: Record<string, string> = {
    SUPER: '대표',
    MASTER: '관리자',
    CLERK_ASSIST: '선임',
    CLERK_SENIOR: '책임',
    CLERK_MANAGER: '수석',
    TAX_JUNIOR: '세무 주니어',
    TAX_SENIOR: '세무 시니어',
    TAX_MANAGER: '세무 매니저',
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
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
            {staff.name} {roleLabelMap[staff.role] || staff.role}님
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
          {staff.role === 'SUPER' || staff.role === 'MASTER' ? (
            <p>{roleLabelMap[staff.role] || staff.role}</p>
          ) : (
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as StaffRole }))}
              className="border px-2 py-1 w-full rounded"
            >
              <option value="CLERK_ASSIST">선임</option>
              <option value="CLERK_SENIOR">책임</option>
              <option value="CLERK_MANAGER">수석</option>
              <option value="TAX_JUNIOR">세무 주니어</option>
              <option value="TAX_SENIOR">세무 시니어</option>
              <option value="TAX_MANAGER">세무 매니저</option>
            </select>
          )}
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