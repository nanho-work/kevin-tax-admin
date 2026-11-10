import type { ReactNode } from 'react'

export default function CompanySelectionButton({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: ReactNode
}) {
  return <button type="button" aria-pressed={selected} onClick={onClick}
    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-400 hover:bg-slate-100'}`}>
    {children}
  </button>
}
