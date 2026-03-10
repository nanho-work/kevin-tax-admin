'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { completeGoogleOAuth, getAdminMailErrorMessage, listMailAccounts } from '@/services/admin/mailService'

const CALLBACK_TIMEOUT_MS = 15_000

function decodeText(value: string | null) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

function getGoogleOAuthCallbackErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'timeout') {
    return 'Google 연결 확인이 지연되고 있습니다. 다시 시도해 주세요.'
  }
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 400) return '연동이 만료되었어요. 다시 시도해 주세요.'
    if (error.response?.status === 409) return '이미 다른 개인 소유로 등록된 계정입니다.'
    if (error.response?.status === 422) return 'OAuth 인증 값이 올바르지 않습니다. 다시 시도해 주세요.'
    if (error.response?.status === 500) return '서버 설정 문제입니다. 관리자에게 문의해 주세요.'
  }
  return getAdminMailErrorMessage(error)
}

export default function AdminMailOAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      oauth: searchParams.get('oauth') || '',
      code: searchParams.get('code') || '',
      state: searchParams.get('state') || '',
      message: decodeText(searchParams.get('message')),
      email: decodeText(searchParams.get('email')),
    }),
    [searchParams]
  )

  const goToAccountPage = () => {
    router.replace('/admin/mail/accounts')
  }

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const run = async () => {
      try {
        setLoading(true)
        setErrorMessage(null)

        if (params.oauth === 'success') {
          const successMessage = params.message || (params.email ? `${params.email} 연동이 완료되었습니다.` : '연동 완료')
          toast.success(successMessage)
          try {
            await listMailAccounts(true)
          } catch {
            // noop: 목록 페이지 진입 시 재조회됨
          }
          goToAccountPage()
          return
        }

        if (params.oauth === 'error') {
          throw new Error(params.message || 'Google 연동에 실패했습니다. 다시 시도해 주세요.')
        }

        if (!params.code || !params.state) {
          throw new Error('인증 값이 누락되었습니다. 다시 시도해 주세요.')
        }

        const res = await withTimeout(completeGoogleOAuth(params.code, params.state), CALLBACK_TIMEOUT_MS)
        toast.success(res.message || '연동 완료')
        try {
          await listMailAccounts(true)
        } catch {
          // noop
        }
        goToAccountPage()
      } catch (error) {
        const message =
          error instanceof Error && !axios.isAxiosError(error) && error.message
            ? error.message
            : getGoogleOAuthCallbackErrorMessage(error)
        setErrorMessage(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [params, router])

  return (
    <section className="mx-auto mt-16 max-w-xl rounded-xl border border-zinc-200 bg-white p-6">
      <h1 className="text-base font-semibold text-zinc-900">Google 메일 연동</h1>
      {loading ? (
        <>
          <p className="mt-2 text-sm text-zinc-600">Google 연결 중...</p>
          <p className="mt-1 text-xs text-zinc-500">최대 15초 내에 완료되지 않으면 다시 시도해 주세요.</p>
        </>
      ) : null}
      {!loading && errorMessage ? <p className="mt-2 text-sm text-rose-600">{errorMessage}</p> : null}
      {!loading && errorMessage ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={goToAccountPage}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            다시 시도
          </button>
        </div>
      ) : null}
    </section>
  )
}
