'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { checkClientSession } from '@/services/client/clientAuthService'
import { listClients } from '@/services/client/clientService'
import { deactivateClientAccount, listClientAccounts } from '@/services/client/clientManagementService'
import type { ClientAccountOut } from '@/types/clientAccount'
import { inputClass, statusMessage } from './constants'

export default function ClientAccountListSection() {
  const [rows, setRows] = useState<ClientAccountOut[]>([])
  const [clientNameMap, setClientNameMap] = useState<Record<number, string>>({})
  const [myAccountId, setMyAccountId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [workingId, setWorkingId] = useState<number | null>(null)

  const [clientIdFilter, setClientIdFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | ''>('true')
  const [q, setQ] = useState('')

  const loadList = async () => {
    try {
      setLoading(true)
      const filters: { client_id?: number; is_active?: boolean; q?: string } = {}
      if (clientIdFilter.trim()) filters.client_id = Number(clientIdFilter)
      if (activeFilter !== '') filters.is_active = activeFilter === 'true'
      if (q.trim()) filters.q = q.trim()

      const data = await listClientAccounts(filters)
      setRows(typeof myAccountId === 'number' ? data.filter((row) => row.id !== myAccountId) : data)
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status, 'list'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (id: number) => {
    if (!confirm('해당 계정을 비활성화하시겠습니까? (실제 삭제되지 않음)')) return

    try {
      setWorkingId(id)
      await deactivateClientAccount(id)
      toast.success('계정이 비활성화되었습니다.')
      await loadList()
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status, 'delete'))
    } finally {
      setWorkingId(null)
    }
  }

  useEffect(() => {
    checkClientSession()
      .then((session) => setMyAccountId(session.account_id))
      .catch(() => setMyAccountId(null))

    listClients()
      .then((clients) => {
        const map = clients.reduce<Record<number, string>>((acc, client) => {
          acc[client.id] = client.company_name
          return acc
        }, {})
        setClientNameMap(map)
      })
      .catch(() => setClientNameMap({}))
  }, [])

  useEffect(() => {
    loadList()
  }, [myAccountId])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">검색</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            type="number"
            placeholder="client_id"
            value={clientIdFilter}
            onChange={(e) => setClientIdFilter(e.target.value)}
          />
          <select className={inputClass} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as 'true' | 'false' | '')}>
            <option value="true">활성만</option>
            <option value="false">비활성만</option>
            <option value="">전체</option>
          </select>
          <input className={inputClass} placeholder="검색(q)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50" onClick={loadList}>
            조회
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-left">업체명</th>
              <th className="px-3 py-3 text-left">login_id</th>
              <th className="px-3 py-3 text-left">name</th>
              <th className="px-3 py-3 text-left">role_code</th>
              <th className="px-3 py-3 text-right">role_level</th>
              <th className="px-3 py-3 text-center">활성</th>
              <th className="px-3 py-3 text-center">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  조회 결과가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-left">{clientNameMap[row.client_id] ?? `업체#${row.client_id}`}</td>
                  <td className="px-3 py-3 text-left">{row.login_id}</td>
                  <td className="px-3 py-3 text-left">{row.name}</td>
                  <td className="px-3 py-3 text-left">{row.role_code}</td>
                  <td className="px-3 py-3 text-right">{row.role_level ?? '-'}</td>
                  <td className="px-3 py-3 text-center">{row.is_active ? '활성' : '비활성'}</td>
                  <td className="px-3 py-3 text-center">
                    {row.is_active ? (
                      <button
                        type="button"
                        disabled={workingId === row.id}
                        onClick={() => handleDeactivate(row.id)}
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {workingId === row.id ? '처리 중...' : '비활성화'}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">완료</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
