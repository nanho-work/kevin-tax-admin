'use client'

import Link from 'next/link'

export default function ClientStaffRegisterPage() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
      <p className="text-base font-semibold text-zinc-900">직원 직접등록은 사용하지 않습니다.</p>
      <p className="mt-2 text-sm text-zinc-600">직원이 회원가입 신청을 제출하면, 이 포털에서 승인 처리하는 방식으로 운영됩니다.</p>
      <div className="mt-4">
        <Link
          href="/client/staff/signup-requests"
          className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          직원가입신청 관리로 이동
        </Link>
      </div>
    </section>
  )
}
