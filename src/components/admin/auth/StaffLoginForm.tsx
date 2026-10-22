'use client'

import LoginLayout from '@/components/auth/LoginLayout'
import LoginFields from '@/components/auth/LoginFields'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '@/services/admin/adminService'
import type { LoginRequest } from '@/types/admin'
import { setAdminAccessToken } from '@/services/http'
import { toLoginErrorMessage } from '@/utils/loginError'

const STAFF_LOGIN_REMEMBER_KEY = 'staff_login_remember_id'

export default function LoginForm() {
  const router = useRouter()
  const [form, setForm] = useState<LoginRequest>({ login_id: '', password: '' })
  const [rememberLoginId, setRememberLoginId] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const rememberedLoginId = window.localStorage.getItem(STAFF_LOGIN_REMEMBER_KEY)
    if (!rememberedLoginId) return
    setForm((prev) => ({ ...prev, login_id: rememberedLoginId }))
    setRememberLoginId(true)
  }, [])

  // ✅ 입력값 변경 핸들러: 폼 상태 업데이트 및 에러 초기화
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrorMessage(null)
  }

  // ✅ 로그인 요청 핸들러: 로그인 시도 및 리디렉션 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const loginResponse = await adminLogin(form)
      setAdminAccessToken(loginResponse.access_token)
      if (typeof window !== 'undefined') {
        if (rememberLoginId && form.login_id.trim()) {
          window.localStorage.setItem(STAFF_LOGIN_REMEMBER_KEY, form.login_id.trim())
        } else {
          window.localStorage.removeItem(STAFF_LOGIN_REMEMBER_KEY)
        }
      }

      router.replace('/admin/dashboard')
    } catch (err: any) {
      const message = toLoginErrorMessage(err?.response?.data?.detail) || err?.message || '로그인에 실패했습니다.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  // ✅ 로그인 폼 렌더링
  return (
    <LoginLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">사무소 로그인</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">오늘의 업무를 확인하고 이어서 진행하세요.</p>
      <LoginFields form={form} onChange={handleChange} onSubmit={handleSubmit} showPassword={showPassword} onTogglePassword={() => setShowPassword((prev) => !prev)} loading={loading} errorMessage={errorMessage}>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={rememberLoginId} onChange={(event) => setRememberLoginId(event.target.checked)} disabled={loading} className="h-4 w-4 rounded border-slate-300 accent-blue-800" />
          아이디 기억하기
        </label>
        <div className="text-right"><Link href="/login/forgot-password" className="text-sm text-slate-500 hover:underline">비밀번호 찾기</Link></div>
      </LoginFields>
      <p className="mt-6 text-center text-sm text-slate-500">아직 계정이 없으신가요? <Link href="/login/staff/signup" className="font-medium text-blue-800 hover:underline">회원가입 신청</Link></p>
    </LoginLayout>
  )
}
