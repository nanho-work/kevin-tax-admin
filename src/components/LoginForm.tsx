'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminLogin } from '@/services/adminService'
import { checkInAdmin } from '@/services/attendanceLogService'
import type { LoginRequest } from '@/types/admin'

export default function LoginForm() {
  const router = useRouter()
  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' })
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
    console.log('📤 로그인 폼 데이터:', form)
    setLoading(true)
    setErrorMessage(null)

    try {
      console.log('📤 로그인 요청 시작:', form);
      const loginResponse = await adminLogin(form)
      console.log('🔐 서버 응답 데이터:', loginResponse)
      console.log('✅ 로그인 성공')
      localStorage.setItem("admin_access_token", loginResponse.access_token)

      try {
        await checkInAdmin()
      } catch (checkInError: any) {
        console.warn("⚠️ 출근 실패:", checkInError?.response?.data?.detail || checkInError.message)
      }

      router.push('/dashboard')
    } catch (err: any) {
      console.error('❌ 로그인 실패:', err?.response?.data?.detail || err.message)
      console.log('❌ 로그인 실패 응답 전체:', err?.response);
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
          {/* ✅ 이메일 입력 필드 */}
          <div>
            <label htmlFor="email" className="block text-sm text-gray-700 mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="이메일을 입력하세요"
              value={form.email}
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
            <input
              id="password"
              type="password"
              name="password"
              placeholder="비밀번호를 입력하세요"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className="w-full border px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
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