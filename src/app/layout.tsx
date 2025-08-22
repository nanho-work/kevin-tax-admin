import '@/styles/globals.css'
import type { Metadata } from 'next'



export const metadata: Metadata = {
  title: 'KevinTax Admin',
  description: '백오피스 관리 시스템',
  icons: {
    icon: '/favicon.ico', // public 폴더 기준 경로
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}