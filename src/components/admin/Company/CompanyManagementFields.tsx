'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { adminHttp, clientHttp } from '@/services/http'
import type { CompanyDetailResponse } from '@/types/admin_campany'

type Management = Pick<CompanyDetailResponse, 'engagement_type' | 'assigned_admin_id' | 'assigned_admin_name' | 'assigned_admin_phone'>
type Staff = { id: number; name: string; phone: string | null }
export const engagementLabel = (value?: string | null) => value === 'bookkeeping' ? '기장' : value === 'one_off' ? '단발 신고' : '미지정'
export function staffPhone(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) {
    const prefix = digits.startsWith('02') ? 2 : 3
    return `${digits.slice(0, prefix)}-${digits.slice(prefix, -4)}-${digits.slice(-4)}`
  }
  return value || '연락처 미등록'
}

export default function CompanyManagementFields({ value, editable, onChange }: {
  value: Management; editable: boolean; onChange: (next: Management) => void
}) {
  const pathname = usePathname()
  const client = pathname.startsWith('/client')
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!editable) return
    let active = true
    setLoading(true)
    setError(false)
    const http = client ? clientHttp : adminHttp
    http.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/${client ? 'client' : 'admin'}/companies/staff-options`)
      .then(({ data }) => { if (active) setStaff(data) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client, editable, retry])
  const inputClass = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm disabled:bg-zinc-50'
  return <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="space-y-1.5">
      <label htmlFor="company-engagement" className="block text-xs font-semibold text-zinc-700">계약 구분</label>
      {editable ? <select id="company-engagement" className={inputClass} value={value.engagement_type || ''}
        onChange={(e) => onChange({ engagement_type: (e.target.value || null) as Management['engagement_type'] })}>
        <option value="">미지정</option><option value="bookkeeping">기장</option><option value="one_off">단발 신고</option>
      </select> : <p className="text-sm text-zinc-900">{engagementLabel(value.engagement_type)}</p>}
    </div>
    <div className="space-y-1.5">
      <label htmlFor="company-assigned-staff" className="block text-xs font-semibold text-zinc-700">사무소 담당 직원</label>
      {editable ? <select id="company-assigned-staff" className={inputClass} value={value.assigned_admin_id ?? ''} disabled={loading || error}
        onChange={(e) => {
          const selected = staff.find((item) => item.id === Number(e.target.value))
          onChange({ assigned_admin_id: selected?.id ?? null, assigned_admin_name: selected?.name ?? null, assigned_admin_phone: selected?.phone ?? null })
        }}>
        <option value="">{loading ? '직원 조회 중…' : '미지정'}</option>
        {value.assigned_admin_id && !staff.some((item) => item.id === value.assigned_admin_id) ? <option value={value.assigned_admin_id}>{value.assigned_admin_name || '기존 담당 직원'}</option> : null}
        {staff.map((item) => <option key={item.id} value={item.id}>{item.name} · {staffPhone(item.phone)}</option>)}
      </select> : <p className="text-sm text-zinc-900">{value.assigned_admin_name || '미지정'}</p>}
      {value.assigned_admin_id ? <p className="text-xs text-zinc-500">{staffPhone(value.assigned_admin_phone)}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-600">직원 목록을 불러오지 못했습니다. <button type="button" className="underline" onClick={() => setRetry((n) => n + 1)}>다시 시도</button></p> : null}
    </div>
  </div>
}
