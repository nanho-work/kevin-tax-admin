import Link from 'next/link'
import { Sparkles, Link2, FilePenLine, Eye, Send } from 'lucide-react'

// No provider is configured yet. Never infer a customer connection from the
// developer's local Codex login or silently fall back to a billable API key.
export default function BlogAutoWrite() {
  return (
    <section className="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
      <header className="border-b border-zinc-200 pb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <Sparkles className="h-5 w-5 text-sky-600" aria-hidden="true" />자동 글쓰기
        </h1>
        <p className="mt-2 text-sm text-zinc-500">회사 ChatGPT 계정으로 초안을 만들고, 내용을 검토한 뒤 게시하는 공간입니다.</p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5" role="status">
        <div className="flex items-center gap-2 font-medium text-zinc-900">
          <Link2 className="h-4 w-4" aria-hidden="true" />회사 ChatGPT 계정 설정
        </div>
        <p id="ai-unavailable" className="mt-2 text-sm leading-6 text-zinc-700">
          사무소 설정에서 회사 계정을 연결할 수 있습니다. 자동 제작은 계정 연결 외에 AI 실행 권한 연동이 필요하며, 현재는 제공되지 않습니다.
        </p>
        <Link href="/admin/office/setting/ai" className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">GPT 계정 연결 설정 →</Link>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">연결 후 제공할 작성 흐름</h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {[
            { icon: FilePenLine, title: '1. 초안 제작', description: '주제와 참고 내용을 바탕으로 초안을 제작합니다.' },
            { icon: Eye, title: '2. 수정·미리보기', description: '임시저장한 본문과 이미지를 수정하고 게시 모습을 확인합니다.' },
            { icon: Send, title: '3. 직접 게시', description: '게시를 눌렀을 때만 공개합니다. 본문 첫 이미지를 대표 이미지로 사용합니다.' },
          ].map(({ icon: Icon, title, description }) => (
            <li key={title} className="space-y-2">
              <Icon className="h-5 w-5 text-zinc-400" aria-hidden="true" />
              <h3 className="text-sm font-medium text-zinc-800">{title}</h3>
              <p className="text-sm leading-6 text-zinc-500">{description}</p>
            </li>
          ))}
        </ol>
      </div>
      <footer className="border-t border-zinc-200 pt-5">
        <Link href="/admin/office/blog/create" className="text-sm font-medium text-sky-700 hover:underline">직접 글 작성하기 →</Link>
      </footer>
    </section>
  )
}
