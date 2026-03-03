export default function StaffPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">직원 관리</h1>
        <p className="mt-1 text-sm text-zinc-500">직원 등록/수정/재직 상태 관리는 클라이언트 포털에서 수행합니다.</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        클라이언트 포털 경로: /client/staff
      </div>
    </section>
  )
}
