'use client'

import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import AdminCompanySidebar from '@/components/Company/AdminCompanySidebar'

// dynamic import
const CompanyList = dynamic(() => import('@/components/Company/CompanyList'), { ssr: false })
const CompanyRegister = dynamic(() => import('@/components/Company/CompanyrCreateForm'), { ssr: false }) // 예시로 등록 화면도 있음
const CompanyTaxDetailReport = dynamic(() => import('@/components/Company/CompanyTaxDetailReport'), { ssr: false })

export default function AdminCompanyPage() {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [view, setView] = useState<'list' | 'register' | 'report'>('list');

  const renderView = () => {
    switch (view) {
      case 'list':
        return <CompanyList />
      case 'register':
        return <CompanyRegister />
      case 'report':
        return <CompanyTaxDetailReport />
      default:
        return null
    }
  }

  return (
    <div className="relative min-h-screen">
      {sidebarVisible && (
        <AdminCompanySidebar
          onClose={() => setSidebarVisible(false)}
          onSelect={(view) => setView(view as 'list' | 'register' | 'report')}
        />
      )}

      {/* 열기 버튼 */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="fixed top-20 left-2 z-50 bg-blue-900 text-white px-3 py-1.5 rounded shadow"
        >
          ❭❭
        </button>
      )}

      <div className={`transition-all duration-300 ${sidebarVisible ? 'ml-28' : 'ml-4'} p-8`}>
        {renderView()}
      </div>

      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </div>
  )
}