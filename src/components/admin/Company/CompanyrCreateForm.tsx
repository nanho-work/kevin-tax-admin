'use client'

import { useState } from 'react'
import type React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { createCompany } from '@/services/admin/company'
import KakaoAddressSearchModal from '@/components/common/KakaoAddressSearchModal'
import type { CompanyCreateRequest } from '@/types/admin_campany'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`.trim()}>
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const textareaClass =
  'w-full min-h-[96px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const selectClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatBusinessRegistrationNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 5)
  const p3 = digits.slice(5, 10)
  if (digits.length <= 3) return p1
  if (digits.length <= 5) return `${p1}-${p2}`
  return `${p1}-${p2}-${p3}`
}

export default function CompanyCreateForm() {
  const router = useRouter()
  const [form, setForm] = useState<CompanyCreateRequest>({
    category: '',
    company_name: '',
    owner_name: '',
    registration_number: '',
    industry_type: '',
    business_type: '',
    postal_code: '',
    address1: '',
    address2: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const target = e.target as HTMLInputElement
    setForm((prev) => ({
      ...prev,
      [name]:
        target.type === 'checkbox'
          ? target.checked
          : name === 'is_active'
            ? value === 'true'
            : name === 'registration_number'
              ? formatBusinessRegistrationNumber(value)
            : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createCompany(form)
      setSuccess('등록 완료되었습니다.')
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/admin/companies')
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || '등록 실패')
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">고객사 등록</h2>
              <p className="mt-1 text-sm text-zinc-500">필수 항목을 입력하고 저장하면 고객사 정보가 생성됩니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                등록하기
              </button>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div
            className={
              success
                ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'
                : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
            }
          >
            {success || error}
          </div>
        )}

        <Section title="기본 정보" description="회사 기본 식별 정보를 입력합니다.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="회사명" required>
              <input name="company_name" value={form.company_name} onChange={handleChange} className={inputClass} required />
            </Field>
            <Field label="대표자명" required>
              <input name="owner_name" value={form.owner_name} onChange={handleChange} className={inputClass} required />
            </Field>
            <Field label="사업자등록번호" required>
              <input
                name="registration_number"
                value={form.registration_number}
                onChange={handleChange}
                className={inputClass}
                required
                inputMode="numeric"
                maxLength={12}
                placeholder="000-00-00000"
              />
            </Field>
            <Field label="구분">
              <select name="category" value={form.category} onChange={handleChange} className={selectClass}>
                <option value="" disabled>
                  선택해주세요
                </option>
                <option value="법인">법인</option>
                <option value="개인">개인</option>
              </select>
            </Field>
            <Field label="업태">
              <input name="industry_type" value={form.industry_type} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="종목">
              <input name="business_type" value={form.business_type} onChange={handleChange} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="주소 정보">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_auto_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="우편번호">
              <input name="postal_code" value={form.postal_code} onChange={handleChange} className={inputClass} />
            </Field>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-700">우편번호검색</label>
              <button
                type="button"
                onClick={() => setAddressSearchOpen(true)}
                className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <Search size={14} />
                검색
              </button>
            </div>
            <Field label="주소1">
              <input name="address1" value={form.address1} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="주소2">
              <input name="address2" value={form.address2} onChange={handleChange} className={inputClass} />
            </Field>
          </div>
        </Section>
        <KakaoAddressSearchModal
          open={addressSearchOpen}
          onClose={() => setAddressSearchOpen(false)}
          onSelect={(item) =>
            setForm((prev) => ({
              ...prev,
              postal_code: item.postal_code || prev.postal_code,
              address1: item.address1 || prev.address1,
              address2: item.address2 || prev.address2,
            }))
          }
        />

      </form>
    </div>
  )
}
