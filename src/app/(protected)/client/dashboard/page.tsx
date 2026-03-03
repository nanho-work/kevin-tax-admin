export default function ClientDashboardPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">클라이언트 포털 대시보드 화면입니다.</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        필요한 대시보드 위젯을 이 영역에 배치하면 됩니다.
      </div>
    </section>
  )
}
