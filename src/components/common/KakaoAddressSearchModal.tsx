'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchKakaoAddress, type KakaoAddressItem } from '@/services/address/kakaoAddressService'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (item: KakaoAddressItem) => void
}

export default function KakaoAddressSearchModal({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<KakaoAddressItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setItems([])
    setError('')
  }, [open])

  if (!open) return null

  const handleSearch = async () => {
    const q = query.trim()
    if (q.length < 2) {
      setError('검색어를 2자 이상 입력해 주세요.')
      setItems([])
      return
    }
    setError('')
    try {
      setLoading(true)
      const res = await searchKakaoAddress({ query: q, page: 1, size: 10 })
      setItems(res.items || [])
      if (!res.items?.length) {
        setError('검색 결과가 없습니다.')
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' && detail.trim() ? detail : '주소 검색에 실패했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">우편번호 검색</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              placeholder="도로명/지번/건물명 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch()
              }}
            />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <Search size={14} />
              검색
            </button>
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <div className="max-h-[380px] overflow-y-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left">우편번호</th>
                  <th className="px-3 py-2 text-left">주소1</th>
                  <th className="px-3 py-2 text-left">주소2</th>
                  <th className="px-3 py-2 text-center">선택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      검색 중...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={`${item.postal_code}-${item.address1}-${idx}`}>
                      <td className="px-3 py-2 text-zinc-700">{item.postal_code || '-'}</td>
                      <td className="px-3 py-2 text-zinc-900">{item.address1 || '-'}</td>
                      <td className="px-3 py-2 text-zinc-700">{item.address2 || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                          onClick={() => {
                            onSelect(item)
                            onClose()
                          }}
                        >
                          선택
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

