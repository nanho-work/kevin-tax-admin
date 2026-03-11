import type { MailAccount } from '@/types/adminMail'

export function filterAdminVisibleMailAccounts(
  accounts: MailAccount[],
  adminId?: number | null
): MailAccount[] {
  if (!adminId || !Number.isFinite(adminId)) {
    return accounts.filter((account) => account.account_scope !== 'personal')
  }
  return accounts.filter(
    (account) =>
      account.account_scope !== 'personal' ||
      Number(account.owner_admin_id || 0) === Number(adminId)
  )
}
