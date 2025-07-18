// ✅ 직원 목록 테이블 (검색 및 페이징 포함)
'use client'

import { useEffect, useState } from 'react'
import { Admin, UpdateStaffRequest } from '@/types/staff'
import {
    fetchAdminStaffs, activateAdminStaff,
    deactivateAdminStaff, updateAdminStaff,
} from '@/services/staffService'
import StaffDetailModal from './StaffDetailModal'

export default function StaffTable() {
    const [staffs, setStaffs] = useState<Admin[]>([])
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const limit = 10

    const [selectedStaff, setSelectedStaff] = useState<Admin | null>(null)
    const [showDetail, setShowDetail] = useState(false)

    useEffect(() => {
        const loadStaffs = async () => {
            try {
                const res = await fetchAdminStaffs(page, limit, keyword)
                setStaffs(res.items)
                setTotal(res.total)
            } catch (err) {
                console.error('직원 목록 불러오기 실패', err)
            }
        }

        loadStaffs()
    }, [page, keyword])

    const totalPages = Math.ceil(total / limit)

    const handleToggleStatus = async (id: number, is_active: boolean) => {
        console.log('토글 요청: id =', id, '현재 상태 =', is_active)
        try {
            console.log('직원 객체 확인:', { id, is_active })
            if (is_active) {
                await deactivateAdminStaff(id)
            } else {
                await activateAdminStaff(id)
            }
            console.log('토글 성공')
            // 성공 후 목록 새로고침
            const res = await fetchAdminStaffs(page, limit, keyword)
            setStaffs(res.items)
            setTotal(res.total)
        } catch (err) {
            alert('활성/비활성화 실패')
            console.error('활성/비활성화 실패:', err)
        }
    }

    return (
        <div>
            {/* 검색 입력창 + 등록 폼을 가로 정렬 */}
            <div className="flex text-sm  justify-between items-end mb-4">
                {/* 🔍 검색 라벨 + 입력창 */}
                <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-gray-700">직원 검색 : </span>
                    <input
                        type="text"
                        placeholder="이름 / 이메일 / 전화 검색"
                        value={keyword}
                        onChange={(e) => {
                            setKeyword(e.target.value)
                            setPage(1)
                        }}
                        className="border px-2 py-1 rounded w-64"
                    />
                </div>
            </div>


            {/* 직원 테이블 */}
            <table className="w-full border text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2">프로필</th>
                        <th className="border p-2">이름</th>
                        <th className="border p-2">이메일</th>
                        <th className="border p-2">연락처</th>
                        <th className="border p-2">직급</th>
                        <th className="border p-2">입사일</th>
                        <th className="border p-2">재직여부(클릭시 변경)</th>
                    </tr>
                </thead>
                <tbody>
                    {staffs.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="border p-2 text-center text-gray-500">
                                검색된 직원이 없습니다.
                            </td>
                        </tr>
                    ) : (
                        staffs.map((staff) => {
                            console.log('렌더링 중인 staff 객체:', staff)
                            return (
                            <tr
                                key={staff.id}
                                className={`${!staff.is_active ? 'bg-gray-200' : ''}`}
                            >
                                <td className="border p-2 text-center">
                                    {staff.profile_image_url ? (
                                      <img src={staff.profile_image_url} alt="프로필 이미지" className="w-12 h-14 rounded-full mx-auto" />
                                    ) : '-'}
                                </td>
                                <td className="border p-2 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedStaff(staff)
                                      setShowDetail(true)
                                    }}
                                    className="text-blue-700 hover:underline"
                                  >
                                    {staff.name}
                                  </button>
                                </td>
                                <td className="border p-2 text-center">{staff.email}</td>
                                <td className="border p-2 text-center">{staff.phone || '-'}</td>
                                <td className="border p-2 text-center">
                                    {staff.role?.name ?? '-'}
                                </td>
                                <td className="border p-2 text-center">{staff.hired_at || '-'}</td>
                                
                                <td className="border p-2 text-center">
                                    <button
                                        onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                        className={`text-sm font-medium ${staff.is_active ? 'text-green-600' : 'text-red-600'} hover:underline`}
                                    >
                                        {staff.is_active ? '재직중' : '퇴사'}
                                    </button>
                                </td>
                            </tr>
                            )
                        })
                    )}
                </tbody>
            </table>

            {/* 페이지 네비게이션 */}
            <div className="mt-4 flex justify-center items-center gap-2 text-sm">
                <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    ◀
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                    .map((p, idx, arr) => {
                        const isEllipsis = idx > 0 && p - arr[idx - 1] > 1
                        return isEllipsis ? (
                            <span key={`ellipsis-${p}`} className="px-1">...</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`px-3 py-1 rounded border ${p === page ? 'bg-blue-600 text-white font-semibold' : 'bg-white hover:bg-gray-100'
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    })}

                <button
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    ▶
                </button>
            </div>

            {selectedStaff && (
              <StaffDetailModal
                staff={selectedStaff}
                onClose={() => {
                  setSelectedStaff(null)
                  setShowDetail(false)
                }}
              />
            )}
        </div >
    )
}