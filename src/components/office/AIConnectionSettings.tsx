'use client'

import { useCallback, useEffect, useState } from 'react'
import { officeHttp } from '@/services/officeHttp'
import { getApiErrorMessage } from '@/utils/apiError'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'

type Connection = {
  configured: boolean; reason: string | null; connected: boolean; email: string | null
  generation_available: boolean; generation_reason: string
}
const base = `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/office/ai`

export default function AIConnectionSettings() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { confirm } = useConfirmDialog()
  const load = useCallback(async () => {
    try {
      setError('')
      const { data } = await officeHttp.get<Connection>(`${base}/connection`, { withCredentials: true })
      setConnection(data)
    } catch (err) {
      setConnection(null)
      setError(getApiErrorMessage(err, '연결 상태를 불러오지 못했습니다.'))
    }
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('ai_connection')
    if (result) {
      setNotice(result === 'connected' ? '계정 확인이 완료되었습니다.' : '연결을 완료하지 못했습니다. 다시 시도해 주세요.')
      params.delete('ai_connection')
      window.history.replaceState(null, '', window.location.pathname + (params.size ? `?${params}` : ''))
    }
    void load()
  }, [load])
  const connect = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await officeHttp.post(`${base}/connect`, {}, { withCredentials: true })
      const url = new URL(data.authorization_url)
      if (url.protocol !== 'https:' || url.hostname !== 'auth.openai.com') throw new Error('잘못된 인증 주소입니다.')
      window.location.assign(url.href)
    } catch (err) {
      setError(getApiErrorMessage(err, '연결을 시작하지 못했습니다.'))
      setBusy(false)
    }
  }
  const disconnect = async () => {
    if (!await confirm({ title: '회사 GPT 연결 해제', description: '이 사무소의 계정 연결을 해제합니다. ChatGPT 자체의 로그인은 유지됩니다.', confirmText: '연결 해제', cancelText: '취소', variant: 'danger' })) return
    setBusy(true)
    try {
      const { data } = await officeHttp.delete(`${base}/connection`, { withCredentials: true })
      setNotice(data.message)
      await load()
    } catch (err) { setError(getApiErrorMessage(err, '연결 해제에 실패했습니다.')) }
    finally { setBusy(false) }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-6 p-6">
      <header><h1 className="text-xl font-semibold">AI 계정 연결</h1><p className="mt-2 text-sm text-zinc-500">사무소에서 사용할 회사 ChatGPT 계정을 관리합니다.</p></header>
      {notice && <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="space-y-4 border-y border-zinc-200 py-5">
        <h2 className="font-medium">ChatGPT 계정</h2>
        <p className="text-sm">{connection ? connection.connected ? `연결됨 · ${connection.email || '계정 확인 완료'}` : '연결된 계정이 없습니다.' : '상태 확인 필요'}</p>
        {connection && !connection.configured && <p className="text-sm text-amber-700">{connection.reason} 서비스 운영자에게 설정을 요청해 주세요.</p>}
        <div className="flex gap-2">
          {connection?.connected
            ? <button disabled={busy} onClick={() => void disconnect()} className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50">연결 해제</button>
            : <button disabled={busy || !connection?.configured} onClick={() => void connect()} className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40">ChatGPT 계정 연결</button>}
          <button disabled={busy} onClick={() => void load()} className="rounded-md border px-4 py-2 text-sm">상태 새로고침</button>
        </div>
      </div>
      <div className="space-y-2 text-sm text-zinc-600">
        <h2 className="font-medium text-zinc-900">AI 제작 사용 상태</h2>
        <p>{connection?.generation_reason || '계정 연결과 AI 실행 권한은 별도로 확인합니다.'}</p>
        <p>이 계정 연결 과정에서는 대화나 원고를 생성하지 않으며, 별도 과금되는 API 키를 사용하지 않습니다.</p>
      </div>
    </section>
  )
}
