'use client'

type Props = { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }

export default function UiEditToggle({ label, checked, onChange, disabled }: Props) {
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-xs text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50">
      <span>{checked ? '수정 중' : '수정'}</span>
      <span aria-hidden="true" className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-sky-600' : 'bg-slate-300'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}
