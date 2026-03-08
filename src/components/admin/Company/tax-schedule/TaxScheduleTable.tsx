'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchTaxSchedules, updateTaxScheduleStatus } from '@/services/admin/taxSchedulService'
import { TaxSchedule } from '@/types/taxSchedule'
import { toast } from 'react-hot-toast'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type TaxColumnKey = 'VAT' | 'WITHHOLDING' | 'INCOME_TAX'

type TaxCellData = {
  id: number
  status: string
  due_date: string
}

type CompanyScheduleRow = {
  company_name: string
  memo: string
  taxes: Partial<Record<TaxColumnKey, TaxCellData>>
}

function toDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function mapScheduleType(type?: string): TaxColumnKey | null {
  if (!type) return null
  const normalized = type.toUpperCase()
  if (normalized === 'VAT' || normalized.includes('부가세')) return 'VAT'
  if (normalized === 'WITHHOLDING' || normalized.includes('원천')) return 'WITHHOLDING'
  if (normalized === 'INCOME_TAX' || normalized.includes('소득')) return 'INCOME_TAX'
  return null
}

function toCellStatus(status?: string) {
  const normalized = (status || '').toLowerCase()
  if (normalized.includes('완료') || normalized.includes('done') || normalized.includes('complete')) {
    return '마감'
  }
  return '예정'
}

function statusBadgeClass(statusLabel: string) {
  if (statusLabel === '마감') return 'bg-emerald-50 text-emerald-700'
  return 'bg-amber-50 text-amber-700'
}

export default function TaxScheduleTable() {
  const [schedules, setSchedules] = useState<TaxSchedule[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchTaxSchedules()
        setSchedules(data)
      } catch (error) {
        console.error('스케줄 불러오기 실패:', error)
        setError('세무 일정을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    void loadSchedules()
  }, [])

  const groupedRows = useMemo(() => {
    const rows = new Map<string, CompanyScheduleRow>()

    for (const item of schedules) {
      const companyName = item.company_name?.trim()
      if (!companyName) continue

      const current = rows.get(companyName) ?? {
        company_name: companyName,
        memo: '',
        taxes: {},
      }

      const taxKey = mapScheduleType(item.schedule_type)
      if (taxKey) {
        const prev = current.taxes[taxKey]
        const prevTime = prev ? new Date(prev.due_date).getTime() : -Infinity
        const nextTime = item.due_date ? new Date(item.due_date).getTime() : -Infinity
        if (!prev || nextTime >= prevTime) {
          current.taxes[taxKey] = {
            id: item.id,
            status: item.status || '',
            due_date: item.due_date || '',
          }
        }
      }

      if (item.memo?.trim()) {
        const memoSet = new Set(
          current.memo
            .split(' / ')
            .map((memo) => memo.trim())
            .filter(Boolean)
        )
        memoSet.add(item.memo.trim())
        current.memo = Array.from(memoSet).join(' / ')
      }

      rows.set(companyName, current)
    }

    return Array.from(rows.values())
      .filter((row) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return row.company_name.toLowerCase().includes(q)
      })
      .sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
  }, [query, schedules])

  const handleToggleStatus = async (cell: TaxCellData, cellKey: string) => {
    const current = (cell.status || '').toUpperCase()
    const nextStatus = current === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED'
    try {
      setUpdatingKey(cellKey)
      const updated = await updateTaxScheduleStatus(cell.id, nextStatus)
      setSchedules((prev) => prev.map((item) => (item.id === cell.id ? { ...item, status: updated.status } : item)))
      toast.success(nextStatus === 'COMPLETED' ? '마감 처리되었습니다.' : '예정으로 변경되었습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '상태 변경에 실패했습니다.')
    } finally {
      setUpdatingKey(null)
    }
  }

  return (
    <section className="space-y-4 p-4 md:p-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">세무 일정</h2>
          <div className="text-sm text-zinc-500">
            업체 <span className="font-semibold text-zinc-900">{groupedRows.length}</span>곳
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className={inputClass}
            placeholder="회사명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm text-zinc-700 transition hover:bg-zinc-50"
            onClick={() => {
              setQuery('')
            }}
          >
            필터 초기화
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-left">회사명</th>
              <th className="px-3 py-3 text-center">부가세</th>
              <th className="px-3 py-3 text-center">원천세</th>
              <th className="px-3 py-3 text-center">사업소득</th>
              <th className="px-3 py-3 text-left">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-rose-600">
                  {error}
                </td>
              </tr>
            ) : groupedRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                  조회 결과가 없습니다.
                </td>
              </tr>
            ) : (
              groupedRows.map((row) => (
                <tr key={row.company_name} className="hover:bg-zinc-50">
                  <td className="px-3 py-3 text-zinc-900">{row.company_name}</td>
                  {(['VAT', 'WITHHOLDING', 'INCOME_TAX'] as TaxColumnKey[]).map((key) => {
                    const cell = row.taxes[key]
                    if (!cell) {
                      return (
                        <td key={`${row.company_name}-${key}`} className="px-3 py-3 text-center text-zinc-400">
                          -
                        </td>
                      )
                    }
                    const label = toCellStatus(cell.status)
                    const isUpdating = updatingKey === `${row.company_name}-${key}`
                    return (
                      <td key={`${row.company_name}-${key}`} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(cell, `${row.company_name}-${key}`)}
                            disabled={isUpdating}
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80 disabled:opacity-60 ${statusBadgeClass(
                              label
                            )}`}
                          >
                            {isUpdating ? '변경 중...' : label}
                          </button>
                          <span className="text-[11px] text-zinc-500">{toDate(cell.due_date)}</span>
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 text-zinc-600">{row.memo || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
