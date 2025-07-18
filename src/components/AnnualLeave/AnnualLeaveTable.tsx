'use client'

import { useEffect, useState } from 'react'
import { fetchAnnualLeaves } from '@/services/annualLeaveService'
import type { AnnualLeave } from '@/types/annualLeave'
import Pagination from '@/components/common/Pagination'

export default function AnnualLeaveTable() {
    const [leaves, setLeaves] = useState<AnnualLeave[]>([])
    const [total, setTotal] = useState(0)
    const [year, setYear] = useState<number | undefined>(undefined)
    const [keyword, setKeyword] = useState('')
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const limit = 10

    useEffect(() => {
        loadData()
    }, [page, year, keyword])

    const loadData = async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit
            const res = await fetchAnnualLeaves({ year, keyword, offset, limit })
            setLeaves(res.items)
            setTotal(res.total)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    placeholder="연도"
                    value={year || ''}
                    onChange={(e) => setYear(Number(e.target.value) || undefined)}
                    className="border px-2 py-1 rounded"
                />
                <input
                    type="text"
                    placeholder="이름 검색"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="border px-2 py-1 rounded"
                />
                <button onClick={() => setPage(1)} className="bg-blue-500 text-white px-3 py-1 rounded">
                    검색
                </button>
            </div>

            {loading ? (
                <p>로딩 중...</p>
            ) : (
                <table className="w-full text-center table-auto border-collapse border">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border p-2">이름</th>
                            <th className="border p-2">부여일</th>
                            <th className="border p-2">부여 일수</th>
                            <th className="border p-2">사용 일수</th>
                            <th className="border p-2">만료일</th>
                            <th className="border p-2">메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaves.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center p-4">데이터 없음</td>
                            </tr>
                        ) : (
                            leaves.map((leave) => (
                                <tr key={leave.id}>
                                    <td className="border p-2">{leave.admin_name}</td>
                                    <td className="border p-2">{leave.grant_date}</td>
                                    <td className="border p-2">{leave.granted_days}</td>
                                    <td className="border p-2">{leave.used_days}</td>
                                    <td className="border p-2">{leave.expired_at || '-'}</td>
                                    <td className="border p-2">{leave.memo || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}

            <Pagination
                page={page}
                total={total}
                limit={limit}
                onPageChange={(newPage) => setPage(newPage)}
            />
        </div>
    )
}