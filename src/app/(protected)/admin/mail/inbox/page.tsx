'use client'

import { useMemo } from 'react'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { filterAdminVisibleMailAccounts } from '@/utils/mailAccountScope'
import * as adminMailService from '@/services/admin/mailService'
import { MailInboxPage } from '@/components/common/mail/MailInboxPage'

export default function AdminMailInboxPage() {
  const { session } = useAdminSessionContext()

  const filterAccounts = useMemo(
    () => (accounts: Parameters<typeof filterAdminVisibleMailAccounts>[0]) =>
      filterAdminVisibleMailAccounts(accounts, session?.id),
    [session?.id]
  )

  return (
    <MailInboxPage
      api={adminMailService}
      getMailErrorMessage={adminMailService.getAdminMailErrorMessage}
      filterAccounts={filterAccounts}
      accountsFilterVersion={session?.id ?? null}
      canManageCompanyMailbox={true}
    />
  )
}
