'use client'

import LoginLayout from '@/components/auth/LoginLayout'
import LoginFields from '@/components/auth/LoginFields'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clientLogin } from '@/services/client/clientAuthService'
import type { ClientLoginRequest } from '@/types/clientAuth'
import { toLoginErrorMessage } from '@/utils/loginError'

export default function ClientLoginForm() {
  const router = useRouter()
  const [form, setForm] = useState<ClientLoginRequest>({ login_id: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      await clientLogin(form)
      router.replace('/client/dashboard')
    } catch (err: any) {
      const message = toLoginErrorMessage(err?.response?.data?.detail) || err?.message || '로그인에 실패했습니다.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">마스터 로그인</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">플랫폼과 가입 업체를 관리하세요.</p>
      <LoginFields form={form} onChange={handleChange} onSubmit={handleSubmit} showPassword={showPassword} onTogglePassword={() => setShowPassword((prev) => !prev)} loading={loading} errorMessage={errorMessage}>
        <div className="text-right"><Link href="/login/master/forgot-password" className="text-sm text-slate-500 hover:underline">비밀번호 찾기</Link></div>
      </LoginFields>
    </LoginLayout>
  )
}
