'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createStaffSignupRequest, getStaffSignupRequestErrorMessage } from '@/services/public/staffSignupRequestService'

type FormState = {
  client_id: string
  email: string
  password: string
  password_confirm: string
  name: string
  phone: string
  birth_date: string
  hired_at: string
  initial_remaining_days: string
  privacy_agreed: boolean
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formatFlexibleDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
}

function normalizeFlexibleDate(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 8) return undefined
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function createInitialForm(): FormState {
  return {
    client_id: '',
    email: '',
    password: '',
    password_confirm: '',
    name: '',
    phone: '',
    birth_date: '',
    hired_at: '',
    initial_remaining_days: '',
    privacy_agreed: false,
  }
}

export default function StaffSignupRequestForm() {
  const [form, setForm] = useState<FormState>(createInitialForm())
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const inputClass =
    'w-full rounded-md border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-100'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const clientId = Number(form.client_id)
    if (!Number.isInteger(clientId) || clientId <= 0) {
      setMessage({ type: 'error', text: '회사 코드를 확인해 주세요.' })
      return
    }
    if (form.password.length < 8) {
      setMessage({ type: 'error', text: '비밀번호는 8자 이상 입력해 주세요.' })
      return
    }
    if (form.password !== form.password_confirm) {
      setMessage({ type: 'error', text: '비밀번호 확인이 일치하지 않습니다.' })
      return
    }
    if (!form.privacy_agreed) {
      setMessage({ type: 'error', text: '개인정보 수집 동의가 필요합니다.' })
      return
    }

    const initialRemainingDays =
      form.initial_remaining_days.trim() === '' ? undefined : Number(form.initial_remaining_days)
    if (initialRemainingDays !== undefined && (!Number.isFinite(initialRemainingDays) || initialRemainingDays < 0)) {
      setMessage({ type: 'error', text: '초기 잔여 연차는 0 이상으로 입력해 주세요.' })
      return
    }

    try {
      setSubmitting(true)
      await createStaffSignupRequest({
        client_id: clientId,
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        birth_date: normalizeFlexibleDate(form.birth_date),
        hired_at: normalizeFlexibleDate(form.hired_at),
        initial_remaining_days: initialRemainingDays,
        privacy_agreed: form.privacy_agreed,
      })
      setMessage({ type: 'success', text: '가입 신청이 접수되었습니다. 회사 관리자 승인 후 로그인할 수 있습니다.' })
      setForm((prev) => ({
        ...createInitialForm(),
        client_id: prev.client_id,
      }))
    } catch (error) {
      setMessage({ type: 'error', text: getStaffSignupRequestErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-blue-900">직원 회원가입 신청</h1>
        <p className="mt-2 text-center text-sm text-gray-500">신청 후 회사 관리자 승인 시점에 계정이 생성됩니다.</p>

        {message ? (
          <div
            className={`mt-4 rounded-md px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-700">회사 코드(client_id)</label>
            <input
              type="number"
              min={1}
              value={form.client_id}
              onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">비밀번호</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">비밀번호 확인</label>
            <input
              type="password"
              value={form.password_confirm}
              onChange={(e) => setForm((prev) => ({ ...prev, password_confirm: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-700">전화번호</label>
            <input
              type="text"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-700">생년월일</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY.MM.DD"
                value={form.birth_date}
                onChange={(e) => setForm((prev) => ({ ...prev, birth_date: formatFlexibleDateInput(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">입사일</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY.MM.DD"
                value={form.hired_at}
                onChange={(e) => setForm((prev) => ({ ...prev, hired_at: formatFlexibleDateInput(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">초기 잔여 연차(선택)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="예: 11.5"
                value={form.initial_remaining_days}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, initial_remaining_days: e.target.value.replace(/[^0-9.]/g, '') }))
                }
                className={inputClass}
              />
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.privacy_agreed}
              onChange={(e) => setForm((prev) => ({ ...prev, privacy_agreed: e.target.checked }))}
              className="mt-0.5"
            />
            <span>개인정보 수집 및 이용에 동의합니다.</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-900 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {submitting ? '신청 중...' : '가입 신청'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login/staff" className="text-blue-700 hover:underline">
            직원 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </section>
  )
}
