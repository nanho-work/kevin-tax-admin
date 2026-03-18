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
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'

export default function StaffTable({
    canManage = false,
    initialPanel = null,
}: {
    canManage?: boolean
    initialPanel?: 'org' | null
}) {
    const inputClass =
        'text-sm text-zinc-900'

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
                    <UiSearchInput
                        value={keyword}
                        onChange={(value) => {
                            setKeyword(value)
                            setPage(1)
                        }}
                        placeholder="로그인아이디 / 이름 / 이메일 / 전화 검색"
                        wrapperClassName="w-full md:w-[320px]"
                        inputClassName={inputClass}
                    />
                    <div aria-hidden="true" />
                    <div className="flex items-center justify-end gap-2">
                        {canManage ? (
                          <div className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 p-0.5">
                              <UiButton
                                  onClick={() => setShowOrgAclPanel(false)}
                                  variant={!showOrgAclPanel ? 'tabActive' : 'tabInactive'}
                                  size="sm"
                              >
                                  직원목록
                              </UiButton>
                              <UiButton
                                  onClick={() => setShowOrgAclPanel(true)}
                                  variant={showOrgAclPanel ? 'tabActive' : 'tabInactive'}
                                  size="sm"
                              >
                                  권한/조직배치
                              </UiButton>
                          </div>
                        ) : null}
                        <UiButton
                            onClick={() => {
                                setShowInactive((prev) => !prev)
                                setPage(1)
                            }}
                            variant={showInactive ? 'danger' : 'secondary'}
                            size="md"
                        >
                            {showInactive ? '재직자 보기' : '퇴사자 보기'}
                        </UiButton>
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
                                                    <UiButton
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStaff(staff)
                                                        }}
                                                        size="xs"
                                                        variant="secondary"
                                                        className="h-auto border-0 bg-transparent px-0 py-0 text-blue-700 hover:bg-transparent hover:underline"
                                                    >
                                                        {staff.name}
                                                    </UiButton>
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
                                                    <UiButton
                                                        type="button"
                                                        onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                                                        size="xs"
                                                        variant={staff.is_active ? 'soft' : 'danger'}
                                                        className={staff.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                                                    >
                                                        {staff.is_active ? '재직중' : '퇴사'}
                                                    </UiButton>
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

                <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
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
