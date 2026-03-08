'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { getRoles } from '@/services/client/roleService'
import { getTeams } from '@/services/client/teamService'
import {
  approveClientStaffSignupRequest,
  fetchClientStaffSignupRequests,
  getClientStaffSignupRequestErrorMessage,
  rejectClientStaffSignupRequest,
} from '@/services/client/clientStaffSignupRequestService'
import type { RoleOut } from '@/types/role'
import type { TeamOut } from '@/types/team'
import type { StaffSignupRequest, StaffSignupRequestStatus } from '@/types/staffSignupRequest'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function statusBadge(status: StaffSignupRequestStatus) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700'
  if (status === 'rejected') return 'bg-rose-100 text-rose-700'
  if (status === 'canceled') return 'bg-zinc-200 text-zinc-700'
  return 'bg-amber-100 text-amber-700'
}

function statusLabel(status: StaffSignupRequestStatus) {
  if (status === 'approved') return '승인'
  if (status === 'rejected') return '반려'
  if (status === 'canceled') return '취소'
  return '대기'
}

export default function ClientStaffSignupRequestsSection() {
  const [items, setItems] = useState<StaffSignupRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StaffSignupRequestStatus | ''>('pending')
  const [selected, setSelected] = useState<StaffSignupRequest | null>(null)
  const [teams, setTeams] = useState<TeamOut[]>([])
  const [roles, setRoles] = useState<RoleOut[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('')
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>('')
  const [decisionReason, setDecisionReason] = useState('')

  const loadRequests = async (nextStatus = statusFilter) => {
    try {
      setLoading(true)
      const res = await fetchClientStaffSignupRequests(nextStatus)
      setItems(res.items || [])
    } catch (error) {
      toast.error(getClientStaffSignupRequestErrorMessage(error))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async () => {
    try {
      const [teamList, roleList] = await Promise.all([getTeams(), getRoles()])
      setTeams(teamList)
      setRoles(roleList)
    } catch {
      setTeams([])
      setRoles([])
    }
  }

  useEffect(() => {
    void loadRequests(statusFilter)
  }, [statusFilter])

  useEffect(() => {
    void loadOptions()
  }, [])

  useEffect(() => {
    if (!selected) {
      setSelectedTeamId('')
      setSelectedRoleId('')
      setDecisionReason('')
      return
    }
    setSelectedTeamId(typeof selected.team_id === 'number' ? selected.team_id : '')
    setSelectedRoleId(typeof selected.role_id === 'number' ? selected.role_id : '')
    setDecisionReason(selected.decision_reason || '')
  }, [selected])

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items])

  const handleApprove = async () => {
    if (!selected || selected.status !== 'pending') return
    try {
      setSubmitting(true)
      await approveClientStaffSignupRequest(selected.id, {
        decision_reason: decisionReason.trim() || undefined,
        team_id: selectedTeamId === '' ? undefined : selectedTeamId,
        role_id: selectedRoleId === '' ? undefined : selectedRoleId,
      })
      toast.success('직원 가입 신청을 승인했습니다.')
      await loadRequests(statusFilter)
      setSelected(null)
    } catch (error) {
      toast.error(getClientStaffSignupRequestErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selected || selected.status !== 'pending') return
    if (!decisionReason.trim()) {
      toast.error('반려 사유를 입력해 주세요.')
      return
    }
    try {
      setSubmitting(true)
      await rejectClientStaffSignupRequest(selected.id, {
        decision_reason: decisionReason.trim(),
      })
      toast.success('직원 가입 신청을 반려했습니다.')
      await loadRequests(statusFilter)
      setSelected(null)
    } catch (error) {
      toast.error(getClientStaffSignupRequestErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">신청 건수</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">대기 건수</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">현재 필터</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{statusFilter ? statusLabel(statusFilter) : '전체'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <select
            className={`${inputClass} max-w-[220px]`}
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value as StaffSignupRequestStatus | '') || '')}
          >
            <option value="">전체 상태</option>
            <option value="pending">대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="canceled">취소</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-3 text-left">이름</th>
              <th className="px-3 py-3 text-left">이메일</th>
              <th className="px-3 py-3 text-left">연락처</th>
              <th className="px-3 py-3 text-center">입사일</th>
              <th className="px-3 py-3 text-center">초기잔여연차</th>
              <th className="px-3 py-3 text-center">신청일</th>
              <th className="px-3 py-3 text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">가입 신청 내역이 없습니다.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={selected?.id === item.id ? 'bg-blue-50/40' : undefined}>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{item.email}</td>
                  <td className="px-3 py-3 text-zinc-700">{item.phone || '-'}</td>
                  <td className="px-3 py-3 text-center text-zinc-700">{formatDate(item.hired_at)}</td>
                  <td className="px-3 py-3 text-center text-zinc-700">
                    {typeof item.initial_remaining_days === 'number' ? item.initial_remaining_days : '-'}
                  </td>
                  <td className="px-3 py-3 text-center text-zinc-700">{formatDateTime(item.created_at)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadge(item.status)}`}>{statusLabel(item.status)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <div>
                <p className="text-base font-semibold text-zinc-900">가입 신청 상세</p>
                <p className="mt-1 text-xs text-zinc-500">{selected.name} · {selected.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500">이름</p>
                    <p className="mt-1 text-zinc-900">{selected.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">이메일</p>
                    <p className="mt-1 text-zinc-900">{selected.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">연락처</p>
                    <p className="mt-1 text-zinc-900">{selected.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">생년월일</p>
                    <p className="mt-1 text-zinc-900">{formatDate(selected.birth_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">입사일</p>
                    <p className="mt-1 text-zinc-900">{formatDate(selected.hired_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">초기 잔여 연차</p>
                    <p className="mt-1 text-zinc-900">
                      {typeof selected.initial_remaining_days === 'number' ? selected.initial_remaining_days : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">개인정보 동의</p>
                    <p className="mt-1 text-zinc-900">{selected.privacy_agreed ? '동의' : '미동의'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium text-zinc-900">승인 정보</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">배정 팀</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                      className={inputClass}
                      disabled={selected.status !== 'pending' || submitting}
                    >
                      <option value="">선택 안함</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">배정 직급</label>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : '')}
                      className={inputClass}
                      disabled={selected.status !== 'pending' || submitting}
                    >
                      <option value="">선택 안함</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-600">
                      {selected.status === 'pending' ? '처리 사유(선택)' : '처리 사유'}
                    </label>
                    <textarea
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                      disabled={selected.status !== 'pending' || submitting}
                      placeholder={selected.status === 'pending' ? '승인/반려 사유를 입력하세요.' : '-'}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
              {selected.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={submitting}
                    className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  >
                    반려
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={submitting}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    승인
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
