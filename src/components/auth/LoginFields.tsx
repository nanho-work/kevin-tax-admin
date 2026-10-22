'use client'

import PasswordInput from '@/components/common/PasswordInput'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'

type Props = {
  form: { login_id: string; password: string }
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSubmit: (event: FormEvent) => void
  showPassword: boolean
  onTogglePassword: () => void
  loading: boolean
  errorMessage: string | null
  children?: ReactNode
}

const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:opacity-60'

export default function LoginFields({ form, onChange, onSubmit, showPassword, onTogglePassword, loading, errorMessage, children }: Props) {
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" aria-busy={loading}>
      <div>
        <label htmlFor="login_id" className="mb-2 block text-sm font-medium text-slate-700">아이디</label>
        <input id="login_id" name="login_id" type="text" value={form.login_id} onChange={onChange} required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} placeholder="아이디를 입력하세요" className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">비밀번호</label>
        <div className="relative">
          <PasswordInput id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={onChange} required autoComplete="current-password" disabled={loading} placeholder="비밀번호를 입력하세요" className={`${inputClass} pr-12`} />
          <button type="button" onClick={onTogglePassword} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={showPassword} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {children}
      {errorMessage ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{errorMessage}</p> : null}
      <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#153f80] text-sm font-semibold text-white transition hover:bg-[#103366] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/25 disabled:cursor-wait disabled:opacity-60">
        {loading ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" />로그인 중...</> : <>로그인<ArrowRight size={17} aria-hidden="true" /></>}
      </button>
    </form>
  )
}
