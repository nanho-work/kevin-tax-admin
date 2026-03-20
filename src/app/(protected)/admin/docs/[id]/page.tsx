'use client'

import { useParams, useRouter } from 'next/navigation'
import UiButton from '@/components/common/UiButton'

export default function AdminDocDetailPlaceholderPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  return (
    <div className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6">
      <div className="mx-auto max-w-3xl rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">문서 상세</h1>
        <p className="mt-2 text-sm text-zinc-500">문서 ID: {params?.id || '-'}</p>
        <p className="mt-3 text-sm text-zinc-600">상세 화면은 2차에서 구현 예정입니다.</p>
        <div className="mt-5">
          <UiButton variant="secondary" size="sm" onClick={() => router.push('/admin/docs')}>
            문서함으로 돌아가기
          </UiButton>
        </div>
      </div>
    </div>
  )
}
