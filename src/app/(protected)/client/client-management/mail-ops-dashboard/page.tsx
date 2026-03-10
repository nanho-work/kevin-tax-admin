'use client'

import { useEffect, useState } from 'react'
import { getMailOpsDashboard, getClientMailErrorMessage } from '@/services/client/clientMailService'
import type { MailOpsDashboardResponse } from '@/types/adminMail'

export default function ClientMailOpsDashboardPage() {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<MailOpsDashboardResponse | null>(null)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const res = await getMailOpsDashboard()
      setDashboard(res)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getClientMailErrorMessage(error))
      setDashboard(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  return (
    <section className="space-y-4">
      {errorMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">메일운영대시보드</h2>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading ? '조회 중...' : '새로고침'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">활성계정 {dashboard?.total_active_accounts ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">동기화대기 {dashboard?.sync_due_accounts ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">백오프계정 {dashboard?.sync_backoff_accounts ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">큐대기 {dashboard?.queue_waiting_count ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">큐처리중 {dashboard?.queue_processing_count ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">큐실패 {dashboard?.queue_failed_count ?? 0}</div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-700">오늘발송 {dashboard?.queue_sent_today_count ?? 0}</div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">최근 동기화 실패</p>
            <div className="mt-1 space-y-1">
              {(dashboard?.recent_sync_failures || []).slice(0, 5).map((item) => (
                <p key={item.id} className="text-xs text-zinc-700">
                  계정#{item.mail_account_id} · {item.status} · {item.error_message || '-'}
                </p>
              ))}
              {(dashboard?.recent_sync_failures || []).length === 0 ? <p className="text-xs text-zinc-400">없음</p> : null}
            </div>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">최근 발송 실패</p>
            <div className="mt-1 space-y-1">
              {(dashboard?.recent_send_failures || []).slice(0, 5).map((item) => (
                <p key={item.id} className="text-xs text-zinc-700">
                  계정#{item.mail_account_id} · {item.last_error_code || item.status} · {item.last_error_message || item.stopped_reason || '-'}
                </p>
              ))}
              {(dashboard?.recent_send_failures || []).length === 0 ? <p className="text-xs text-zinc-400">없음</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
