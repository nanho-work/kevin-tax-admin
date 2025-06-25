// app/login/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/LoginForm'

export default async function LoginPage() {
  const cookieStore = await cookies() // ✅ await 사용
  const accessToken = cookieStore.get('admin_access_token')

  if (accessToken?.value) {
    redirect('/dashboard') // ✅ 로그인 상태면 대시보드로 이동
  }

  return <LoginForm />
}