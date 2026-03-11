'use client'

import UiButton from '@/components/common/UiButton'
import type { MailAuthType } from '@/types/adminMail'

type MailAccountSyncActionsProps = {
  authType: MailAuthType
  testing: boolean
  initialSyncStarting: boolean
  initialSyncRefreshing: boolean
  initialSyncCanceling: boolean
  deleting: boolean
  canCancelInitialSync: boolean
  onTestConnection: () => void
  onStartInitialSync: () => void
  onRefreshInitialSyncStatus: () => void
  onCancelInitialSync: () => void
  onDeleteAccount: () => void
}

export default function MailAccountSyncActions({
  authType,
  testing,
  initialSyncStarting,
  initialSyncRefreshing,
  initialSyncCanceling,
  deleting,
  canCancelInitialSync,
  onTestConnection,
  onStartInitialSync,
  onRefreshInitialSyncStatus,
  onCancelInitialSync,
  onDeleteAccount,
}: MailAccountSyncActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {authType === 'oauth' ? <p className="w-full text-xs text-zinc-500">OAuth 계정은 Gmail API 방식으로 동기화됩니다.</p> : null}
      <UiButton onClick={onTestConnection} disabled={testing} variant="secondary" size="sm">
        {testing ? '테스트 중' : '연결 테스트'}
      </UiButton>
      <UiButton
        onClick={onStartInitialSync}
        disabled={initialSyncStarting || canCancelInitialSync}
        variant="secondary"
        size="sm"
        className="border-blue-300 text-blue-700 hover:bg-blue-50"
      >
        {initialSyncStarting ? '시작중' : '과거메일 가져오기'}
      </UiButton>
      <UiButton onClick={onRefreshInitialSyncStatus} disabled={initialSyncRefreshing} variant="secondary" size="sm">
        {initialSyncRefreshing ? '조회중' : '진행 상태'}
      </UiButton>
      <UiButton
        onClick={onCancelInitialSync}
        disabled={initialSyncCanceling || !canCancelInitialSync}
        variant={canCancelInitialSync ? 'danger' : 'soft'}
        size="sm"
      >
        {initialSyncCanceling ? '중지중' : '가져오기 중지'}
      </UiButton>
      <UiButton onClick={onDeleteAccount} disabled={deleting} variant="danger" size="sm">
        {deleting ? '삭제 중' : '삭제'}
      </UiButton>
    </div>
  )
}
