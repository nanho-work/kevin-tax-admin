'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '@/services/adminService'
import { checkInAdmin } from '@/services/attendanceLogService'
import type { LoginRequest } from '@/types/admin'

export default function LoginForm() {
  const router = useRouter()
  const [form, setForm] = useState<LoginRequest>({ login_id: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      localStorage.setItem("admin_access_token", loginResponse.access_token)

      try {
        await checkInAdmin()
      } catch (checkInError: any) {
        // 출근 실패는 로그인 자체를 막지 않으므로 조용히 처리
      }

      router.push('/dashboard')
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // ✅ 로그인 폼 렌더링
  return (
    <section className="min-h-screen bg-gray-50 flex items-center justify-center py-20 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-bold text-blue-900 text-center mb-6">
          관리자 로그인
        </h1>

        {errorMessage && (
          <p className="mb-4 text-sm text-red-500 text-center">
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ✅ 로그인 아이디 입력 필드 */}
          <div>
            <label htmlFor="login_id" className="block text-sm text-gray-700 mb-1">
              로그인 아이디
            </label>
            <input
              id="login_id"
              type="text"
              name="login_id"
              placeholder="아이디를 입력하세요"
              value={form.login_id}
              onChange={handleChange}
              required
              autoComplete="username"
              className="w-full border px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          {/* ✅ 비밀번호 입력 필드 */}
          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-1">
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="비밀번호를 입력하세요"
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

          {/* ✅ 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded ${loading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-900 text-white hover:bg-blue-800'
              }`}
          >
            {loading ? '로딩 중...' : '로그인'}
          </button>
        </form>

        {/* ✅ 안내 문구 */}
        <p className="text-xs text-center text-gray-500 mt-4">
          관리자 전용 페이지입니다
        </p>
      </div>
    </section>
  )
}
