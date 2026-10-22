import type { ReactNode } from 'react'
import { ArrowUpRight, Layers3 } from 'lucide-react'

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7fb] p-4 sm:p-8 lg:flex lg:items-center lg:justify-center lg:p-12">
      <div className="mx-auto grid w-full max-w-[1120px] overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)] lg:min-h-[700px] lg:grid-cols-[0.95fr_1fr]">
        <aside className="relative flex flex-col overflow-hidden bg-[#153f80] px-8 py-10 text-white sm:px-12 lg:py-12">
          <div className="relative z-10 flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-blue-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10"><Layers3 size={18} aria-hidden="true" /></span>
            WORKSPACE
          </div>
          <div className="relative z-10 mt-10 lg:mt-20">
            <p className="mb-4 text-xs font-medium tracking-[0.15em] text-blue-200">하루의 업무를 시작하는 곳</p>
            <h2 className="text-3xl font-semibold leading-[1.45] tracking-tight sm:text-4xl">업무는 한곳에서,<br />흐름은 한눈에.</h2>
            <p className="mt-5 text-sm leading-7 text-blue-100/80">거래처부터 업무와 자료까지.<br />함께 일하는 데 필요한 정보를 연결하세요.</p>
          </div>
          <div aria-hidden="true" className="relative my-12 hidden h-40 lg:block">
            <div className="absolute left-4 right-0 top-6 h-32 -rotate-6 rounded-2xl border border-white/10 bg-white/5" />
            <div className="absolute left-0 right-4 top-0 rounded-2xl border border-white/20 bg-white/10 p-6">
              <div className="flex items-center justify-between"><span className="text-sm text-blue-50">오늘의 업무 흐름</span><ArrowUpRight size={18} className="text-blue-200" /></div>
              <div className="mt-6 flex gap-2">{['확인', '진행', '완료'].map((label, index) => <div key={label} className="flex-1"><div className={`mb-2 h-1 rounded-full ${index === 2 ? 'bg-white/20' : 'bg-blue-200'}`} /><span className="text-xs text-blue-100/80">{label}</span></div>)}</div>
            </div>
          </div>
          <p className="relative z-10 mt-auto hidden text-xs tracking-wide text-blue-200/70 lg:block">정리된 업무, 이어지는 협업.</p>
        </aside>
        <section className="flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
      </div>
    </main>
  )
}
