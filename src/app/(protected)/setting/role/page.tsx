import { redirect } from 'next/navigation'

export default function LegacySettingRolePage() {
  redirect('/client/staff?panel=org')
}
