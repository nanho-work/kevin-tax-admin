'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import FileDropzone from '@/components/common/FileDropzone'
import UiButton from '@/components/common/UiButton'
import UiSearchInput from '@/components/common/UiSearchInput'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { fetchApprovalDocumentSourceData } from '@/services/admin/approvalDocumentSourceService'
import { uiInputClass } from '@/styles/uiClasses'
import {
  createApprovalDocument,
  getApprovalDocumentErrorMessage,
  uploadApprovalDocumentAttachment,
} from '@/services/admin/approvalDocumentService'
import type { ApprovalDocumentType } from '@/types/approvalDocument'
import type { AdminOut } from '@/types/admin'
import type { ClientAccountOut } from '@/types/clientAccount'
import type { TeamOut } from '@/types/team'

const inputClass = uiInputClass

const docTypeOptions: Array<{ value: ApprovalDocumentType; label: string }> = [
  { value: 'general', label: '일반 문서' },
  { value: 'report', label: '보고서' },
  { value: 'expense', label: '비용 문서' },
  { value: 'purchase', label: '구매 문서' },
  { value: 'equipment', label: '비품 문서' },
  { value: 'draft', label: '기안 문서' },
  { value: 'leave', label: '휴가 문서' },
]

type ApproverRow = {
  id: number
  approver_title: string
  approver_name: string
  approver_type: 'admin' | 'client'
  approver_id: string
  rank_order: number
}

type ApproverCandidate = {
  key: string
  approver_type: 'admin' | 'client'
  id: number
  name: string
  title: string
  department_name: string
  team_name: string
  rank_order: number
}

type ShareRow = {
  id: number
  share_type: 'cc' | 'viewer'
  target_type: 'admin' | 'team' | 'client_account'
  target_id: string
}

const DEFAULT_HIGH_RANK_ORDER = 9_999

function createEmptyApproverRow(seed = Date.now() + Math.floor(Math.random() * 10000)): ApproverRow {
  return {
    id: seed,
    approver_title: '',
    approver_name: '',
    approver_type: 'client',
    approver_id: '',
    rank_order: DEFAULT_HIGH_RANK_ORDER,
  }
}

function getStaffRankOrder(staff: AdminOut): number {
  if (typeof staff.rank_order === 'number') return staff.rank_order
  if (typeof staff.role?.rank_order === 'number') return staff.role.rank_order
  if (typeof staff.role_level === 'number') return staff.role_level
  return DEFAULT_HIGH_RANK_ORDER
}

function getClientAccountRankOrder(account: ClientAccountOut): number {
  if (typeof account.rank_order === 'number') return account.rank_order
  if (typeof account.role_level === 'number') return account.role_level
  return DEFAULT_HIGH_RANK_ORDER
}

function sortApprovers(rows: ApproverRow[]): ApproverRow[] {
  const copied = [...rows]
  copied.sort((a, b) => {
    const aSelected = Boolean(a.approver_id)
    const bSelected = Boolean(b.approver_id)
    if (!aSelected && bSelected) return -1
    if (aSelected && !bSelected) return 1
    if (aSelected && bSelected && a.rank_order !== b.rank_order) {
      // 높은 권한(작은 rank_order)이 오른쪽으로 가도록 정렬
      return b.rank_order - a.rank_order
    }
    return a.id - b.id
  })
  return copied
}

export default function AdminDocumentCreatePage() {
  const router = useRouter()
  const { session } = useAdminSessionContext()

  const [teams, setTeams] = useState<TeamOut[]>([])
  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [clientAccounts, setClientAccounts] = useState<ClientAccountOut[]>([])
  const [form, setForm] = useState({
    doc_type: 'general' as ApprovalDocumentType,
    title: '',
    content: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [approvers, setApprovers] = useState<ApproverRow[]>([createEmptyApproverRow()])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null)
  const [loadingApproverSources, setLoadingApproverSources] = useState(false)
  const [selectingApproverId, setSelectingApproverId] = useState<number | null>(null)
  const [approverKeyword, setApproverKeyword] = useState('')
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true
    const loadApproverSources = async () => {
      setLoadingApproverSources(true)
      try {
        const sourceData = await fetchApprovalDocumentSourceData()
        if (!mounted) return

        if (sourceData.staffs.length === 0 && session) {
          setStaffs([session as AdminOut])
        } else {
          setStaffs(sourceData.staffs)
        }
        setTeams(sourceData.teams)
        setClientAccounts(sourceData.clientAccounts)
      } catch {
        if (!mounted) return
        if (session) setStaffs([session as AdminOut])
        setTeams([])
        setClientAccounts([])
      } finally {
        if (mounted) setLoadingApproverSources(false)
      }
    }
    void loadApproverSources()
    return () => {
      mounted = false
    }
  }, [session])

  const teamOptionMap = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])
  const staffOptionMap = useMemo(() => {
    return new Map(staffs.map((staff) => [staff.id, `${staff.name} (${staff.login_id || staff.email || staff.id})`]))
  }, [staffs])
  const clientAccountOptionMap = useMemo(() => {
    return new Map(clientAccounts.map((account) => [account.id, `${account.name} (${account.login_id})`]))
  }, [clientAccounts])

  const approverCandidates = useMemo<ApproverCandidate[]>(() => {
    const staffCandidates = staffs.map((staff) => ({
      key: `admin-${staff.id}`,
      approver_type: 'admin' as const,
      id: staff.id,
      name: staff.name,
      title: staff.role?.name || '직원',
      department_name: staff.team?.department?.name || '미지정 부서',
      team_name: staff.team?.name || '미지정 팀',
      rank_order: getStaffRankOrder(staff),
    }))
    const clientCandidates = clientAccounts.map((account) => ({
      key: `client-${account.id}`,
      approver_type: 'client' as const,
      id: account.id,
      name: account.name,
      title: account.role_name || account.role_code || '클라이언트',
      department_name: '클라이언트 계정',
      team_name: '클라이언트',
      rank_order: getClientAccountRankOrder(account),
    }))
    return [...staffCandidates, ...clientCandidates]
  }, [clientAccounts, staffs])

  const filteredCandidates = useMemo(() => {
    const keyword = approverKeyword.trim().toLowerCase()
    if (!keyword) return approverCandidates
    return approverCandidates.filter((candidate) => {
      const values = [
        candidate.name,
        candidate.title,
        candidate.department_name,
        candidate.team_name,
      ]
      return values.some((value) => value.toLowerCase().includes(keyword))
    })
  }, [approverCandidates, approverKeyword])

  const staffCandidateTree = useMemo(() => {
    const byDepartment = new Map<string, Map<string, ApproverCandidate[]>>()
    filteredCandidates
      .filter((candidate) => candidate.approver_type === 'admin')
      .forEach((candidate) => {
        if (!byDepartment.has(candidate.department_name)) {
          byDepartment.set(candidate.department_name, new Map())
        }
        const teamMap = byDepartment.get(candidate.department_name)!
        if (!teamMap.has(candidate.team_name)) {
          teamMap.set(candidate.team_name, [])
        }
        teamMap.get(candidate.team_name)!.push(candidate)
      })

    return Array.from(byDepartment.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([departmentName, teamMap]) => ({
        departmentName,
        teams: Array.from(teamMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, 'ko'))
          .map(([teamName, members]) => ({
            teamName,
            members: [...members].sort((a, b) => {
              if (a.rank_order !== b.rank_order) return a.rank_order - b.rank_order
              return a.name.localeCompare(b.name, 'ko')
            }),
          })),
      }))
  }, [filteredCandidates])

  const filteredClientCandidates = useMemo(() => {
    return filteredCandidates
      .filter((candidate) => candidate.approver_type === 'client')
      .sort((a, b) => {
        if (a.rank_order !== b.rank_order) return a.rank_order - b.rank_order
        return a.name.localeCompare(b.name, 'ko')
      })
  }, [filteredCandidates])

  const addApproverRow = () => {
    const next = createEmptyApproverRow()
    setApprovers((prev) => sortApprovers([next, ...prev]))
    setSelectingApproverId(next.id)
  }

  const removeApproverRow = (id: number) => {
    setApprovers((prev) => {
      const filtered = prev.filter((row) => row.id !== id)
      if (filtered.length === 0) return [createEmptyApproverRow()]
      return sortApprovers(filtered)
    })
    setSelectingApproverId((prev) => (prev === id ? null : prev))
  }

  const applyApproverCandidate = (rowId: number, candidate: ApproverCandidate) => {
    setApprovers((prev) =>
      sortApprovers(
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                approver_type: candidate.approver_type,
                approver_id: String(candidate.id),
                approver_title: candidate.title,
                approver_name: candidate.name,
                rank_order: candidate.rank_order,
              }
            : row
        )
      )
    )
    setSelectingApproverId(null)
    setApproverKeyword('')
  }

  const addShareRow = () => {
    setShares((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 10000),
        share_type: 'cc',
        target_type: 'admin',
        target_id: '',
      },
    ])
  }

  const updateShareRow = (id: number, patch: Partial<ShareRow>) => {
    setShares((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeShareRow = (id: number) => {
    setShares((prev) => prev.filter((row) => row.id !== id))
  }

  const appendAttachmentFiles = (filesToAdd: FileList) => {
    const incoming = Array.from(filesToAdd || [])
    if (incoming.length === 0) return
    setFiles((prev) => {
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
      const merged = [...prev]
      incoming.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (existing.has(key)) return
        existing.add(key)
        merged.push(file)
      })
      return merged
    })
  }

  const handleAttachmentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    appendAttachmentFiles(event.target.files)
    event.target.value = ''
  }

  const buildApproversPayload = () => {
    if (approvers.length === 0) return undefined

    const hasUnselected = approvers.some((row) => !row.approver_id)
    if (hasUnselected) {
      toast.error('결재선의 선택 버튼으로 결재자를 모두 지정해 주세요.')
      return null
    }

    return approvers.map((row, index) =>
      row.approver_type === 'admin'
        ? {
            step_order: index + 1,
            approver_type: 'admin' as const,
            approver_admin_id: Number(row.approver_id),
          }
        : {
            step_order: index + 1,
            approver_type: 'client' as const,
            approver_client_account_id: Number(row.approver_id),
          }
    )
  }

  const buildSharesPayload = () => {
    if (shares.length === 0) return undefined

    const parsed = shares.map((row) => ({
      raw: row,
      targetId: Number(row.target_id),
    }))

    for (const item of parsed) {
      if (!Number.isInteger(item.targetId) || item.targetId <= 0) {
        toast.error('공유 대상 ID는 1 이상의 숫자로 입력해 주세요.')
        return null
      }
    }

    return parsed.map((item) => ({
      share_type: item.raw.share_type,
      target_type: item.raw.target_type,
      target_id: item.targetId,
    }))
  }

  const handleSubmit = async (submit: boolean) => {
    if (!form.title.trim()) {
      toast.error('제목을 입력해 주세요.')
      return
    }

    const approversPayload = buildApproversPayload()
    if (approversPayload === null) return
    const sharesPayload = buildSharesPayload()
    if (sharesPayload === null) return

    try {
      setSubmitting(submit ? 'submit' : 'draft')
      const created = await createApprovalDocument({
        doc_type: form.doc_type,
        title: form.title.trim(),
        content: form.content.trim() || undefined,
        approvers: approversPayload,
        shares: sharesPayload,
        submit,
      })

      if (files.length > 0) {
        for (const file of files) {
          await uploadApprovalDocumentAttachment(created.id, file)
        }
      }

      toast.success(submit ? '결재 문서를 제출했습니다.' : '문서를 임시저장했습니다.')
      router.push('/admin/staff/documents')
    } catch (error) {
      toast.error(getApprovalDocumentErrorMessage(error))
    } finally {
      setSubmitting(null)
    }
  }

  const writerName = session?.name || '-'
  const writerDepartment = session?.team?.department?.name || session?.team?.name || '-'
  const writerDate = useMemo(() => {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
    return `${get('year')}-${get('month')}-${get('day')}`
  }, [])

  const companyName = session?.client?.company_name || '-'
  const clientName = session?.name || '-'

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-neutral-900">문서작성</h1>
        <p className="mt-1 text-sm text-neutral-500">결재 문서를 작성하고 첨부를 올린 뒤 임시저장 또는 제출할 수 있습니다.</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">결재선 설정</p>
            <p className="mt-1 text-xs text-zinc-500">회사 &gt; 클라이언트 &gt; 부서 &gt; 팀 &gt; 이름 리스트에서 선택합니다.</p>
          </div>
          <button
            type="button"
            onClick={addApproverRow}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            결재선 추가
          </button>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_minmax(0,1fr)_auto]">
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-sm font-semibold text-zinc-900">기안 정보</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <dt className="w-16 text-zinc-500">작성자</dt>
                  <dd className="text-zinc-900">{writerName}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-16 text-zinc-500">소속부서</dt>
                  <dd className="text-zinc-900">{writerDepartment}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-16 text-zinc-500">작성일</dt>
                  <dd className="text-zinc-900">{writerDate}</dd>
                </div>
              </dl>
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white md:justify-self-end">
              <table className="w-auto table-fixed border-collapse text-center">
                <tbody>
                  <tr>
                    <th
                      rowSpan={2}
                      className="w-10 border-r border-zinc-200 bg-zinc-50 p-0 text-[11px] font-semibold text-zinc-700 align-middle"
                    >
                      <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', lineHeight: 1.1 }}>결 재</span>
                    </th>
                    {approvers.map((row) => (
                      <td key={`title-${row.id}`} className="min-w-24 border-b border-zinc-200 p-0">
                        <div className="flex h-8 items-center justify-center px-1.5">
                          <span className="text-sm font-medium text-zinc-900">{row.approver_title}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {approvers.map((row) => (
                      <td key={`name-${row.id}`} className="min-w-24 p-0 align-middle text-sm text-zinc-400">
                        <div className="flex h-12 items-center justify-center px-1.5">
                          {row.approver_id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectingApproverId(row.id)
                                setApproverKeyword('')
                              }}
                              className="text-sm text-zinc-400 hover:text-zinc-600"
                            >
                              {row.approver_name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectingApproverId(row.id)
                                setApproverKeyword('')
                              }}
                              aria-label="결재자 선택"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-base leading-none text-zinc-500 hover:bg-zinc-100"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {approvers.map((row) => (
              <div key={`chip-${row.id}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700">
                <span>{row.approver_title}</span>
                <span className="text-zinc-400">/</span>
                <span>{row.approver_name}</span>
                <button
                  type="button"
                  onClick={() => removeApproverRow(row.id)}
                  className="ml-1 text-zinc-500 hover:text-zinc-800"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {selectingApproverId !== null ? (
            <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900">결재자 선택</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    회사: {companyName} · 클라이언트: {clientName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectingApproverId(null)}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  닫기
                </button>
              </div>

              <div className="mt-3">
                <UiSearchInput
                  value={approverKeyword}
                  onChange={setApproverKeyword}
                  placeholder="이름/직급/부서/팀 검색"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-medium text-zinc-700">직원 조직 리스트</p>
                  {loadingApproverSources ? (
                    <p className="text-sm text-zinc-500">불러오는 중...</p>
                  ) : staffCandidateTree.length === 0 ? (
                    <p className="text-sm text-zinc-500">표시할 직원 목록이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {staffCandidateTree.map((department) => (
                        <div key={department.departmentName} className="rounded-md border border-zinc-200 bg-white p-2">
                          <p className="text-sm font-semibold text-zinc-900">{department.departmentName}</p>
                          <div className="mt-2 space-y-2">
                            {department.teams.map((team) => (
                              <div key={`${department.departmentName}-${team.teamName}`} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-xs font-medium text-zinc-700">{team.teamName}</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {team.members.map((candidate) => (
                                    <button
                                      key={candidate.key}
                                      type="button"
                                      onClick={() => applyApproverCandidate(selectingApproverId, candidate)}
                                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100"
                                    >
                                      {candidate.name} · {candidate.title}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-medium text-zinc-700">클라이언트 계정</p>
                  {filteredClientCandidates.length === 0 ? (
                    <p className="text-sm text-zinc-500">표시할 계정이 없습니다.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {filteredClientCandidates.map((candidate) => (
                        <button
                          key={candidate.key}
                          type="button"
                          onClick={() => applyApproverCandidate(selectingApproverId, candidate)}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100"
                        >
                          {candidate.name} · {candidate.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">참조/열람 공유</p>
              <p className="mt-1 text-xs text-zinc-500">CC 또는 열람 전용 대상을 추가합니다.</p>
            </div>
            <button
              type="button"
              onClick={addShareRow}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              공유 대상 추가
            </button>
          </div>

          {shares.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-3 text-xs text-zinc-500">
              등록된 공유 대상이 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {shares.map((row) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[120px_140px_minmax(0,1fr)_88px]">
                  <select
                    className={inputClass}
                    value={row.share_type}
                    onChange={(e) => updateShareRow(row.id, { share_type: e.target.value as 'cc' | 'viewer' })}
                  >
                    <option value="cc">참조(CC)</option>
                    <option value="viewer">열람자</option>
                  </select>
                  <select
                    className={inputClass}
                    value={row.target_type}
                    onChange={(e) => updateShareRow(row.id, { target_type: e.target.value as 'admin' | 'team' | 'client_account' })}
                  >
                    <option value="admin">직원</option>
                    <option value="team">팀</option>
                    <option value="client_account">클라이언트 계정</option>
                  </select>
                  {row.target_type === 'admin' && staffOptionMap.size > 0 ? (
                    <select
                      className={inputClass}
                      value={row.target_id}
                      onChange={(e) => updateShareRow(row.id, { target_id: e.target.value })}
                    >
                      <option value="">직원 선택</option>
                      {Array.from(staffOptionMap.entries()).map(([id, label]) => (
                        <option key={id} value={String(id)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : row.target_type === 'team' && teamOptionMap.size > 0 ? (
                    <select
                      className={inputClass}
                      value={row.target_id}
                      onChange={(e) => updateShareRow(row.id, { target_id: e.target.value })}
                    >
                      <option value="">팀 선택</option>
                      {Array.from(teamOptionMap.entries()).map(([id, label]) => (
                        <option key={id} value={String(id)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : row.target_type === 'client_account' && clientAccountOptionMap.size > 0 ? (
                    <select
                      className={inputClass}
                      value={row.target_id}
                      onChange={(e) => updateShareRow(row.id, { target_id: e.target.value })}
                    >
                      <option value="">클라이언트 계정 선택</option>
                      {Array.from(clientAccountOptionMap.entries()).map(([id, label]) => (
                        <option key={id} value={String(id)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={row.target_id}
                      onChange={(e) => updateShareRow(row.id, { target_id: e.target.value })}
                      placeholder={
                        row.target_type === 'admin'
                          ? '직원 ID 입력'
                          : row.target_type === 'team'
                          ? '팀 ID 입력'
                          : '클라이언트 계정 ID 입력'
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeShareRow(row.id)}
                    className="h-10 rounded-md border border-zinc-300 px-3 text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-600">문서 종류</label>
            <select
              className={inputClass}
              value={form.doc_type}
              onChange={(e) => setForm((prev) => ({ ...prev, doc_type: e.target.value as ApprovalDocumentType }))}
            >
              {docTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-600">제목</label>
            <input
              type="text"
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="문서 제목을 입력해 주세요."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-600">본문</label>
          <RichTextEditor value={form.content} onChange={(value) => setForm((prev) => ({ ...prev, content: value }))} preset="document" />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-zinc-600">첨부파일</label>
          <input ref={attachmentInputRef} type="file" multiple onChange={handleAttachmentFileChange} className="hidden" />
          <div className="flex flex-wrap items-stretch gap-2">
            <FileDropzone
              onFilesDrop={appendAttachmentFiles}
              className="flex min-h-10 min-w-[220px] flex-1 items-center rounded-md border border-dashed px-3 text-xs transition"
              idleClassName="border-zinc-300 bg-white text-zinc-500"
              activeClassName="border-zinc-500 bg-zinc-50 text-zinc-800"
            >
              파일 드래그
            </FileDropzone>
            <UiButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => attachmentInputRef.current?.click()}
            >
              파일 선택
            </UiButton>
          </div>
          {files.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((file) => (
                <span key={`${file.name}-${file.size}`} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <UiButton
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting !== null}
            variant="secondary"
            size="md"
          >
            {submitting === 'draft' ? '저장 중...' : '임시저장'}
          </UiButton>
          <UiButton
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting !== null}
            variant="primary"
            size="md"
          >
            {submitting === 'submit' ? '제출 중...' : '제출'}
          </UiButton>
        </div>
      </div>
    </section>
  )
}
