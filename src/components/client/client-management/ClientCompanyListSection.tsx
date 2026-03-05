'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { listClients } from '@/services/client/clientService'
import type { ClientOut, ClientStatus } from '@/types/Client'
import { inputClass, statusMessage } from './constants'

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR')
}

function formatBusinessType(value: 'individual' | 'corporate') {
  return value === 'corporate' ? '법인' : '개인'
}

function formatStatus(value: 'active' | 'inactive') {
  return value === 'active' ? '활성' : '비활성'
}

export default function ClientCompanyListSection() {
  const [rows, setRows] = useState<ClientOut[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ClientStatus | ''>('')

  const loadList = async () => {
    try {
      setLoading(true)
      const data = await listClients({
        q: q.trim() || undefined,
        status: status || undefined,
      })
      setRows(data)
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status, 'list'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">검색</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            placeholder="업체명/사업자번호 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                loadList()
              }
            }}
          />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ClientStatus | '')}>
            <option value="">전체 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          <button
            type="button"
            onClick={loadList}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
          >
            조회
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-right">ID</th>
              <th className="px-3 py-3 text-left">구분</th>
              <th className="px-3 py-3 text-left">업체명</th>
              <th className="px-3 py-3 text-left">사업자번호</th>
              <th className="px-3 py-3 text-left">관리자 이메일</th>
              <th className="px-3 py-3 text-left">관리자 연락처</th>
              <th className="px-3 py-3 text-left">우편번호</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-left">등록일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  등록된 업체가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-right">{row.id}</td>
                  <td className="px-3 py-3 text-left">{formatBusinessType(row.business_type)}</td>
                  <td className="px-3 py-3 text-left">{row.company_name}</td>
                  <td className="px-3 py-3 text-left">{row.business_number}</td>
                  <td className="px-3 py-3 text-left">{row.admin_email}</td>
                  <td className="px-3 py-3 text-left">{row.admin_phone}</td>
                  <td className="px-3 py-3 text-left">{row.postal_code || '-'}</td>
                  <td className="px-3 py-3 text-center">{formatStatus(row.status)}</td>
                  <td className="px-3 py-3 text-left">{formatDate(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
