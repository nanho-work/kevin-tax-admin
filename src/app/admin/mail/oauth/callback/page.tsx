'use client'

import { Suspense } from 'react'
import GoogleOAuthCallbackContent from '@/components/common/mail/GoogleOAuthCallbackContent'
import { completeGoogleOAuth, getAdminMailErrorMessage, listMailAccounts } from '@/services/admin/mailService'

export default function AdminMailOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto mt-16 max-w-xl rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Google 연결 중...
        </section>
      }
    >
      <GoogleOAuthCallbackContent
        accountPath="/admin/mail/accounts"
        completeGoogleOAuth={completeGoogleOAuth}
        listMailAccounts={listMailAccounts}
        getMailErrorMessage={getAdminMailErrorMessage}
      />
    </Suspense>
  )
}

