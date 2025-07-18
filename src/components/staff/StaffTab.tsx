// src/components/staff/StaffHeader.tsx

interface StaffHeaderProps {
  activeTab: 'list' | 'register'
  onTabChange: (tab: 'list' | 'register') => void
}

export default function StaffHeader({ activeTab, onTabChange }: StaffHeaderProps) {
  return (
    <div className="flex gap-4 text-base border-b mb-4">
      <button
        className={`pb-2 px-4 font-medium ${activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        onClick={() => onTabChange('list')}
      >
        직원 리스트
      </button>
      <button
        className={`pb-2 px-4 font-medium ${activeTab === 'register' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        onClick={() => onTabChange('register')}
      >
        직원 등록
      </button>
    </div>
  )
}