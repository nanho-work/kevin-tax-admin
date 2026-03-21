'use client'

import { Suspense } from 'react'
import GoogleOAuthCallbackContent from '@/components/common/mail/GoogleOAuthCallbackContent'
import { completeGoogleOAuth, getClientMailErrorMessage, listMailAccounts } from '@/services/client/clientMailService'

export default function ClientMailOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto mt-16 max-w-xl rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Google 연결 중...
        </section>
      }
    >
      <GoogleOAuthCallbackContent
        accountPath="/client/mail/accounts"
        completeGoogleOAuth={completeGoogleOAuth}
        listMailAccounts={listMailAccounts}
        getMailErrorMessage={getClientMailErrorMessage}
      />
    </Suspense>
  )
}

