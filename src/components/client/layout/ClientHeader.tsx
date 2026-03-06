'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BackButton from '@/components/common/BackButton'

type HeaderInfo = {
  parent: string
  child?: string
}

function currentHeader(pathname: string): HeaderInfo {
  if (pathname.startsWith('/client/dashboard')) return { parent: '대시보드' }
  if (pathname.startsWith('/client/companies/')) return { parent: '고객사관리', child: '고객사 상세정보' }
  if (pathname.startsWith('/client/companies')) return { parent: '고객사관리' }
  if (pathname.startsWith('/client/bookkeeping/contracts')) return { parent: '기장 관리', child: '기장 거래처 관리' }
  if (pathname.startsWith('/client/bookkeeping/billings')) return { parent: '기장 관리', child: '월별 청구/수납 관리' }
  if (pathname.startsWith('/client/bookkeeping/summary')) return { parent: '기장 관리', child: '월별 집계' }
  if (pathname.startsWith('/client/bookkeeping/debits')) return { parent: '기장 관리', child: '자동이체 업로드(출금조회)' }
  if (pathname.startsWith('/client/staff/register')) return { parent: '인사관리', child: '직원등록' }
  if (pathname.startsWith('/client/staff/profile-status')) return { parent: '인사관리', child: '직원정보수정/재직상태' }
  if (pathname.startsWith('/client/staff/leave')) return { parent: '인사관리', child: '직원휴가관리' }
  if (pathname.startsWith('/client/staff/organization')) return { parent: '인사관리', child: '권한/조직배치' }
  if (pathname.startsWith('/client/staff/attendance')) return { parent: '인사관리', child: '근태기록 조회' }
  if (pathname.startsWith('/client/staff/leave-history')) return { parent: '인사관리', child: '휴가승인/반려 이력' }
  if (pathname.startsWith('/client/staff/account-security')) return { parent: '인사관리', child: '초기비밀번호 재설정/잠금해제' }
  if (pathname.startsWith('/client/staff')) return { parent: '인사관리', child: '직원목록/검색' }
  if (pathname.startsWith('/client/client-management/company-create')) return { parent: '클라이언트 관리', child: '클라이언트(업체) 등록' }
  if (pathname.startsWith('/client/client-management/company-list')) return { parent: '클라이언트 관리', child: '클라이언트(업체) 목록' }
  if (pathname.startsWith('/client/client-management/create')) return { parent: '클라이언트 관리', child: '클라이언트(관리자) 등록' }
  if (pathname.startsWith('/client/client-management/list')) return { parent: '클라이언트 관리', child: '클라이언트(관리자) 목록' }
  if (pathname.startsWith('/client/client-management/templates')) return { parent: '클라이언트 관리', child: '샘플양식 업로드' }
  if (pathname.startsWith('/client/client-management')) return { parent: '클라이언트 관리' }
  if (pathname.startsWith('/client/setting')) return { parent: '설정' }
  if (pathname.startsWith('/client/schedule')) return { parent: '일정관리' }
  return { parent: '클라이언트' }
}

export default function ClientHeader() {
  const pathname = usePathname()
  const { parent, child } = currentHeader(pathname)
  const title = child ? `${parent} > ${child}` : parent
  const backPath = (() => {
    if (pathname.startsWith('/client/companies/')) return '/client/companies'
    if (pathname.startsWith('/client/bookkeeping/debits/batches/')) return '/client/bookkeeping/debits/batches'
    return null
  })()

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="px-4 py-3">
        <div className="grid grid-cols-[1fr_auto] items-stretch gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">{title}</div>
            <div className="mt-1 text-xs text-neutral-500">
              <Link href="/client/dashboard" className="hover:underline">대시보드</Link>
              <span className="mx-2 text-neutral-300">/</span>
              <span>{parent}</span>
              {child ? (
                <>
                  <span className="mx-2 text-neutral-300">/</span>
                  <span>{child}</span>
                </>
              ) : null}
            </div>
          </div>
          {backPath ? (
            <div className="flex items-center">
              <BackButton
                fallbackPath={backPath}
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
