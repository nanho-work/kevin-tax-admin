'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  createClientConsentTerm,
  getClientConsentTerm,
  getClientConsentTermErrorMessage,
  listClientConsentTerms,
  updateClientConsentTerm,
} from '@/services/client/clientConsentTermService'
import { formatKSTDateTime } from '@/utils/dateTime'
import type { ClientConsentTerm } from '@/types/clientConsentTerm'

type FilterFlag = 'all' | 'true' | 'false'

type TermFormState = {
  code: string
  version: string
  title: string
  content: string
  is_required: boolean
  is_active: boolean
  effective_from: string
}

const CONSENT_CODES = [
  'staff.signup.privacy.required',
  'staff.rrn.processing.required',
  'staff.payroll.processing.required',
]

function createInitialForm(): TermFormState {
  return {
    code: CONSENT_CODES[0],
    version: '',
    title: '',
    content: '',
    is_required: true,
    is_active: true,
    effective_from: new Date().toISOString().slice(0, 10),
  }
}

export default function ClientConsentTermsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ClientConsentTerm[]>([])
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const [form, setForm] = useState<TermFormState>(createInitialForm)
  const [filterCode, setFilterCode] = useState('')
  const [filterActive, setFilterActive] = useState<FilterFlag>('all')
  const [filterRequired, setFilterRequired] = useState<FilterFlag>('all')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isEditMode = useMemo(() => selectedTermId !== null, [selectedTermId])

  const loadTerms = async () => {
    try {
      setLoading(true)
      const response = await listClientConsentTerms({
        code: filterCode.trim() || undefined,
        is_active: filterActive === 'all' ? undefined : filterActive === 'true',
        is_required: filterRequired === 'all' ? undefined : filterRequired === 'true',
      })
      setItems(response.items || [])
      setErrorMessage(null)
    } catch (error) {
      setItems([])
      setErrorMessage(getClientConsentTermErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTerms()
  }, [])

  const resetForm = () => {
    setSelectedTermId(null)
    setForm(createInitialForm())
  }

  const handleEdit = async (termId: number) => {
    try {
      const term = await getClientConsentTerm(termId)
      setSelectedTermId(term.id)
      setForm({
        code: term.code,
        version: String(term.version),
        title: term.title,
        content: term.content,
        is_required: term.is_required,
        is_active: term.is_active,
        effective_from: term.effective_from,
      })
      setErrorMessage(null)
    } catch (error) {
      toast.error(getClientConsentTermErrorMessage(error))
    }
  }

  const handleSubmit = async () => {
    const code = form.code.trim()
    const title = form.title.trim()
    const content = form.content.trim()
    if (!code) {
      toast.error('약관 코드를 입력해 주세요.')
      return
    }
    if (!title) {
      toast.error('약관 제목을 입력해 주세요.')
      return
    }
    if (!content) {
      toast.error('약관 본문을 입력해 주세요.')
      return
    }
    if (!form.effective_from) {
      toast.error('시행일을 입력해 주세요.')
      return
    }

    try {
      setSaving(true)
      if (isEditMode && selectedTermId) {
        await updateClientConsentTerm(selectedTermId, {
          title,
          content,
          is_required: form.is_required,
          is_active: form.is_active,
          effective_from: form.effective_from,
        })
        toast.success('동의 약관을 수정했습니다.')
      } else {
        const parsedVersion = form.version.trim() ? Number(form.version) : undefined
        await createClientConsentTerm({
          code,
          version: Number.isFinite(parsedVersion) ? parsedVersion : undefined,
          title,
          content,
          is_required: form.is_required,
          is_active: form.is_active,
          effective_from: form.effective_from,
        })
        toast.success('동의 약관을 등록했습니다.')
      }
      await loadTerms()
      resetForm()
    } catch (error) {
      toast.error(getClientConsentTermErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {errorMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">{isEditMode ? '동의 약관 수정' : '동의 약관 등록'}</h2>
            {isEditMode ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                신규 등록 전환
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">코드</p>
              <select
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                disabled={isEditMode}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
              >
                {CONSENT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">버전 (빈값이면 자동 발번)</p>
              <input
                type="number"
                min={1}
                value={form.version}
                onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                disabled={isEditMode}
                placeholder="예: 3"
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">제목</p>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">본문</p>
              <textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_required: e.target.checked }))}
                />
                필수 약관
              </label>
              <label className="flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                활성 상태
              </label>
              <div>
                <p className="mb-1 text-xs font-medium text-zinc-600">시행일</p>
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, effective_from: e.target.value }))}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {saving ? '저장 중...' : isEditMode ? '수정 저장' : '약관 등록'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">동의 약관 목록</h2>
            <button
              type="button"
              onClick={() => void loadTerms()}
              disabled={loading}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {loading ? '조회 중...' : '새로고침'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
            <input
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              placeholder="code 필터"
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as FilterFlag)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              <option value="all">활성 전체</option>
              <option value="true">활성만</option>
              <option value="false">비활성만</option>
            </select>
            <select
              value={filterRequired}
              onChange={(e) => setFilterRequired(e.target.value as FilterFlag)}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              <option value="all">필수 전체</option>
              <option value="true">필수만</option>
              <option value="false">선택만</option>
            </select>
            <button
              type="button"
              onClick={() => void loadTerms()}
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              조회
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600">
                  <th className="px-2 py-2 text-left font-medium">코드</th>
                  <th className="px-2 py-2 text-center font-medium">버전</th>
                  <th className="px-2 py-2 text-left font-medium">제목</th>
                  <th className="px-2 py-2 text-center font-medium">필수</th>
                  <th className="px-2 py-2 text-center font-medium">활성</th>
                  <th className="px-2 py-2 text-center font-medium">시행일</th>
                  <th className="px-2 py-2 text-center font-medium">등록일</th>
                  <th className="px-2 py-2 text-center font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-400">
                      조회된 약관이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="px-2 py-2 text-zinc-700">{item.code}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{item.version}</td>
                      <td className="px-2 py-2 text-zinc-700">{item.title}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{item.is_required ? '필수' : '선택'}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{item.is_active ? '활성' : '비활성'}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{item.effective_from}</td>
                      <td className="px-2 py-2 text-center text-zinc-700">{formatKSTDateTime(item.created_at)}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => void handleEdit(item.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
