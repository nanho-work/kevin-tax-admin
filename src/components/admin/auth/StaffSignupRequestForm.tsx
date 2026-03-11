'use client'

import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createStaffSignupRequest,
  getCompanyByBusinessNumber,
  getStaffSignupConsentTerm,
  getStaffSignupRequestErrorMessage,
} from '@/services/public/staffSignupRequestService'
import type { StaffSignupCompanyLookup, StaffSignupConsentTerm } from '@/types/staffSignupRequest'

type FormState = {
  business_number: string
  company_verified: boolean
  name: string
  login_id: string
  email: string
  password: string
  password_confirm: string
  phone: string
  birth_date: string
  hired_at: string
  initial_remaining_days: string
  privacy_agreed: boolean
}

type RequiredField =
  | 'business_number'
  | 'company_verified'
  | 'name'
  | 'login_id'
  | 'email'
  | 'password'
  | 'password_confirm'
  | 'privacy_agreed'

type ErrorField = RequiredField | 'initial_remaining_days'

const REQUIRED_FIELD_ORDER: RequiredField[] = [
  'business_number',
  'company_verified',
  'name',
  'login_id',
  'email',
  'password',
  'password_confirm',
  'privacy_agreed',
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    business_number: '',
    company_verified: false,
    name: '',
    login_id: '',
    email: '',
    password: '',
    password_confirm: '',
    phone: '',
    birth_date: '',
    hired_at: '',
    initial_remaining_days: '',
    privacy_agreed: false,
  }
}

function formatBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

function validateInitialRemainingDays(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return '초기 잔여 연차는 0 이상 숫자로 입력해 주세요.'
  return null
}

function FieldLabel({
  label,
  required = false,
  tooltip,
}: {
  label: string
  required?: boolean
  tooltip?: string
}) {
  return (
    <label className="mb-1 flex items-center gap-1 text-sm text-gray-700">
      <span>{label}</span>
      {required ? <span className="text-xs font-semibold text-rose-600">*(필수)</span> : null}
      {tooltip ? (
        <span className="group relative inline-flex items-center">
          <CircleHelp size={14} className="text-zinc-400" />
          <span className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-64 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] leading-4 text-zinc-600 shadow-sm group-hover:block">
            {tooltip}
          </span>
        </span>
      ) : null}
    </label>
  )
}

export default function StaffSignupRequestForm() {
  const [form, setForm] = useState<FormState>(createInitialForm())
  const [companyLookup, setCompanyLookup] = useState<StaffSignupCompanyLookup | null>(null)
  const [companyLookupLoading, setCompanyLookupLoading] = useState(false)
  const [companyLookupMessage, setCompanyLookupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [consentTerm, setConsentTerm] = useState<StaffSignupConsentTerm | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [touched, setTouched] = useState<Partial<Record<ErrorField, boolean>>>({})
  const [triedSubmit, setTriedSubmit] = useState(false)
  const fieldRefs = useRef<Partial<Record<ErrorField, HTMLInputElement | null>>>({})

  const inputClass =
    'w-full rounded-md border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-100'

  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password])
  const hasConfirmInput = form.password_confirm.length > 0
  const isPasswordMatch = form.password === form.password_confirm

  const requiredErrors = useMemo(() => {
    const errors: Record<RequiredField, string | null> = {
      business_number: null,
      company_verified: null,
      name: null,
      login_id: null,
      email: null,
      password: null,
      password_confirm: null,
      privacy_agreed: null,
    }

    const businessDigits = form.business_number.replace(/\D/g, '')
    if (businessDigits.length !== 10) {
      errors.business_number = '사업자등록번호 10자리를 입력해 주세요.'
    } else if (!companyLookup) {
      errors.business_number = '회사 확인 버튼을 눌러 확인해 주세요.'
    }

    if (!form.name.trim()) errors.name = '이름을 입력해 주세요.'
    if (!form.login_id.trim()) errors.login_id = '로그인 아이디를 입력해 주세요.'

    if (!form.email.trim()) {
      errors.email = '이메일을 입력해 주세요.'
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errors.email = '유효한 이메일 형식으로 입력해 주세요.'
    }

    if (!form.password) {
      errors.password = '비밀번호를 입력해 주세요.'
    } else if (!passwordChecks.minLength || !passwordChecks.hasLetter || !passwordChecks.hasNumber) {
      errors.password = '비밀번호 규칙(8자 이상, 영문/숫자 포함)을 충족해 주세요.'
    }

    if (!form.password_confirm) {
      errors.password_confirm = '비밀번호 확인을 입력해 주세요.'
    } else if (!isPasswordMatch) {
      errors.password_confirm = '비밀번호 확인이 일치하지 않습니다.'
    }

    if (!form.company_verified) errors.company_verified = '위 회사로 가입 신청 체크가 필요합니다.'
    if (!form.privacy_agreed) errors.privacy_agreed = '개인정보 수집 및 이용 동의가 필요합니다.'

    return errors
  }, [companyLookup, form, isPasswordMatch, passwordChecks.hasLetter, passwordChecks.hasNumber, passwordChecks.minLength])

  const initialRemainingError = useMemo(
    () => validateInitialRemainingDays(form.initial_remaining_days),
    [form.initial_remaining_days]
  )
  const resolvedConsentContent = useMemo(() => {
    if (!consentTerm?.content) return ''
    const companyName = companyLookup?.company_name?.trim() || '해당 회사'
    return consentTerm.content
      .replaceAll('${company_name}', companyName)
      .replaceAll('{{company_name}}', companyName)
  }, [companyLookup?.company_name, consentTerm?.content])

  const hasRequiredErrors = REQUIRED_FIELD_ORDER.some((field) => Boolean(requiredErrors[field]))
  const canSubmit =
    !submitting &&
    !companyLookupLoading &&
    !hasRequiredErrors &&
    !initialRemainingError &&
    Boolean(consentTerm)

  const showError = (field: ErrorField) => {
    if (!(triedSubmit || touched[field])) return false
    if (field === 'initial_remaining_days') return Boolean(initialRemainingError)
    return Boolean(requiredErrors[field])
  }

  const errorText = (field: ErrorField) => {
    if (field === 'initial_remaining_days') return initialRemainingError
    return requiredErrors[field]
  }

  const markTouched = (field: ErrorField) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const focusField = (field: ErrorField) => {
    const target = fieldRefs.current[field]
    if (!target) return
    target.focus()
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const focusFirstInvalidField = () => {
    for (const field of REQUIRED_FIELD_ORDER) {
      if (requiredErrors[field]) {
        focusField(field)
        return
      }
    }
    if (initialRemainingError) focusField('initial_remaining_days')
  }

  const handleLookupCompany = async () => {
    setCompanyLookupMessage(null)
    setMessage(null)
    markTouched('business_number')

    const businessDigits = form.business_number.replace(/\D/g, '')
    if (businessDigits.length !== 10) {
      setCompanyLookup(null)
      setForm((prev) => ({ ...prev, company_verified: false }))
      setCompanyLookupMessage({ type: 'error', text: '사업자등록번호 10자리를 입력해 주세요.' })
      focusField('business_number')
      return
    }

    try {
      setCompanyLookupLoading(true)
      const businessNumber = formatBusinessNumber(form.business_number)
      const found = await getCompanyByBusinessNumber(businessNumber)
      setCompanyLookup(found)
      setForm((prev) => ({
        ...prev,
        business_number: found.business_number || businessNumber,
        company_verified: false,
      }))
      setCompanyLookupMessage({ type: 'success', text: `회사 확인 완료: ${found.company_name}` })
      focusField('company_verified')
    } catch (error) {
      setCompanyLookup(null)
      setForm((prev) => ({ ...prev, company_verified: false }))
      setCompanyLookupMessage({ type: 'error', text: getStaffSignupRequestErrorMessage(error) })
    } finally {
      setCompanyLookupLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const term = await getStaffSignupConsentTerm()
        if (!mounted) return
        setConsentTerm(term)
      } catch {
        if (!mounted) return
        setConsentTerm(null)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTriedSubmit(true)
    setMessage(null)

    if (!consentTerm) {
      setMessage({ type: 'error', text: '동의 약관을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
      return
    }

    if (hasRequiredErrors || initialRemainingError) {
      setMessage({ type: 'error', text: '필수 항목을 확인해 주세요.' })
      focusFirstInvalidField()
      return
    }

    const initialRemainingDays =
      form.initial_remaining_days.trim() === '' ? undefined : Number(form.initial_remaining_days)

    try {
      setSubmitting(true)
      await createStaffSignupRequest({
        business_number: companyLookup?.business_number || formatBusinessNumber(form.business_number),
        input_company_name: companyLookup?.company_name,
        company_verified: form.company_verified,
        name: form.name.trim(),
        login_id: form.login_id.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        birth_date: normalizeFlexibleDate(form.birth_date),
        hired_at: normalizeFlexibleDate(form.hired_at),
        initial_remaining_days: initialRemainingDays,
        privacy_term_id: consentTerm.id,
        privacy_agreed: form.privacy_agreed,
      })
      setMessage({ type: 'success', text: '가입 신청이 접수되었습니다. 회사 관리자 승인 후 로그인할 수 있습니다.' })
      setForm(createInitialForm())
      setCompanyLookup(null)
      setCompanyLookupMessage(null)
      setTouched({})
      setTriedSubmit(false)
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
            <FieldLabel label="사업자등록번호" required />
            <div className="flex gap-2">
              <input
                ref={(el) => {
                  fieldRefs.current.business_number = el
                }}
                type="text"
                inputMode="numeric"
                placeholder="123-45-67890"
                value={form.business_number}
                onBlur={() => markTouched('business_number')}
                onChange={(e) => {
                  const nextValue = formatBusinessNumber(e.target.value)
                  setForm((prev) => ({ ...prev, business_number: nextValue, company_verified: false }))
                  setCompanyLookup(null)
                  setCompanyLookupMessage(null)
                  setMessage(null)
                }}
                className={`${inputClass} w-full sm:w-56`}
                required
              />
              <button
                type="button"
                onClick={handleLookupCompany}
                disabled={companyLookupLoading}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {companyLookupLoading ? '확인 중...' : '회사 확인'}
              </button>
            </div>
            {showError('business_number') ? <p className="mt-1 text-xs text-rose-600">{errorText('business_number')}</p> : null}
            {companyLookupMessage ? (
              <p className={`mt-1 text-xs ${companyLookupMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                {companyLookupMessage.text}
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <input
              ref={(el) => {
                fieldRefs.current.company_verified = el
              }}
              type="checkbox"
              checked={form.company_verified}
              onBlur={() => markTouched('company_verified')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, company_verified: e.target.checked }))
                setMessage(null)
              }}
              className="mt-0.5"
              disabled={!companyLookup}
            />
            <span>
              위 회사로 가입 신청합니다. <span className="text-xs font-semibold text-rose-600">*(필수)</span>
            </span>
          </label>
          {showError('company_verified') ? <p className="-mt-2 text-xs text-rose-600">{errorText('company_verified')}</p> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="이름" required />
              <input
                ref={(el) => {
                  fieldRefs.current.name = el
                }}
                type="text"
                value={form.name}
                onBlur={() => markTouched('name')}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                  setMessage(null)
                }}
                className={inputClass}
                required
              />
              {showError('name') ? <p className="mt-1 text-xs text-rose-600">{errorText('name')}</p> : null}
            </div>
            <div>
              <FieldLabel label="생년월일" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY.MM.DD"
                value={form.birth_date}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, birth_date: formatFlexibleDateInput(e.target.value) }))
                  setMessage(null)
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <FieldLabel label="전화번호" />
            <input
              type="text"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))
                setMessage(null)
              }}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel label="로그인 아이디" required />
            <input
              ref={(el) => {
                fieldRefs.current.login_id = el
              }}
              type="text"
              value={form.login_id}
              onBlur={() => markTouched('login_id')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, login_id: e.target.value }))
                setMessage(null)
              }}
              className={inputClass}
              required
            />
            {showError('login_id') ? <p className="mt-1 text-xs text-rose-600">{errorText('login_id')}</p> : null}
          </div>

          <div>
            <FieldLabel
              label="이메일"
              required
              tooltip="가입 신청 후에도 직원 프로필에서 이메일 주소를 변경할 수 있습니다."
            />
            <input
              ref={(el) => {
                fieldRefs.current.email = el
              }}
              type="email"
              value={form.email}
              onBlur={() => markTouched('email')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }))
                setMessage(null)
              }}
              className={inputClass}
              required
            />
            {showError('email') ? <p className="mt-1 text-xs text-rose-600">{errorText('email')}</p> : null}
          </div>

          <div>
            <FieldLabel label="비밀번호" required />
            <input
              ref={(el) => {
                fieldRefs.current.password = el
              }}
              type="password"
              value={form.password}
              onBlur={() => markTouched('password')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, password: e.target.value }))
                setMessage(null)
              }}
              className={inputClass}
              required
            />
            {showError('password') ? <p className="mt-1 text-xs text-rose-600">{errorText('password')}</p> : null}
          </div>

          <div>
            <FieldLabel label="비밀번호 확인" required />
            <input
              ref={(el) => {
                fieldRefs.current.password_confirm = el
              }}
              type="password"
              value={form.password_confirm}
              onBlur={() => markTouched('password_confirm')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, password_confirm: e.target.value }))
                setMessage(null)
              }}
              className={inputClass}
              required
            />
            {showError('password_confirm') ? <p className="mt-1 text-xs text-rose-600">{errorText('password_confirm')}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <p className={passwordChecks.minLength ? 'text-emerald-600' : 'text-zinc-500'}>
              {passwordChecks.minLength ? '✓' : '•'} 8자 이상
            </p>
            <p className={passwordChecks.hasLetter ? 'text-emerald-600' : 'text-zinc-500'}>
              {passwordChecks.hasLetter ? '✓' : '•'} 영문자 포함
            </p>
            <p className={passwordChecks.hasNumber ? 'text-emerald-600' : 'text-zinc-500'}>
              {passwordChecks.hasNumber ? '✓' : '•'} 숫자 포함
            </p>
            {hasConfirmInput ? (
              <p className={isPasswordMatch ? 'text-emerald-600' : 'text-rose-600'}>
                {isPasswordMatch ? '✓ 비밀번호 확인 일치' : '• 비밀번호 확인 불일치'}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="입사일" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY.MM.DD"
                value={form.hired_at}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, hired_at: formatFlexibleDateInput(e.target.value) }))
                  setMessage(null)
                }}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel label="초기 잔여 연차(선택)" />
              <input
                ref={(el) => {
                  fieldRefs.current.initial_remaining_days = el
                }}
                type="text"
                inputMode="decimal"
                placeholder="예: 11.5"
                value={form.initial_remaining_days}
                onBlur={() => markTouched('initial_remaining_days')}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, initial_remaining_days: e.target.value.replace(/[^0-9.]/g, '') }))
                  setMessage(null)
                }}
                className={inputClass}
              />
              {showError('initial_remaining_days') ? (
                <p className="mt-1 text-xs text-rose-600">{errorText('initial_remaining_days')}</p>
              ) : null}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <input
              ref={(el) => {
                fieldRefs.current.privacy_agreed = el
              }}
              type="checkbox"
              checked={form.privacy_agreed}
              onBlur={() => markTouched('privacy_agreed')}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, privacy_agreed: e.target.checked }))
                setMessage(null)
              }}
              className="mt-0.5"
            />
            <span>
              개인정보 수집 및 이용에 동의합니다. <span className="text-xs font-semibold text-rose-600">*(필수)</span>
              {consentTerm ? (
                <span className="ml-2 text-xs text-gray-500">
                  ({consentTerm.title} v{consentTerm.version})
                </span>
              ) : (
                <span className="ml-2 text-xs text-red-600">(약관 로딩 실패)</span>
              )}
            </span>
          </label>
          {showError('privacy_agreed') ? <p className="-mt-2 text-xs text-rose-600">{errorText('privacy_agreed')}</p> : null}

          {consentTerm ? (
            <details className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-gray-700">개인정보 수집 및 이용 약관 보기</summary>
              <div className="mt-2 max-h-36 overflow-y-auto text-xs leading-5 text-gray-600 whitespace-pre-wrap">
                {resolvedConsentContent}
              </div>
            </details>
          ) : null}

          {!canSubmit ? <p className="-mt-1 text-xs text-zinc-500">필수 항목과 동의 체크 완료 후 가입 신청이 활성화됩니다.</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
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
