'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: '메일함', href: '/client/mail/inbox' },
  { label: '메일작성', href: '/client/mail/compose' },
  { label: '계정연동', href: '/client/mail/accounts' },
]

export default function ClientMailTabs() {
  const pathname = usePathname()

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2">
      <nav className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-2 text-sm transition ${
                isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
