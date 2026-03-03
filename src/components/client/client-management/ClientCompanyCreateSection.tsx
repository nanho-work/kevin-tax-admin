'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { createClientCompany } from '@/services/client/clientManagementService'
import type { ClientCreateRequest } from '@/types/Client'
import { inputClass, statusMessage } from './constants'

function formatBusinessNumber(value: string, type: 'individual' | 'corporate'): string {
  if (type === 'corporate') {
    const digits = value.replace(/\D/g, '').slice(0, 13)
    if (digits.length <= 6) return digits
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }

  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export default function ClientCompanyCreateSection() {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ClientCreateRequest>({
    business_type: 'corporate',
    company_name: '',
    business_number: '',
    admin_email: '',
    admin_phone: '',
    postal_code: '',
    address1: '',
    address2: '',
    status: 'active',
  })

  const handleSubmit = async () => {
    const businessDigits = form.business_number.replace(/\D/g, '')
    if (!form.company_name.trim() || !businessDigits || !form.admin_email.trim() || !form.admin_phone.trim()) {
      toast.error('필수값(업체명, 사업자등록번호, 관리자 이메일, 관리자 연락처)을 입력해 주세요.')
      return
    }
    const requiredDigits = form.business_type === 'corporate' ? 13 : 10
    if (businessDigits.length !== requiredDigits) {
      toast.error(
        form.business_type === 'corporate'
          ? '법인번호는 숫자 13자리여야 합니다.'
          : '사업자등록번호는 숫자 10자리여야 합니다.'
      )
      return
    }

    try {
      setSaving(true)
      await createClientCompany({
        ...form,
        company_name: form.company_name.trim(),
        business_number: formatBusinessNumber(form.business_number, form.business_type),
        admin_email: form.admin_email.trim(),
        admin_phone: form.admin_phone.trim(),
        postal_code: form.postal_code?.trim() || undefined,
        address1: form.address1?.trim() || undefined,
        address2: form.address2?.trim() || undefined,
      })
      toast.success('업체 정보가 등록되었습니다.')
      setForm({
        business_type: 'corporate',
        company_name: '',
        business_number: '',
        admin_email: '',
        admin_phone: '',
        postal_code: '',
        address1: '',
        address2: '',
        status: 'active',
      })
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status, 'create'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">클라이언트(업체) 등록</h1>
        <p className="mt-1 text-sm text-zinc-500">클라이언트 업체 정보를 등록합니다.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">업체 기본 정보</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            className={inputClass}
            value={form.business_type}
            onChange={(e) => {
              const nextType = e.target.value as 'individual' | 'corporate'
              setForm((prev) => ({
                ...prev,
                business_type: nextType,
                business_number: formatBusinessNumber(prev.business_number, nextType),
              }))
            }}
          >
            <option value="corporate">법인(corporate)</option>
            <option value="individual">개인(individual)</option>
          </select>
          <input
            className={inputClass}
            placeholder="업체명 (필수)"
            value={form.company_name}
            onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={form.business_type === 'corporate' ? '법인번호 (필수)' : '사업자등록번호 (필수)'}
            value={form.business_number}
            inputMode="numeric"
            maxLength={form.business_type === 'corporate' ? 14 : 12}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                business_number: formatBusinessNumber(e.target.value, prev.business_type),
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="관리자 이메일 (필수)"
            value={form.admin_email}
            onChange={(e) => setForm((prev) => ({ ...prev, admin_email: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="관리자 연락처 (필수)"
            value={form.admin_phone}
            onChange={(e) => setForm((prev) => ({ ...prev, admin_phone: e.target.value }))}
          />
          <select
            className={inputClass}
            value={form.status ?? 'active'}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <input
            className={inputClass}
            placeholder="우편번호"
            value={form.postal_code ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, postal_code: e.target.value }))}
          />
          <input
            className="md:col-span-2 xl:col-span-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            placeholder="주소 1"
            value={form.address1 ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, address1: e.target.value }))}
          />
          <input
            className="md:col-span-2 xl:col-span-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            placeholder="주소 2"
            value={form.address2 ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, address2: e.target.value }))}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '등록 중...' : '클라이언트(업체) 등록'}
          </button>
        </div>
      </div>
    </section>
  )
}
