import { redirect } from 'next/navigation'

export default function LegacySettingPage() {
  redirect('/client/staff?panel=org')
}
