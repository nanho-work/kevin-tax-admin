type Props = {
  title: string
  description: string
}

export default function ClientStaffMenuPage({ title, description }: Props) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        화면 UI 구성 완료. 기능 연동은 다음 단계에서 진행합니다.
      </div>
    </section>
  )
}
