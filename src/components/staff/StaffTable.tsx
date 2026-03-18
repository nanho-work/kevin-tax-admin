// ✅ 직원 목록 테이블 (검색 및 페이징 포함)
'use client'

import { useEffect, useState } from 'react'
import { AdminOut } from '@/types/admin'
import {
    getAdminStaffs, activateAdminStaff,
    deactivateAdminStaff, updateAdminStaff,
} from '@/services/adminService'
import StaffDetailModal from './StaffDetailModal'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

export default function StaffTable() {
    const [staffs, setStaffs] = useState<AdminOut[]>([])
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const limit = 10

    const [selectedStaff, setSelectedStaff] = useState<AdminOut | null>(null)
    const [showDetail, setShowDetail] = useState(false)

    useEffect(() => {
        const loadStaffs = async () => {
            try {
                const res = await getAdminStaffs(page, limit, keyword)
                setStaffs(res.items)
                setTotal(res.total)
            } catch (err) {
                console.error('직원 목록 불러오기 실패', err)
            }
        }

        loadStaffs()
    }, [page, keyword])

    const handleToggleStatus = async (id: number, is_active: boolean) => {
        try {
            if (is_active) {
                await deactivateAdminStaff(id)
            } else {
                await activateAdminStaff(id)
            }
            // 성공 후 목록 새로고침
            const res = await getAdminStaffs(page, limit, keyword)
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
                    <UiSearchInput
                        value={keyword}
                        onChange={(value) => {
                            setKeyword(value)
                            setPage(1)
                        }}
                        placeholder="이름 / 이메일 / 전화 검색"
                        wrapperClassName="w-64"
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
                                  <UiButton
                                    type="button"
                                    onClick={() => {
                                      setSelectedStaff(staff)
                                      setShowDetail(true)
                                    }}
                                    size="xs"
                                    variant="secondary"
                                    className="h-auto border-0 bg-transparent px-0 py-0 text-blue-700 hover:bg-transparent hover:underline"
                                  >
                                    {staff.name}
                                  </UiButton>
                                </td>
                                <td className="border p-2 text-center">{staff.email}</td>
                                <td className="border p-2 text-center">{staff.phone || '-'}</td>
                                <td className="border p-2 text-center">
                                    {staff.role?.name ?? '-'}
                                </td>
                                <td className="border p-2 text-center">{staff.hired_at || '-'}</td>
                                
                                <td className="border p-2 text-center">
                                    <UiButton
                                        type="button"
                                        onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                        size="xs"
                                        variant={staff.is_active ? 'soft' : 'danger'}
                                        className={staff.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                                    >
                                        {staff.is_active ? '재직중' : '퇴사'}
                                    </UiButton>
                                </td>
                            </tr>
                            )
                        })
                    )}
                </tbody>
            </table>

            {/* 페이지 네비게이션 */}
            <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />

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
