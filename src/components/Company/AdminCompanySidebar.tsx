import React from 'react'

interface AdminCompanySidebarProps {
  onSelect: (view: string) => void
  onClose: () => void
}

export default function AdminCompanySidebar({ onSelect, onClose }: AdminCompanySidebarProps) {
  return (
    <div className="fixed top-16 left-0 z-50 h-full w-40 bg-white shadow-lg border-r border-gray-200">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">업체 관리</h2>
        <button onClick={onClose}>❮❮</button>
      </div>

      <nav className="p-4 space-y-4">
        <button onClick={() => onSelect('list')} className="block text-left w-full text-gray-700 hover:text-blue-600">
          업체 리스트
        </button>
        <button onClick={() => onSelect('register')} className="block text-left w-full text-gray-700 hover:text-blue-600">
          업체 등록
        </button>
        <button onClick={() => onSelect('report')} className="block text-left w-full text-gray-700 hover:text-blue-600">
          회사 귀속 보고서
        </button>
      </nav>
    </div>
  )
}