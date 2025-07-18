'use client'

import { useEffect, useState } from 'react'
import { getAttendanceLogs } from '@/services/staffService'
import type { AttendanceLog } from '@/types/staff'
import Pagination from '../common/Pagination'

function formatTime(dateTime?: string | null): string {
    return dateTime?.split('T')[1]?.slice(0, 5) || '-'
}

export default function AttendanceLogTable() {
    const [logs, setLogs] = useState<AttendanceLog[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [limit] = useState(10)
    const [total, setTotal] = useState(0)
    const [keyword, setKeyword] = useState('')
    const [dateFrom, setDateFrom] = useState<string>(() => new Date().toISOString().split('T')[0])
    const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0])

    // fetch logs with paging and optional admin name filter
    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true)
            try {
                const offset = (page - 1) * limit
                const { items, total: totalCount } = await getAttendanceLogs({
                    offset,
                    limit,
                    keyword: keyword.trim(),
                    date_from: dateFrom,
                    date_to: dateTo,
                })

                setLogs(items)
                setTotal(totalCount)
            } catch (error) {
                console.error('출퇴근 기록 조회 실패:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchLogs()
    }, [page, limit, keyword, dateFrom, dateTo])

    const totalPages = Math.ceil(total / limit) || 1

    return (
        <div>
            <div className="mb-4 flex text-sm items-center gap-4">
                <input
                    type="text"
                    placeholder="이름"
                    value={keyword}
                    onChange={e => {
                        setKeyword(e.target.value)
                        setPage(1)
                    }}
                    className="border p-2 rounded"
                />
                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => {
                        setDateFrom(e.target.value)
                        setPage(1)
                    }}
                    className="border p-2 rounded"
                />
                <span>~</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => {
                        setDateTo(e.target.value)
                        setPage(1)
                    }}
                    className="border p-2 rounded"
                />
            </div>
            {loading ? (
                <p>로딩 중...</p>
            ) : !logs.length ? (
                <p>출퇴근 기록이 없습니다.</p>
            ) : (
                <table className="min-w-full border text-sm text-center">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="p-2 border">이름</th>
                            <th className="p-2 border">날짜</th>
                            <th className="p-2 border">출근 시간</th>
                            <th className="p-2 border">퇴근 시간</th>
                            <th className="p-2 border">메모</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log, index) => (
                            <tr key={log.id ?? `no-log-${index}`}>
                                <td className="p-2 border">{log.admin_name || log.admin_id}</td>
                                <td className="p-2 border">{log.date ?? '-'}</td>
                                <td className="p-2 border">{formatTime(log.check_in)}</td>
                                <td className="p-2 border">{formatTime(log.check_out)}</td>
                                <td className="p-2 border">{log.memo ?? '-'}</td>
                            </tr>
                        ))}
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