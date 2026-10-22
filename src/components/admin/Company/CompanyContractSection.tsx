'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { ReactNode } from 'react'
import { useManagementSession } from '@/contexts/ManagementSession'
import { getClientRoleRank } from '@/utils/roleRank'
import { createBookkeepingContract, listBookkeepingContracts, updateBookkeepingContract, getClientBookkeepingErrorMessage } from '@/services/client/clientBookkeepingService'
import type { ClientBookkeepingContractCreateRequest as Payload, ClientBookkeepingContractOut as Contract } from '@/types/clientBookkeeping'

type Draft = { start: string; end: string; cycle: string; day: string; basis: string; fee: string; vat: boolean; active: boolean; memo: string; reason: string }
const empty = (): Draft => ({ start: '', end: '', cycle: '', day: '', basis: '', fee: '', vat: false, active: true, memo: '', reason: '' })
const fromContract = (c: Contract): Draft => ({ start: c.start_date || (c.start_month ? `${c.start_month}-01` : ''), end: c.end_date || (c.end_month ? `${c.end_month}-01` : ''), cycle: c.report_cycle || '', day: c.payroll_day == null ? '' : String(c.payroll_day), basis: c.payroll_basis || '', fee: c.monthly_fee_supply == null ? '' : String(c.monthly_fee_supply), vat: c.vat_included, active: c.is_active, memo: c.memo || '', reason: c.change_reason || '' })
export type CompanyContractHandle = { prepare: () => Omit<Payload, 'company_id'> | null }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-xs text-slate-500"><span>{label}</span>{children}</label> }
const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'

const CompanyContractSection = forwardRef<CompanyContractHandle, { companyId: number; creating: boolean; engagement?: string | null; disabled?: boolean; editable: boolean }>(function CompanyContractSection({ companyId, creating, engagement, disabled, editable }, ref) {
  const { session, loading: sessionLoading } = useManagementSession()
  const allowed = Boolean(session) && getClientRoleRank(session) <= 10
  const [rows, setRows] = useState<Contract[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(empty)
  const [enabled, setEnabled] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(!creating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const current = rows.find((r) => r.id === selected)
  useEffect(() => { if (creating) setEnabled(engagement === 'bookkeeping') }, [creating, engagement])
  useEffect(() => {
    if (!allowed || creating || !companyId) return
    let active = true
    setLoading(true); setError('')
    listBookkeepingContracts().then((result) => {
      if (!active) return
      const contracts = result.items.filter((r) => r.company_id === companyId)
      setRows(contracts)
      const first = contracts.find((r) => r.is_active && !r.end_date && !r.end_month) || contracts[0]
      setSelected(first?.id ?? null)
      setDraft(first ? fromContract(first) : empty())
      setEditing(false)
    }).catch((e) => { if (active) setError(getClientBookkeepingErrorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [allowed, companyId, creating, retry])

  const prepare = (): Omit<Payload, 'company_id'> | null => {
    if (!allowed || (creating && !enabled)) return null
    const fail = (text: string): never => { setError(text); throw new Error(text) }
    if (!draft.start) return fail('계약 시작일을 입력해 주세요.')
    if (draft.end && draft.end < draft.start) return fail('계약 종료일은 시작일 이후여야 합니다.')
    const fee = draft.fee === '' ? null : Number(draft.fee)
    const day = draft.day === '' ? null : Number(draft.day)
    if (fee !== null && (!Number.isSafeInteger(fee) || fee < 0)) return fail('월 기장료는 0 이상의 정수로 입력해 주세요.')
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return fail('급여일은 1~31 사이로 입력해 주세요.')
    setError('')
    return { start_date: draft.start, start_month: draft.start.slice(0, 7), end_date: draft.end || null, end_month: draft.end ? draft.end.slice(0, 7) : null,
      report_cycle: (draft.cycle || null) as Payload['report_cycle'], payroll_day: day, payroll_basis: (draft.basis || null) as Payload['payroll_basis'],
      monthly_fee_supply: fee, vat_included: draft.vat, is_active: draft.active, memo: draft.memo || null, change_reason: draft.reason || null }
  }
  useImperativeHandle(ref, () => ({ prepare }))
  const save = async () => {
    if (saving) return
    try {
      const payload = prepare(); if (!payload) return
      setSaving(true); setMessage('')
      const saved = selected ? await updateBookkeepingContract(selected, payload) : await createBookkeepingContract({ ...payload, company_id: companyId })
      setRows((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)])
      setSelected(saved.id); setDraft(fromContract(saved)); setEditing(false)
      setMessage('기장계약을 저장했습니다. 기장 계약 메뉴에도 동일하게 반영됩니다.')
    } catch (e) { setError(e instanceof Error && !('response' in e) ? e.message : getClientBookkeepingErrorMessage(e)) }
    finally { setSaving(false) }
  }
  if (sessionLoading || !allowed) return null
  const showFields = creating ? enabled : editing
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }))
  return <section className="min-w-0">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">기장 계약</h3><p className="mt-1 text-xs text-slate-500">기장 계약 메뉴와 같은 계약정보입니다.</p></div>
      {!creating && editable && !loading && !error && !editing ? <button type="button" className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700" onClick={() => { setEditing(true); setMessage('') }}>{current ? '계약 수정' : '계약 등록'}</button> : null}
      {!creating && editable && !loading && !error && !editing && current ? <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600" onClick={() => { setSelected(null); setDraft(empty()); setEditing(true); setMessage('') }}>새 계약</button> : null}
    </div>
    {creating ? <label className="mb-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={enabled} disabled={disabled} onChange={(e) => setEnabled(e.target.checked)} />거래처 등록 시 기장계약 함께 등록</label> : null}
    {loading && !creating ? <p className="text-sm text-slate-500">계약정보를 불러오는 중입니다…</p> : null}
    {error ? <p role="alert" className="mb-3 text-sm text-rose-600">{error}{!editing && !creating ? <button type="button" className="ml-2 underline" onClick={() => setRetry((n) => n + 1)}>다시 조회</button> : null}</p> : null}
    {message ? <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p> : null}
    {!creating && !loading && rows.length > 0 ? <label className="mb-4 block text-xs text-slate-500">계약 선택<select aria-label="기장계약 선택" className={`${input} mt-1.5`} value={selected ?? ''} disabled={editing || saving} onChange={(e) => { const row = rows.find((r) => r.id === Number(e.target.value)); if (row) { setSelected(row.id); setDraft(fromContract(row)); setMessage('') } }}>
      {selected === null ? <option value="">새 계약</option> : null}
      {rows.map((row) => <option key={row.id} value={row.id}>{row.start_date || row.start_month} ~ {row.end_date || row.end_month || '진행중'} · {row.is_active ? '활성' : '비활성'} · v{row.version_no}</option>)}</select></label> : null}
    {showFields ? <fieldset disabled={saving || disabled} className="space-y-4 disabled:opacity-60"><div className="grid gap-4 sm:grid-cols-2">
      <Field label="계약 시작일"><input aria-label="계약 시작일" type="date" className={input} value={draft.start} onChange={(e) => change('start', e.target.value)} /></Field>
      <Field label="계약 종료일 (미입력 시 계속)"><input type="date" className={input} value={draft.end} onChange={(e) => change('end', e.target.value)} /></Field>
      <Field label="신고주기"><select className={input} value={draft.cycle} onChange={(e) => change('cycle', e.target.value)}><option value="">미지정</option><option value="monthly">매월</option><option value="semiannual">반기</option></select></Field>
      <Field label="급여일"><input type="number" min={1} max={31} className={input} value={draft.day} onChange={(e) => change('day', e.target.value)} placeholder="1~31일" /></Field>
      <Field label="급여 귀속 기준"><select className={input} value={draft.basis} onChange={(e) => change('basis', e.target.value)}><option value="">미지정</option><option value="current_month">당월 귀속 · 당월 지급</option><option value="previous_month">전월 귀속 · 당월 지급</option></select></Field>
      <Field label="월 기장료 (공급가, 원)"><input type="number" min={0} step={1} className={input} value={draft.fee} onChange={(e) => change('fee', e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.vat} onChange={(e) => change('vat', e.target.checked)} />부가세 포함</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => change('active', e.target.checked)} />계약 활성</label>
    </div>
      {selected ? <Field label="변경 사유"><input className={input} value={draft.reason} onChange={(e) => change('reason', e.target.value)} /></Field> : null}
      <div className="border-t border-slate-100 pt-4"><Field label="계약 메모"><textarea rows={4} className={`${input} resize-y`} value={draft.memo} onChange={(e) => change('memo', e.target.value)} /></Field></div>
      {creating ? <p className="text-xs text-slate-500">상단의 등록완료 버튼으로 거래처와 계약을 등록합니다.</p> : <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-xs" onClick={() => { const original = current || rows[0]; setSelected(original?.id ?? null); setDraft(original ? fromContract(original) : empty()); setEditing(false); setError('') }}>취소</button><button type="button" className="rounded-lg bg-sky-600 px-4 py-2 text-xs text-white" onClick={() => void save()}>{saving ? '저장 중…' : '계약 저장'}</button></div>}
    </fieldset> : !creating && !loading && !error ? current ? <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {[['신고주기', current.report_cycle === 'monthly' ? '매월' : current.report_cycle === 'semiannual' ? '반기' : '미지정'], ['급여일', current.payroll_day ? `${current.payroll_day}일` : '미지정'], ['급여 귀속 기준', current.payroll_basis === 'current_month' ? '당월 귀속 · 당월 지급' : current.payroll_basis === 'previous_month' ? '전월 귀속 · 당월 지급' : '미지정'], ['월 기장료 (공급가)', current.monthly_fee_supply == null ? '미지정' : `${current.monthly_fee_supply.toLocaleString()}원`], ['부가세', current.vat_included ? '포함' : '별도']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{value}</dd></div>)}
      <div className="border-t border-slate-100 pt-4 sm:col-span-2"><dt className="text-xs text-slate-500">계약 메모</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{current.memo || '-'}</dd></div>
    </dl> : <p className="text-sm text-slate-500">등록된 기장계약이 없습니다.</p> : null}
  </section>
})
export default CompanyContractSection
