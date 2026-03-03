'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { CompanyDetailResponse } from '@/types/admin_campany'
import { fetchCompanyDetail, updateCompany } from '@/services/admin/company'

interface Props {
  company: CompanyDetailResponse
}

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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`.trim()}>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const textareaClass =
  'w-full min-h-[96px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

export default function CompanyDetailForm({ company }: Props) {
  const { id } = useParams()
  const companyId = Number(id)

  const [form, setForm] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCompanyDetail(companyId)
        setForm(data)
      } catch (err) {
        console.error('상세 정보 불러오기 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    if (companyId) load()
  }, [companyId])

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        회사 정보를 불러오는 중...
      </div>
    )
  }

  if (!company || !form) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        회사 정보를 찾을 수 없습니다.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">업체 상세정보</h2>
            <p className="mt-1 text-sm text-zinc-500">기본 정보와 세무 항목을 수정할 수 있습니다.</p>
          </div>
          <button
            onClick={async () => {
              try {
                setSaving(true)
                const { id: _id, created_at, updated_at, ...payload } = form
                const res = await updateCompany(companyId, payload)
                alert(res.message)
                router.push('/admin/companies')
              } catch (err: any) {
                alert(err.response?.data?.detail || '수정 실패')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '수정완료'}
          </button>
        </div>
      </div>

      <Section title="기본 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="회사명">
            <input className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </Field>
          <Field label="대표자">
            <input className={inputClass} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          </Field>
          <Field label="사업자등록번호">
            <input className={inputClass} value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
          </Field>
          <Field label="설립일">
            <input
              className={inputClass}
              value={form.founded_date || ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                const formatted = raw.length >= 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
                setForm({ ...form, founded_date: formatted })
              }}
            />
          </Field>
          <Field label="수임일">
            <input
              className={inputClass}
              value={form.contract_date || ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                const formatted = raw.length >= 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw
                setForm({ ...form, contract_date: formatted })
              }}
            />
          </Field>
          <Field label="구분">
            <select className={inputClass} value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">선택</option>
              <option value="법인">법인</option>
              <option value="개인">개인</option>
            </select>
          </Field>
          <Field label="기장료">
            <input
              type="number"
              className={`${inputClass} text-right`}
              value={form.monthly_fee ?? ''}
              onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Section>

      <Section title="담당자 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="담당자">
            <input className={inputClass} value={form.manager_name || ''} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
          </Field>
          <Field label="담당자 연락처">
            <input className={inputClass} value={form.manager_phone || ''} onChange={(e) => setForm({ ...form, manager_phone: e.target.value })} />
          </Field>
          <Field label="이메일">
            <input className={inputClass} value={form.manager_email || ''} onChange={(e) => setForm({ ...form, manager_email: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="연락 및 주소 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="홈페이지">
            <input className={inputClass} value={form.homepage_url || ''} onChange={(e) => setForm({ ...form, homepage_url: e.target.value })} />
          </Field>
          <Field label="연락방법">
            <input className={inputClass} value={form.contact_method || ''} onChange={(e) => setForm({ ...form, contact_method: e.target.value })} />
          </Field>
          <Field label="기본 주소">
            <input className={inputClass} value={form.address1 || ''} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
          </Field>
          <Field label="상세 주소">
            <input className={inputClass} value={form.address2 || ''} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
          </Field>
          <Field label="우편번호">
            <input className={inputClass} value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </Field>
          <Field label="회사연락처">
            <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="업종 및 CMS 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="업태">
            <input className={inputClass} value={form.industry_type || ''} onChange={(e) => setForm({ ...form, industry_type: e.target.value })} />
          </Field>
          <Field label="종목">
            <input className={inputClass} value={form.business_type || ''} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
          </Field>
          <Field label="CMS 통장">
            <input className={inputClass} value={form.cms_bank_account || ''} onChange={(e) => setForm({ ...form, cms_bank_account: e.target.value })} />
          </Field>
          <Field label="CMS 계좌번호">
            <input className={inputClass} value={form.cms_account_number || ''} onChange={(e) => setForm({ ...form, cms_account_number: e.target.value })} />
          </Field>
          <Field label="CMS 이체일">
            <input className={inputClass} value={form.cms_transfer_day || ''} onChange={(e) => setForm({ ...form, cms_transfer_day: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="세금/메모 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="급여작성형태">
            <input className={inputClass} value={form.salary_type || ''} onChange={(e) => setForm({ ...form, salary_type: e.target.value })} />
          </Field>
          <Field label="급여일">
            <input className={inputClass} value={form.salary_date || ''} onChange={(e) => setForm({ ...form, salary_date: e.target.value })} />
          </Field>
          <Field label="원천세 특이사항">
            <textarea className={textareaClass} value={form.w_memo || ''} onChange={(e) => setForm({ ...form, w_memo: e.target.value })} />
          </Field>
          <Field label="메모">
            <textarea className={textareaClass} value={form.memo || ''} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </Field>
          <Field label="부가세 특이사항">
            <input className={inputClass} value={form.v_note || ''} onChange={(e) => setForm({ ...form, v_note: e.target.value })} />
          </Field>
          <Field label="부가세 비고">
            <input className={inputClass} value={form.v_remark || ''} onChange={(e) => setForm({ ...form, v_remark: e.target.value })} />
          </Field>
          <Field label="법인세 특이사항">
            <input className={inputClass} value={form.ct_note || ''} onChange={(e) => setForm({ ...form, ct_note: e.target.value })} />
          </Field>
          <Field label="법인세 비고">
            <input className={inputClass} value={form.ct_remark || ''} onChange={(e) => setForm({ ...form, ct_remark: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="옵션/시스템 정보">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[{ key: 'info_agreed', label: '정보활용동의' }, { key: 'is_half_term', label: '반기 여부' }, { key: 'is_export', label: '수출 여부' }, { key: 'is_online', label: '온라인 매출 여부' }, { key: 'has_foreign_currency', label: '외화 여부' }].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="text-sm text-zinc-700">{item.label}</span>
              <input
                type="checkbox"
                checked={Boolean((form as any)[item.key])}
                onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                className="h-4 w-4"
              />
            </label>
          ))}
          <Field label="등록일">
            <input className={`${inputClass} bg-zinc-100`} value={form.created_at ?? ''} readOnly />
          </Field>
          <Field label="수정일">
            <input className={`${inputClass} bg-zinc-100`} value={form.updated_at ?? ''} readOnly />
          </Field>
        </div>
      </Section>
    </div>
  )
}
