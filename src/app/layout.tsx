import '@/styles/globals.css'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext'



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
      <body>
        <ConfirmDialogProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: { marginTop: '64px' },
            }}
          />
        </ConfirmDialogProvider>
      </body>
    </html>
  )
}
