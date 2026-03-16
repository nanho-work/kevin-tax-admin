import { redirect } from 'next/navigation'

export default function LegacySettingTeamPage() {
  redirect('/client/staff?panel=org')
}
