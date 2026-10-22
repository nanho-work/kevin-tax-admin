'use client'

import PasswordInput from '@/components/common/PasswordInput'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import LoginLayout from '@/components/auth/LoginLayout'
import { clearClientAccessToken, clearAdminAccessToken } from '@/services/http'
import { getApiErrorMessageFromDetail } from '@/utils/apiError'

const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 disabled:opacity-60'

export default function PasswordRecoveryForm({ mode, accountType = 'client' }: { mode: 'request' | 'reset'; accountType?: 'client' | 'admin' }) {
  const loginPath = accountType === 'client' ? '/login/master/login' : '/login'
  const recoveryPath = accountType === 'client' ? '/login/master/forgot-password' : '/login/forgot-password'
  const apiPath = accountType === 'client' ? '/client/auth/password-reset' : '/admin/password-reset'
  const accountLabel = accountType === 'client' ? '플랫폼 관리자' : '사무소 관리자'
  const [loginId, setLoginId] = useState('')
  const [token, setToken] = useState('')
  const [ready, setReady] = useState(mode === 'request')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (mode !== 'reset') return
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || '')
    setReady(true)
    // Keep the fragment in this tab so a refresh does not discard the recovery link.
    // Fragments are never included in HTTP requests or Referer headers.
  }, [mode])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (mode === 'reset') {
      if (password !== confirmation) { setError('비밀번호 확인이 일치하지 않습니다.'); return }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || new TextEncoder().encode(password).length > 72 || password !== password.trim()) {
        setError('8자 이상, 영문과 숫자를 포함하고 앞뒤 공백 없이 입력해 주세요. 최대 72바이트입니다.'); return
      }
    }
    setBusy(true)
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL
      const result = await axios.post<{ message: string }>(`${base}${apiPath}/${mode === 'request' ? 'request' : 'confirm'}`, mode === 'request' ? { login_id: loginId.trim() } : { token, new_password: password }, { timeout: 25000 })
      setMessage(result.data.message)
      if (mode === 'reset') {
        if (accountType === 'client') clearClientAccessToken()
        else clearAdminAccessToken()
        setPassword(''); setConfirmation(''); setToken('')
        window.history.replaceState(null, '', window.location.pathname)
      }
      setDone(true)
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined
      setError(status === 404 ? '비밀번호 복구 기능이 아직 서버에 반영되지 않았습니다. 관리자에게 문의해 주세요.' : getApiErrorMessageFromDetail(detail, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
    } finally { setBusy(false) }
  }

  return (
    <LoginLayout>
      <Link href={loginPath} className="mb-8 inline-flex text-sm text-slate-500 hover:text-blue-800">← {accountType === 'client' ? '마스터 로그인' : '사무소 로그인'}</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{mode === 'request' ? '비밀번호 찾기' : '새 비밀번호 설정'}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">{mode === 'request' ? `${accountLabel} 계정에 등록된 이메일로 재설정 링크를 보내드립니다.` : '새 비밀번호를 설정하면 기존 로그인은 종료됩니다.'}</p>
      {done ? (
        <div className="mt-8 rounded-xl border border-sky-100 bg-sky-50 p-5" role="status">
          {mode === 'request' ? <Mail className="mb-3 text-sky-700" size={24} aria-hidden="true" /> : <CheckCircle2 className="mb-3 text-sky-700" size={24} aria-hidden="true" />}
          <p className="text-sm leading-7 text-slate-700">{message}</p>
          {mode === 'request' ? <p className="mt-3 text-xs leading-6 text-slate-500">스팸함도 확인해 주세요. 이메일이 등록되지 않은 계정은 메일로 복구할 수 없습니다. 링크는 15분간 유효합니다.</p> : <Link href={loginPath} className="mt-4 inline-block text-sm font-medium text-sky-800 underline">로그인하기</Link>}
        </div>
      ) : !ready ? <p className="mt-8 text-sm text-slate-500">링크를 확인하고 있습니다.</p> : mode === 'reset' && !token ? (
        <div className="mt-8 rounded-xl bg-slate-50 p-5"><p className="text-sm text-slate-600">재설정 링크가 없습니다. 이메일의 링크로 접속하거나 다시 요청해 주세요.</p><Link href={recoveryPath} className="mt-4 inline-block text-sm text-blue-800 underline">비밀번호 찾기</Link></div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
          {mode === 'request' ? <div><label htmlFor="recovery-id" className="mb-2 block text-sm font-medium text-slate-700">아이디</label><input id="recovery-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} className={fieldClass} required maxLength={100} autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy} placeholder={`${accountLabel} 아이디`} /></div> : <>
            <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700">새 비밀번호</label><div className="relative"><PasswordInput id="new-password" type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className={`${fieldClass} pr-12`} required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy} aria-describedby="password-policy" /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-500">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="password-policy" className="mt-2 text-xs text-slate-500">8자 이상, 영문·숫자 포함, 최대 72바이트</p></div>
            <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700">새 비밀번호 확인</label><PasswordInput id="confirm-password" type={visible ? 'text' : 'password'} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={fieldClass} required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy} /></div>
          </>}
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p> : null}
          <button type="submit" disabled={busy || (mode === 'request' && !loginId.trim())} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#153f80] text-sm font-semibold text-white hover:bg-[#103366] focus-visible:ring-4 focus-visible:ring-blue-600/25 disabled:opacity-50">{busy ? <><Loader2 size={17} className="animate-spin" />처리 중...</> : mode === 'request' ? '재설정 링크 받기' : '비밀번호 변경'}</button>
          {mode === 'reset' ? <Link href={recoveryPath} className="block text-center text-sm text-slate-500 hover:underline">링크 다시 요청하기</Link> : null}
        </form>
      )}
    </LoginLayout>
  )
}
