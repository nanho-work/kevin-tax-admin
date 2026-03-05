'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { listClients } from '@/services/client/clientService'
import { createClientAccount } from '@/services/client/clientManagementService'
import type { ClientOut } from '@/types/Client'
import type { ClientAccountCreateRequest } from '@/types/clientAccount'
import { inputClass, ROLE_CODE_OPTIONS, statusMessage } from './constants'

export default function ClientAccountCreateSection() {
  const [saving, setSaving] = useState(false)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState<ClientOut[]>([])
  const [optionLoading, setOptionLoading] = useState(false)
  const [isOptionOpen, setIsOptionOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [form, setForm] = useState<ClientAccountCreateRequest>({
    client_id: 0,
    login_id: '',
    password: '',
    role_code: 'CLIENT_ADMIN',
    name: '',
    email: '',
    phone: '',
    is_active: true,
  })

  const selectedCompanyLabel = useMemo(() => {
    if (!form.client_id) return ''
    const matched = companyOptions.find((option) => option.id === form.client_id)
    return matched ? `${matched.company_name} (${matched.id})` : `선택된 업체 ID: ${form.client_id}`
  }, [companyOptions, form.client_id])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setIsOptionOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!isOptionOpen) return

    const timer = setTimeout(async () => {
      try {
        setOptionLoading(true)
        const items = await listClients({ q: companyQuery.trim() || undefined })
        setCompanyOptions([...items].sort((a, b) => a.company_name.localeCompare(b.company_name, 'ko')))
      } catch (err: any) {
        setCompanyOptions([])
        toast.error(statusMessage(err?.response?.status, 'list'))
      } finally {
        setOptionLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [companyQuery, isOptionOpen])

  const handleSubmit = async () => {
    if (!form.client_id || !form.login_id.trim() || !form.password.trim() || !form.name.trim()) {
      toast.error('필수값(client_id, login_id, password, name)을 입력해 주세요.')
      return
    }

    try {
      setSaving(true)
      await createClientAccount({
        ...form,
        login_id: form.login_id.trim(),
        password: form.password.trim(),
        name: form.name.trim(),
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
      })
      toast.success('클라이언트 계정이 생성되었습니다.')
      setForm({
        client_id: 0,
        login_id: '',
        password: '',
        role_code: 'CLIENT_ADMIN',
        name: '',
        email: '',
        phone: '',
        is_active: true,
      })
      setCompanyQuery('')
      setCompanyOptions([])
      setIsOptionOpen(false)
    } catch (err: any) {
      toast.error(statusMessage(err?.response?.status, 'create'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">등록 정보</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2" ref={containerRef}>
            <input
              className={inputClass}
              placeholder="클라이언트 업체 선택 (필수)"
              value={companyQuery}
              onFocus={() => setIsOptionOpen(true)}
              onChange={(e) => {
                setCompanyQuery(e.target.value)
                setIsOptionOpen(true)
              }}
            />
            {isOptionOpen && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
                {optionLoading ? (
                  <div className="px-3 py-2 text-sm text-zinc-500">업체 목록 조회 중...</div>
                ) : companyOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-zinc-500">검색 결과가 없습니다.</div>
                ) : (
                  companyOptions.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, client_id: option.id }))
                        setCompanyQuery(option.company_name)
                        setIsOptionOpen(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      {option.company_name} ({option.id})
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-zinc-500">{selectedCompanyLabel || '입력창 클릭 시 가나다 순 업체 목록이 표시됩니다.'}</p>
          </div>
          <input
            className={inputClass}
            placeholder="login_id (필수)"
            value={form.login_id}
            onChange={(e) => setForm((prev) => ({ ...prev, login_id: e.target.value }))}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="password (필수)"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <select
            className={inputClass}
            value={form.role_code ?? 'CLIENT_ADMIN'}
            onChange={(e) => setForm((prev) => ({ ...prev, role_code: e.target.value }))}
          >
            {ROLE_CODE_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="name (필수)"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="email (선택)"
            value={form.email ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="phone (선택)"
            value={form.phone ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            활성 상태
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '등록 중...' : '클라이언트(관리자) 등록'}
          </button>
        </div>
      </div>
    </section>
  )
}
