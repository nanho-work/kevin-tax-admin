'use client'

import { useState } from 'react'
import StaffTable from '@/components/staff/StaffTable'
import StaffForm from '@/components/staff/StaffForm'
import StaffHeader from '@/components/staff/StaffTab'

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'register'>('list')

  return (
    <div >
      <StaffHeader activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'list' && <StaffTable />}
      {activeTab === 'register' && <StaffForm />}
    </div>
  )
}