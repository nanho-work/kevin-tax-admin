// ✅ 직원 목록 테이블 (검색 및 페이징 포함)
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { AdminOut } from '@/types/admin'
import {
    getClientStaffs, activateClientStaff,
    deactivateClientStaff,
} from '@/services/client/clientStaffService'
import StaffDetailModal from './StaffDetailModal'
import ClientAclMatrixPage from '../ClientAclMatrixPage'

export default function StaffTable({
    canManage = false,
    initialPanel = null,
}: {
    canManage?: boolean
    initialPanel?: 'org' | null
}) {
    const inputClass =
        'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

    const [staffs, setStaffs] = useState<AdminOut[]>([])
    const [keyword, setKeyword] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [listError, setListError] = useState<string | null>(null)
    const limit = 10

    const [selectedStaff, setSelectedStaff] = useState<AdminOut | null>(null)
    const [showOrgAclPanel, setShowOrgAclPanel] = useState(initialPanel === 'org')

    const visibleStaffs = staffs.filter((staff) => (showInactive ? !staff.is_active : staff.is_active))

    const loadStaffs = async (nextPage = page, nextKeyword = keyword) => {
        try {
            const res = await getClientStaffs(nextPage, limit, nextKeyword)
            setStaffs(res.items)
            setTotal(res.total)
            setListError(null)
        } catch (err) {
            console.error('직원 목록 불러오기 실패', err)
            setListError('직원 목록을 불러오지 못했습니다.')
        }
    }

    useEffect(() => {
        loadStaffs(page, keyword)
    }, [page, keyword])

    useEffect(() => {
        if (!canManage) return
        setShowOrgAclPanel(initialPanel === 'org')
    }, [canManage, initialPanel])

    const totalPages = Math.ceil(total / limit)

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
            toast.error('재직 상태 변경에 실패했습니다.')
            console.error('활성/비활성화 실패:', err)
        }
    }

    return (
        <section className="space-y-4">
            <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[320px_minmax(0,1fr)_auto]">
                    <input
                        type="text"
                        placeholder="로그인아이디 / 이름 / 이메일 / 전화 검색"
                        value={keyword}
                        onChange={(e) => {
                            setKeyword(e.target.value)
                            setPage(1)
                        }}
                        className={inputClass}
                    />
                    <div aria-hidden="true" />
                    <div className="flex items-center justify-end gap-2">
                        {canManage ? (
                          <div className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 p-0.5">
                              <button
                                  type="button"
                                  onClick={() => setShowOrgAclPanel(false)}
                                  className={`rounded px-3 py-1.5 text-sm transition ${
                                      !showOrgAclPanel
                                          ? 'bg-white text-zinc-900 shadow-sm'
                                          : 'text-zinc-600 hover:text-zinc-900'
                                  }`}
                              >
                                  직원목록
                              </button>
                              <button
                                  type="button"
                                  onClick={() => setShowOrgAclPanel(true)}
                                  className={`rounded px-3 py-1.5 text-sm transition ${
                                      showOrgAclPanel
                                          ? 'bg-white text-zinc-900 shadow-sm'
                                          : 'text-zinc-600 hover:text-zinc-900'
                                  }`}
                              >
                                  권한/조직배치
                              </button>
                          </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                setShowInactive((prev) => !prev)
                                setPage(1)
                            }}
                            className={`rounded-md border px-4 py-2 text-sm transition ${
                                showInactive
                                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                            }`}
                        >
                            {showInactive ? '재직자 보기' : '퇴사자 보기'}
                        </button>
                    </div>
                </div>
            </div>

            {showOrgAclPanel ? (
              <ClientAclMatrixPage />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs text-zinc-600">
                            <tr>
                                <th className="px-3 py-3 text-center">프로필</th>
                                <th className="px-3 py-3 text-center">이름</th>
                                <th className="px-3 py-3 text-center">로그인아이디</th>
                                <th className="px-3 py-3 text-center">이메일</th>
                                <th className="px-3 py-3 text-center">생일</th>
                                <th className="px-3 py-3 text-center">연락처</th>
                                <th className="px-3 py-3 text-center">직급</th>
                                <th className="px-3 py-3 text-center">소속 팀</th>
                                <th className="px-3 py-3 text-center">입사일</th>
                                <th className="px-3 py-3 text-center">재직여부</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {listError ? (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-rose-600">
                                        {listError}
                                    </td>
                                </tr>
                            ) : visibleStaffs.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-zinc-500">
                                        {showInactive ? '퇴사한 직원이 없습니다.' : '재직 중인 직원이 없습니다.'}
                                    </td>
                                </tr>
                            ) : (
                                visibleStaffs.map((staff) => {
                                    return (
                                        <tr key={staff.id} className={!staff.is_active ? 'bg-zinc-100' : 'even:bg-zinc-50/40'}>
                                            <td className="px-3 py-3 text-center">
                                                {staff.profile_image_url ? (
                                                    <img
                                                        src={staff.profile_image_url}
                                                        alt="프로필 이미지"
                                                        className="mx-auto h-12 w-12 rounded-full border border-zinc-200 object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-zinc-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedStaff(staff)
                                                        }}
                                                        className="text-blue-700 hover:underline"
                                                    >
                                                        {staff.name}
                                                    </button>
                                                ) : (
                                                    <span>{staff.name}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">{staff.login_id || '-'}</td>
                                            <td className="px-3 py-3 text-center">{staff.email}</td>
                                            <td className="px-3 py-3 text-center">{staff.birth_date || '-'}</td>
                                            <td className="px-3 py-3 text-center">{staff.phone || '-'}</td>
                                            <td className="px-3 py-3 text-center">{staff.role?.name ?? '-'}</td>
                                            <td className="px-3 py-3 text-center">{staff.team?.name ?? '-'}</td>
                                            <td className="px-3 py-3 text-center">{staff.hired_at || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                                        className={`rounded px-2 py-1 text-xs font-medium ${
                                                            staff.is_active
                                                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                        }`}
                                                    >
                                                        {staff.is_active ? '재직중' : '퇴사'}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`rounded px-2 py-1 text-xs font-medium ${
                                                            staff.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                        }`}
                                                    >
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
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                    <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page === 1}
                        className="rounded border border-zinc-300 bg-white px-3 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
                                    className={`rounded border px-3 py-1 ${
                                        p === page
                                            ? 'border-zinc-800 bg-zinc-900 font-semibold text-white'
                                            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        })}

                    <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page === totalPages}
                        className="rounded border border-zinc-300 bg-white px-3 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                        ▶
                    </button>
                </div>
              </>
            )}

            {canManage && selectedStaff && (
              <StaffDetailModal
                staff={selectedStaff}
                onSaved={async () => {
                  await loadStaffs(page, keyword)
                }}
                onClose={() => {
                  setSelectedStaff(null)
                }}
              />
            )}
        </section>
    )
}
