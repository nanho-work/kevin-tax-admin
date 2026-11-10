'use client'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getCompanyTaskDefaults, saveCompanyTaskDefaults, listGlobalTaskTemplates, getTaskBoardErrorMessage,
  type CompanyTaskDefaultsInput, type CompanyTaskDefaultsResult } from '@/services/workflowTaskBoard'
import { getMonthlyWorkPeriod } from '@/utils/monthlyWorkProgress'
import toast from 'react-hot-toast'

export interface CompanyTaskDefaultsHandle { prepare: () => CompanyTaskDefaultsInput | undefined }
export default forwardRef<CompanyTaskDefaultsHandle, { companyId: number; creating: boolean; editable: boolean }>(function CompanyTaskDefaultsSection({ companyId, creating, editable }, ref) {
  const scope = usePathname().startsWith('/client') ? 'client' : 'admin'
  const [templates, setTemplates] = useState<{ id: number; task_name: string }[]>([])
  const [history, setHistory] = useState<CompanyTaskDefaultsResult | null>(null)
  const [configure, setConfigure] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [month, setMonth] = useState(getMonthlyWorkPeriod().attribution)
  const [end, setEnd] = useState('')
  const [ids, setIds] = useState<number[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    setBusy(true);setError('')
    Promise.all([listGlobalTaskTemplates(scope, { templateKind: 'base', includeInactive: false }), creating ? Promise.resolve(null) : getCompanyTaskDefaults(scope, companyId)])
      .then(([catalog, result]) => {
        if (cancelled) return
        setTemplates(catalog.items);setHistory(result)
        const latest = result?.versions[0]
        setConfigure(!!latest)
        if (latest) { setEnabled(latest.enabled);setMonth(latest.effective_month);setEnd(latest.end_month ?? '');setIds(latest.template_ids) }
      }).catch(e => { if (!cancelled) setError(getTaskBoardErrorMessage(e)) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [scope, companyId, creating, revision])
  const prepare = (): CompanyTaskDefaultsInput | undefined => {
    if (!configure) return undefined
    if (busy || error) throw new Error('기본 업무 설정을 먼저 불러와 주세요.')
    if (!month || (end && end < month)) throw new Error('업무 적용 시작월·종료월을 확인해 주세요.')
    return { effective_month: month, end_month: end || null, enabled, template_ids: ids, expected_version_id: history?.latest_version_id ?? null }
  }
  useImperativeHandle(ref, () => ({ prepare }))
  return <section className="my-6 border-t border-slate-200 pt-5">
    <h3 className="text-sm font-semibold">원천세 기본 업무</h3>
    <p className="mt-1 text-xs text-slate-500">적용월부터 새로 생성되는 업무의 기준입니다. 기존 월별 선택·완료·파일은 변경하지 않습니다. 기장 거래처는 유효한 계약기간도 적용됩니다.</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error} <button type="button" className="underline" onClick={() => setRevision(x => x + 1)}>다시 불러오기</button></p>}
    <fieldset disabled={!editable || busy || !!error} className="mt-3 space-y-3 disabled:opacity-60">
      {!history?.configured && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={configure} onChange={e => setConfigure(e.target.checked)} />기본 업무 설정하기 <span className="text-xs text-slate-500">현재 미설정</span></label>}
      {configure && <>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label>적용 시작월 <input aria-label="기본 업무 적용 시작월" type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded border p-1" /></label>
          <label>종료월(선택) <input aria-label="기본 업무 종료월" type="month" value={end} onChange={e => setEnd(e.target.value)} className="rounded border p-1" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />원천세 업무 관리 대상</label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">{templates.map(t => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={ids.includes(t.id)} onChange={e => setIds(prev => e.target.checked ? [...prev,t.id] : prev.filter(id => id !== t.id))} />{t.task_name}</label>)}</div>
        {!templates.length && <p className="text-xs text-amber-700">등록된 기준업무가 없습니다. 원천세 업무의 기준업무 관리에서 먼저 항목을 등록해 주세요.</p>}
        {!creating && <button type="button" className="rounded bg-sky-600 px-3 py-2 text-xs text-white" onClick={async () => {
          try { const payload=prepare();if (!payload) return;setBusy(true);const result=await saveCompanyTaskDefaults(scope,companyId,payload);setHistory(result);toast.success('기본 업무를 저장했습니다. 기존 월별 데이터는 유지됩니다.') }
          catch(e) { toast.error(getTaskBoardErrorMessage(e)) } finally { setBusy(false) }
        }}>기본 업무 저장</button>}
      </>}
    </fieldset>
    {!!history?.versions.length && <details className="mt-3 text-xs text-slate-500"><summary>기본 설정 이력 · {history.versions.length}건</summary><ul className="mt-2 space-y-1">{history.versions.map(v => <li key={v.id}>{v.effective_month}부터 {v.end_month ? `${v.end_month}까지` : ''} · {v.enabled ? '관리 대상' : '관리 제외'} · {v.template_ids.map(id => templates.find(t => t.id === id)?.task_name ?? `업무 #${id}`).join(', ') || '선택 업무 없음'} · 버전 {v.id}</li>)}</ul></details>}
  </section>
})
