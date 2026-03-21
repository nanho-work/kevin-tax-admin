'use client'

import * as clientMailService from '@/services/client/clientMailService'
import { MailInboxPage } from '@/components/common/mail/MailInboxPage'

export default function ClientMailInboxRoutePage() {
  return (
    <MailInboxPage
      api={clientMailService}
      getMailErrorMessage={clientMailService.getClientMailErrorMessage}
    />
  )
}
