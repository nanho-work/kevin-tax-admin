import Link from 'next/link'

export default function WithholdingNavigation({ active }: { active: 'board' | 'business' }) {
  return (
    <nav aria-label="원천세 업무 구분" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      {[
        { key: 'board', label: '원천세 업무', href: '/admin/company-withholding' },
        { key: 'business', label: '사업신고', href: '/admin/company-withholding/business' },
      ].map(item => (
        <Link key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active === item.key ? 'bg-sky-50 text-sky-700' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
