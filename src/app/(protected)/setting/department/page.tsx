import { redirect } from 'next/navigation'

export default function LegacySettingDepartmentPage() {
  redirect('/client/staff?panel=org')
}
