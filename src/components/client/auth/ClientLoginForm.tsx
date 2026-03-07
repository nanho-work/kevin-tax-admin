'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clientLogin } from '@/services/client/clientAuthService'
import type { ClientLoginRequest } from '@/types/clientAuth'

function toErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) return String((item as any).msg)
        return ''
      })
      .filter(Boolean)
    if (messages.length > 0) return messages.join(', ')
  }
  return '로그인에 실패했습니다.'
}

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
      const message = toErrorMessage(err?.response?.data?.detail) || err?.message || '로그인에 실패했습니다.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center py-20 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-bold text-blue-900 text-center mb-6">회사관리자 로그인</h1>
        {errorMessage ? <p className="mb-4 text-sm text-red-500 text-center">{errorMessage}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login_id" className="block text-sm text-gray-700 mb-1">로그인 ID</label>
            <input
              id="login_id"
              type="text"
              name="login_id"
              value={form.login_id}
              onChange={handleChange}
              required
              autoComplete="username"
              className="w-full border px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">비밀번호</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                className="w-full border px-4 py-2 pr-16 rounded focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                {showPassword ? '숨김' : '보기'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded ${loading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-900 text-white hover:bg-blue-800'}`}
          >
            {loading ? '로딩 중...' : '로그인'}
          </button>
        </form>
      </div>
    </section>
  )
}
