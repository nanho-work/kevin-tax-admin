'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { toast } from 'react-hot-toast'
import { fetchCompanyTaxList } from '@/services/admin/company'
import { createCompanyAccount } from '@/services/admin/companyAccountService'
import type { CompanyTaxDetail } from '@/types/admin_campany'

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  )
}

export default function CompanyAccountCreateForm() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_id: '',
    company_name: '',
    login_id: '',
    password: '',
  })

  const filteredCompanies = useMemo(() => {
    if (!form.company_name.trim()) return companies
    const keyword = form.company_name.trim().toLowerCase()
    return companies.filter((row) => row.company_name.toLowerCase().includes(keyword))
  }, [companies, form.company_name])

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true)
        const data = await fetchCompanyTaxList({ page: 1, limit: 100 })
        const sorted = [...data.items].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko'))
        setCompanies(sorted)
      } catch (err) {
        console.error('회사 목록 조회 실패:', err)
      } finally {
        setLoadingCompanies(false)
      }
    }
    loadCompanies()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCompanyNameChange = (value: string) => {
    const matched = companies.find((company) => company.company_name === value)
    setForm((prev) => ({
      ...prev,
      company_name: value,
      company_id: matched ? String(matched.id) : '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = Number(form.company_id)
    if (!companyId) {
      toast.error('회사를 선택해 주세요.')
      return
    }

    try {
      setSaving(true)
      await createCompanyAccount({
        company_id: companyId,
        login_id: form.login_id.trim(),
        password: form.password,
      })
      toast.success('고객사 계정이 등록되었습니다.')
      router.push('/admin/companies/account')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">고객사(계정) 등록</h2>
              <p className="mt-1 text-sm text-zinc-500">
                직원 포털에서 고객사 로그인 계정을 생성하기 위한 입력 화면입니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                disabled={saving}
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h3 className="text-base font-semibold text-zinc-900">계정 기본 정보</h3>
            <p className="mt-1 text-sm text-zinc-500">회사 선택 후 로그인 아이디/비밀번호를 입력하세요.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-3">
            <Field label="고객사명" required>
              <>
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  className={inputClass}
                  placeholder={loadingCompanies ? '회사 목록 로딩 중...' : '고객사명 입력 또는 선택'}
                  list="company-options"
                  autoComplete="off"
                  required
                />
                <datalist id="company-options">
                  {filteredCompanies.map((company) => (
                    <option key={company.id} value={company.company_name}>
                      {company.registration_number}
                    </option>
                  ))}
                </datalist>
                <input type="hidden" name="company_id" value={form.company_id} />
              </>
            </Field>
            <Field label="로그인 아이디" required>
              <input
                name="login_id"
                value={form.login_id}
                onChange={handleChange}
                className={inputClass}
                placeholder="아이디 입력"
                required
              />
            </Field>
            <Field label="비밀번호" required>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className={inputClass}
                placeholder="비밀번호 입력"
                required
              />
            </Field>
          </div>
        </section>
      </form>
    </div>
  )
}
