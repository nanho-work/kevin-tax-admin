import Link from 'next/link'

export default function LoginSelectPage() {
  return (
    <section className="min-h-screen bg-gray-50 px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-center text-3xl font-bold text-neutral-900">로그인 유형 선택</h1>
        <p className="mt-2 text-center text-sm text-neutral-500">사용자 유형에 맞는 로그인 화면으로 이동해 주세요.</p>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link href="/login/client" className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h2 className="text-lg font-semibold text-neutral-900">회사관리자 로그인</h2>
            <p className="mt-2 text-sm text-neutral-600">클라이언트 / 슈퍼마스터 전용</p>
          </Link>
          <Link href="/login/staff" className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h2 className="text-lg font-semibold text-neutral-900">직원 로그인</h2>
            <p className="mt-2 text-sm text-neutral-600">일반 직원 전용</p>
          </Link>
        </div>
      </div>
    </section>
  )
}
