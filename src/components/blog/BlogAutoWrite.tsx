import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export default function BlogAutoWrite() {
  return (
    <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="border-b border-zinc-200 pb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <Sparkles className="h-5 w-5 text-sky-600" aria-hidden="true" />자동 글쓰기
        </h1>
        <p className="mt-2 text-sm text-zinc-500">AI 글 제작은 로컬 글 작성 앱에서 진행합니다.</p>
      </header>
      <p className="text-sm leading-6 text-zinc-700">
        로컬 앱에서 작성한 내용을 복사해 블로그 글쓰기에서 편집하고 게시할 수 있습니다.
        웹사이트에서 별도로 ChatGPT 계정을 연결할 필요는 없습니다.
      </p>
      <Link href="/admin/office/blog/create" className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">
        블로그 글쓰기 →
      </Link>
    </section>
  )
}
