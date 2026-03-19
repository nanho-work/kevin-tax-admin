'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import {
  getCompanyAccounts,
  updateCompanyAccountStatus,
} from '@/services/admin/companyAccountService'
import { uiInputClass } from '@/styles/uiClasses'
import type { CompanyAccountOut, CompanyAccountStatus } from '@/types/companyAccount'

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

function statusLabel(status: CompanyAccountStatus) {
  return status === 'active' ? '활성' : '비활성'
}

type Props = {
  refreshKey?: number
  hideTitle?: boolean
}

export default function CompanyAccountList({ refreshKey = 0, hideTitle = false }: Props) {
  const [items, setItems] = useState<CompanyAccountOut[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | CompanyAccountStatus>('')
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [total, setTotal] = useState(0)

  const load = async (nextPage = page) => {
    try {
      setLoading(true)
      const response = await getCompanyAccounts({
        page: nextPage,
        limit,
        q: q.trim() || undefined,
        status: status || undefined,
        company_id: companyId ? Number(companyId) : undefined,
      })
      setItems(response.items)
      setTotal(response.total)
      setPage(response.page)
    } catch (err: any) {
      const code = err?.response?.status
      if (code === 403) toast.error('권한이 없습니다.')
      else if (code === 401) toast.error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
      else toast.error('회사 계정 목록을 불러오지 못했습니다.')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [refreshKey])

  const handleStatusChange = async (row: CompanyAccountOut) => {
    const nextStatus: CompanyAccountStatus = row.status === 'active' ? 'inactive' : 'active'
    try {
      await updateCompanyAccountStatus(row.id, nextStatus)
      toast.success(`상태가 ${statusLabel(nextStatus)}로 변경되었습니다.`)
      await load(page)
    } catch (err: any) {
      const code = err?.response?.status
      if (code === 403) toast.error('권한이 없습니다.')
      else if (code === 404) toast.error('대상 계정을 찾을 수 없습니다.')
      else toast.error('상태 변경에 실패했습니다.')
    }
  }

  return (
    <section className="space-y-4">
      {hideTitle ? null : (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
          <h2 className="text-xl font-semibold text-zinc-900">고객사(계정) 목록</h2>
          <p className="mt-1 text-sm text-zinc-500">회사 로그인 계정을 조회하고 활성 상태를 변경할 수 있습니다.</p>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <UiSearchInput
            wrapperClassName={uiInputClass}
            placeholder="login_id 또는 회사명 검색"
            value={q}
            onChange={setQ}
            onSubmit={() => load(1)}
          />
          <select
            className={uiInputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | CompanyAccountStatus)}
          >
            <option value="">전체 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          <input
            className={uiInputClass}
            placeholder="회사 ID (선택)"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value.replace(/[^\d]/g, ''))}
          />
          <UiButton
            type="button"
            onClick={() => load(1)}
            variant="secondary"
            size="lg"
          >
            조회
          </UiButton>
          <div className="flex items-center justify-end text-sm text-zinc-500">총 {total}개</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-3 text-center">번호</th>
              <th className="px-3 py-3 text-center">회사명</th>
              <th className="px-3 py-3 text-center">로그인 ID</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">마지막 로그인</th>
              <th className="px-3 py-3 text-center">등록일</th>
              <th className="px-3 py-3 text-center">수정일</th>
              <th className="px-3 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-zinc-500">
                  조회된 회사 계정이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row, index) => (
                <tr key={row.id} className="even:bg-zinc-50">
                  <td className="px-3 py-3 text-center">{(page - 1) * limit + index + 1}</td>
                  <td className="px-3 py-3 text-center">{row.company_name ?? '-'}</td>
                  <td className="px-3 py-3 text-center">{row.login_id}</td>
                  <td className="px-3 py-3 text-center">{statusLabel(row.status)}</td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.last_login_at)}</td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.created_at)}</td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.updated_at)}</td>
                  <td className="px-3 py-3 text-center">
                    <UiButton
                      type="button"
                      onClick={() => handleStatusChange(row)}
                      variant="secondary"
                      size="sm"
                    >
                      {row.status === 'active' ? '비활성화' : '활성화'}
                    </UiButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={limit} onPageChange={(nextPage) => load(nextPage)} />
    </section>
  )
}
