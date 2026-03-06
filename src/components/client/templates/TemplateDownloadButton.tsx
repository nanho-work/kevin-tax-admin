'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { getClientTemplateDownloadUrlByCode } from '@/services/client/clientTemplateService'

type Props = {
  code: string
  label?: string
  className?: string
}

export default function TemplateDownloadButton({
  code,
  label = '양식 다운로드',
  className = 'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50',
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    try {
      setLoading(true)
      const res = await getClientTemplateDownloadUrlByCode(code)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '양식 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" disabled={loading} onClick={handleDownload} className={className}>
      {loading ? '다운로드 중...' : label}
    </button>
  )
}

