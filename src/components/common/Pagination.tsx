// components/common/Pagination.tsx
'use client'

interface PaginationProps {
  page: number
  total: number
  limit: number
  onPageChange: (newPage: number) => void
}

export default function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="mt-4 flex justify-center items-center gap-2 text-sm">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        ◀
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
        .map((p, idx, arr) => {
          const isEllipsis = idx > 0 && p - arr[idx - 1] > 1
          return isEllipsis ? (
            <span key={`ellipsis-${p}`} className="px-1">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1 rounded border ${p === page ? 'bg-blue-600 text-white font-semibold' : 'bg-white hover:bg-gray-100'}`}
            >
              {p}
            </button>
          )
        })}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        ▶
      </button>
    </div>
  )
}