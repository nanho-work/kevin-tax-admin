'use client'

import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { changeAdminPassword } from '@/services/admin/adminService'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

export default function AdminAccountPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const passwordChecks = useMemo(
    () => ({
      minLength: newPassword.length >= 8,
      hasLetter: /[A-Za-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      differentFromCurrent: currentPassword.length > 0 && currentPassword !== newPassword,
    }),
    [currentPassword, newPassword]
  )

  const hasConfirmInput = confirmPassword.length > 0
  const isPasswordMatch = newPassword === confirmPassword
  const canSubmit =
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber &&
    passwordChecks.differentFromCurrent &&
    hasConfirmInput &&
    isPasswordMatch

  const handleSubmit = async () => {
    const current = currentPassword.trim()
    const next = newPassword.trim()
    const confirm = confirmPassword.trim()

    if (!current || !next || !confirm) {
      toast.error('현재 비밀번호, 새 비밀번호, 비밀번호 확인을 모두 입력해 주세요.')
      return
    }
    if (current === next) {
      toast.error('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return
    }
    if (next !== confirm) {
      toast.error('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (!passwordChecks.minLength || !passwordChecks.hasLetter || !passwordChecks.hasNumber) {
      toast.error('새 비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다.')
      return
    }

    try {
      setSaving(true)
      const response = await changeAdminPassword({
        current_password: current,
        new_password: next,
      })
      toast.success(response.message || '비밀번호가 변경되었습니다.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail[0]?.msg
            ? detail[0].msg
            : '비밀번호 변경에 실패했습니다.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-[520px] rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">비밀번호 변경</h2>
        <p className="mt-1 text-xs text-zinc-500">새 비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.</p>

        <div className="mt-5 space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-zinc-700">현재 비밀번호</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                className={`${inputClass} pr-16`}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {showCurrentPassword ? '숨김' : '보기'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-700">새 비밀번호</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                className={`${inputClass} pr-16`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {showNewPassword ? '숨김' : '보기'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <p className={passwordChecks.minLength ? 'text-emerald-600' : 'text-zinc-500'}>
                {passwordChecks.minLength ? '✓' : '•'} 8자 이상
              </p>
              <p className={passwordChecks.hasLetter ? 'text-emerald-600' : 'text-zinc-500'}>
                {passwordChecks.hasLetter ? '✓' : '•'} 영문자 포함
              </p>
              <p className={passwordChecks.hasNumber ? 'text-emerald-600' : 'text-zinc-500'}>
                {passwordChecks.hasNumber ? '✓' : '•'} 숫자 포함
              </p>
              <p className={passwordChecks.differentFromCurrent ? 'text-emerald-600' : 'text-zinc-500'}>
                {passwordChecks.differentFromCurrent ? '✓' : '•'} 현재 비밀번호와 다름
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-700">새 비밀번호 확인</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className={`${inputClass} pr-16`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSubmit()
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {showConfirmPassword ? '숨김' : '보기'}
              </button>
            </div>
            {hasConfirmInput ? (
              <p className={`mt-2 text-xs ${isPasswordMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isPasswordMatch ? '새 비밀번호와 일치합니다.' : '새 비밀번호와 일치하지 않습니다.'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !canSubmit}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>
    </section>
  )
}
