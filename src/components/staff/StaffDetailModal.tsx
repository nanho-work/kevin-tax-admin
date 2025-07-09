// ✅ 직원 상세 정보 모달
// - 상세 보기 버튼 클릭 시 오픈
// - 전달된 직원(Admin) 데이터를 보여주는 UI
// - 수정폼 연동 또는 상태 토글 가능

'use client'

import { Admin } from '@/types/staff'

interface Props {
  staff: Admin
  onClose: () => void
}

export default function StaffDetailModal({ staff, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded w-96 shadow-lg">
        <h2 className="text-lg font-bold mb-4">직원 상세 정보</h2>
        <p><strong>이름:</strong> {staff.name}</p>
        <p><strong>이메일:</strong> {staff.email}</p>
        <p><strong>연락처:</strong> {staff.phone ?? '-'}</p>
        <p><strong>권한:</strong> {staff.role}</p>
        <p><strong>상태:</strong> {staff.is_active ? '활성' : '비활성'}</p>
        <p><strong>생성일:</strong> {staff.created_at}</p>
        <p><strong>마지막 로그인:</strong> {staff.last_login_at ?? '-'}</p>

        <button onClick={onClose} className="mt-4 bg-gray-600 text-white px-4 py-2 rounded">닫기</button>
      </div>
    </div>
  )
}