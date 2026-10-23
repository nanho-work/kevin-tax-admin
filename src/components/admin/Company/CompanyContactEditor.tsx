'use client'

import { useState, type ReactNode } from 'react'
import UiEditToggle from '@/components/common/UiEditToggle'

export type ContactInfo = { name: string; phone: string; email: string; department: string; position: string; notify_mail: boolean }
type Props = {
  label: string
  contact: ContactInfo & { contactId: number | null; memo: string }
  editable: boolean
  busy: boolean
  badge: ReactNode
  onSaveInfo: (info: ContactInfo) => Promise<boolean>
  onSaveMemo: (memo: string) => Promise<boolean>
  onDelete: () => void
  formatPhone: (value: string) => string
}
const inputClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 read-only:border-transparent read-only:bg-slate-50 read-only:focus:ring-0'
const buttonClass = 'rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-50'

export default function CompanyContactEditor({ label, contact, editable, busy, badge, onSaveInfo, onSaveMemo, onDelete, formatPhone }: Props) {
  const [infoDraft, setInfoDraft] = useState<ContactInfo | null>(null)
  const [memoDraft, setMemoDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState<'info' | 'memo' | null>(null)
  const info = infoDraft ?? contact
  const locked = busy || saving !== null
  const saveInfo = async () => {
    if (!infoDraft) return
    setSaving('info')
    try { if (await onSaveInfo(infoDraft)) setInfoDraft(null) } finally { setSaving(null) }
  }
  const saveMemo = async () => {
    if (memoDraft === null) return
    setSaving('memo')
    try { if (await onSaveMemo(memoDraft)) setMemoDraft(null) } finally { setSaving(null) }
  }
  return (
    <div className="space-y-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-700">{label}</span><fieldset disabled={locked || infoDraft !== null || memoDraft !== null} className="inline-flex">{badge}</fieldset></div>
        {editable && <UiEditToggle label={`${label} 정보 수정`} checked={infoDraft !== null} disabled={locked}
          onChange={checked => setInfoDraft(checked ? { name: contact.name, phone: contact.phone, email: contact.email, department: contact.department, position: contact.position, notify_mail: contact.notify_mail } : null)} />}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-3">
        {([['name', '이름'], ['phone', '연락처'], ['email', '이메일'], ['department', '부서'], ['position', '직책']] as const).map(([key, title]) => (
          <label key={key} className="flex min-w-0 flex-col gap-1.5 text-xs text-slate-500">
            <span>{title}</span>
            <input className={inputClass} value={info[key]} readOnly={!editable || infoDraft === null} disabled={locked}
              placeholder={infoDraft ? title : '-'}
              onChange={event => {
                const value = key === 'phone' ? formatPhone(event.target.value) : event.target.value
                setInfoDraft(prev => prev ? { ...prev, [key]: value } : prev)
              }} />
          </label>
        ))}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-slate-500">메일 수신 여부</p>
          <button type="button" role="switch" aria-label={`${label} 메일 수신`} aria-checked={info.notify_mail}
            disabled={!editable || infoDraft === null || locked}
            onClick={() => setInfoDraft(prev => prev ? { ...prev, notify_mail: !prev.notify_mail } : prev)}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md px-1 text-sm focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default">
            <span aria-hidden="true" className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${info.notify_mail ? 'bg-sky-600' : 'bg-slate-300'}`}>
              <span className={`h-4 w-4 rounded-full bg-white shadow-sm ${info.notify_mail ? 'translate-x-4' : ''}`} />
            </span>
            <span className={info.notify_mail ? 'text-sky-700' : 'text-slate-500'}>{info.notify_mail ? '수신' : '비수신'}</span>
          </button>
        </div>
      </div>
      {infoDraft && <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">수정을 끄면 저장하지 않은 정보 변경이 취소됩니다.</span>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} disabled={locked} onClick={() => setInfoDraft(null)}>취소</button>
          <button type="button" className={buttonClass} disabled={locked} onClick={() => void saveInfo()}>{saving === 'info' ? '저장 중…' : contact.contactId ? '정보 저장' : '담당자 등록'}</button>
        </div>
      </div>}
      <div className="border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-600">담당자 메모</span>
          {editable && <UiEditToggle label={`${label} 메모 수정`} checked={memoDraft !== null} disabled={locked || !contact.contactId}
            onChange={checked => setMemoDraft(checked ? contact.memo : null)} />}
        </div>
        <textarea aria-label={`${label} 메모`} rows={4} value={memoDraft ?? contact.memo} readOnly={!editable || memoDraft === null} disabled={locked}
          onChange={event => setMemoDraft(event.target.value)}
          className="block min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 read-only:focus:ring-0"
          placeholder={!contact.contactId ? '담당자 정보를 등록한 뒤 메모를 작성할 수 있습니다.' : memoDraft !== null ? '연락하기 좋은 시간이나 자료 요청 시 참고할 내용을 남겨 주세요.' : '등록된 메모가 없습니다. 메모 수정 토글을 켜서 작성해 주세요.'} />
        {memoDraft !== null && <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">수정을 끄면 저장하지 않은 메모 변경이 취소됩니다.</span>
          <div className="flex gap-2">
            <button type="button" className={buttonClass} disabled={locked} onClick={() => setMemoDraft(null)}>취소</button>
            <button type="button" className={buttonClass} disabled={locked} onClick={() => void saveMemo()}>{saving === 'memo' ? '저장 중…' : '메모 저장'}</button>
          </div>
        </div>}
      </div>
      {editable && <div className="flex justify-end"><button type="button" disabled={locked || infoDraft !== null || memoDraft !== null} onClick={onDelete} className="text-xs text-rose-500 disabled:opacity-40">담당자 삭제</button></div>}
    </div>
  )
}
