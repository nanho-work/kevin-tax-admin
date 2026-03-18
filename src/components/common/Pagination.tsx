// components/common/Pagination.tsx
'use client'

import UiButton from '@/components/common/UiButton'
import { cn } from '@/lib/cn'
import { normalizePage, normalizePageSize } from '@/lib/pagination'

interface PaginationProps {
  page: number
  total: number
  limit: number
  onPageChange: (newPage: number) => void
  className?: string
  windowSize?: number
  showFirstLast?: boolean
}

function buildPageNumbers(page: number, totalPages: number, windowSize: number): number[] {
  const safeWindow = Math.max(1, windowSize)
  const start = Math.floor((page - 1) / safeWindow) * safeWindow + 1
  const end = Math.min(totalPages, start + safeWindow - 1)
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx)
}

export default function Pagination({
  page,
  total,
  limit,
  onPageChange,
  className,
  windowSize = 5,
  showFirstLast = true,
}: PaginationProps) {
  const safeLimit = normalizePageSize(limit, 20, Number.MAX_SAFE_INTEGER)
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safeLimit))
  const currentPage = Math.min(totalPages, normalizePage(page))
  const numbers = buildPageNumbers(currentPage, totalPages, windowSize)

  const move = (target: number) => {
    const next = Math.min(totalPages, Math.max(1, target))
    if (next !== currentPage) onPageChange(next)
  }

  return (
    <div className={cn('mt-4 flex items-center justify-center gap-1.5 text-sm', className)}>
      {showFirstLast ? (
        <UiButton
          size="sm"
          variant="secondary"
          onClick={() => move(1)}
          disabled={currentPage <= 1}
          aria-label="첫 페이지"
        >
          {'<<'}
        </UiButton>
      ) : null}
      <UiButton
        size="sm"
        variant="secondary"
        onClick={() => move(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="이전 페이지"
      >
        {'<'}
      </UiButton>

      {numbers.map((num) => (
        <UiButton
          key={num}
          size="sm"
          variant={num === currentPage ? 'primary' : 'secondary'}
          onClick={() => move(num)}
          aria-current={num === currentPage ? 'page' : undefined}
        >
          {num}
        </UiButton>
      ))}

      <UiButton
        size="sm"
        variant="secondary"
        onClick={() => move(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="다음 페이지"
      >
        {'>'}
      </UiButton>
      {showFirstLast ? (
        <UiButton
          size="sm"
          variant="secondary"
          onClick={() => move(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="마지막 페이지"
        >
          {'>>'}
        </UiButton>
      ) : null}
    </div>
  )
}
