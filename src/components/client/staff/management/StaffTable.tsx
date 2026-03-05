// ✅ 직원 목록 테이블 (검색 및 페이징 포함)
'use client'

import { useEffect, useState } from 'react'
import { AdminOut } from '@/types/admin'
import {
    getClientStaffs, activateClientStaff,
    deactivateClientStaff,
} from '@/services/client/clientStaffService'
import StaffDetailModal from './StaffDetailModal'

export default function StaffTable({ canManage = false }: { canManage?: boolean }) {
    const inputClass =
        'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

    const [staffs, setStaffs] = useState<AdminOut[]>([])
    const [keyword, setKeyword] = useState('')
    const [searchText, setSearchText] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const limit = 10

    const [selectedStaff, setSelectedStaff] = useState<AdminOut | null>(null)
    const [showDetail, setShowDetail] = useState(false)

    useEffect(() => {
        const loadStaffs = async () => {
            try {
                const res = await getClientStaffs(page, limit, keyword)
                setStaffs(res.items)
                setTotal(res.total)
            } catch (err) {
                console.error('직원 목록 불러오기 실패', err)
            }
        }

        loadStaffs()
    }, [page, keyword])

    const totalPages = Math.ceil(total / limit)

    const handleSearch = () => {
        setPage(1)
        setKeyword(searchText.trim())
    }

    const handleToggleStatus = async (id: number, is_active: boolean) => {
        try {
            if (is_active) {
                await deactivateClientStaff(id)
            } else {
                await activateClientStaff(id)
            }
            // 성공 후 목록 새로고침
            const res = await getClientStaffs(page, limit, keyword)
            setStaffs(res.items)
            setTotal(res.total)
        } catch (err) {
            alert('활성/비활성화 실패')
            console.error('활성/비활성화 실패:', err)
        }
    }

    return (
        <div>
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">검색</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input
                        type="text"
                        placeholder="이름 / 이메일 / 전화 검색"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSearch()
                            }
                        }}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={handleSearch}
                        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                    >
                        조회
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchText('')
                            setKeyword('')
                            setPage(1)
                        }}
                        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                    >
                        초기화
                    </button>
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
                                  {canManage ? (
                                    <button
                                      onClick={() => {
                                        setSelectedStaff(staff)
                                        setShowDetail(true)
                                      }}
                                      className="text-blue-700 hover:underline"
                                    >
                                      {staff.name}
                                    </button>
                                  ) : (
                                    <span>{staff.name}</span>
                                  )}
                                </td>
                                <td className="border p-2 text-center">{staff.email}</td>
                                <td className="border p-2 text-center">{staff.phone || '-'}</td>
                                <td className="border p-2 text-center">
                                    {staff.role?.name ?? '-'}
                                </td>
                                <td className="border p-2 text-center">{staff.hired_at || '-'}</td>
                                
                                <td className="border p-2 text-center">
                                    {canManage ? (
                                        <button
                                            onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                            className={`text-sm font-medium ${staff.is_active ? 'text-green-600' : 'text-red-600'} hover:underline`}
                                        >
                                            {staff.is_active ? '재직중' : '퇴사'}
                                        </button>
                                    ) : (
                                        <span className={`text-sm font-medium ${staff.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                            {staff.is_active ? '재직중' : '퇴사'}
                                        </span>
                                    )}
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

            {canManage && selectedStaff && (
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
