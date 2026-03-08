'use client'

import { AdminOut } from '@/types/admin'
import { useEffect, useState } from 'react'
import { patchClientStaffTeam, updateClientStaff } from '@/services/client/clientStaffService'
import {
  deleteClientStaffPersonalDocument,
  fetchClientStaffPersonalDocumentDownloadUrl,
  fetchClientStaffPersonalDocumentPreviewUrl,
  fetchClientStaffPersonalDocumentStatus,
  fetchClientStaffPersonalDocuments,
  getClientStaffPersonalDocumentErrorMessage,
} from '@/services/client/clientStaffPersonalDocumentService'
import {
  fetchClientStaffSensitiveProfile,
  fetchClientStaffSensitiveProfileLogs,
  getClientStaffSensitiveProfileErrorMessage,
  revealClientStaffSensitiveProfile,
  upsertClientStaffSensitiveProfile,
} from '@/services/client/clientStaffSensitiveProfileService'
import { getRoles } from '@/services/client/roleService'
import { getDepartments } from '@/services/client/departmentService'
import { getTeams } from '@/services/client/teamService'
import type { UpdateStaffRequest } from '@/types/admin'
import type {
  AdminSensitiveAccessLog,
  AdminSensitiveProfile,
  AdminSensitiveRevealResponse,
} from '@/types/adminSensitiveProfile'
import type {
  PersonalDocument,
  PersonalDocumentDocType,
  PersonalDocumentStatusItem,
} from '@/types/personalDocument'
import type { RoleOut } from '@/types/role'
import type { DepartmentOut } from '@/types/department'
import type { TeamOut } from '@/types/team'

type StaffRole = NonNullable<UpdateStaffRequest['role_id']>

interface Props {
  staff: AdminOut
  onClose: () => void
  onSaved?: () => void | Promise<void>
}

function getErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim().length > 0) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first?.msg === 'string') return first.msg
  }
  return fallback
}

function isNotFoundError(error: any) {
  return error?.response?.status === 404
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function getSensitiveActionLabel(action: string) {
  if (action === 'reveal') return '평문조회'
  if (action === 'update') return '수정'
  if (action === 'view') return '조회'
  if (action === 'download') return '다운로드'
  return action
}

function getPersonalDocTypeLabel(code: string) {
  if (code === 'id_card') return '신분증'
  if (code === 'bank_account') return '통장사본'
  return code
}

type SensitiveFormState = {
  resident_number: string
  bank_name: string
  account_holder: string
  account_number: string
  zip_code: string
  address1: string
  address2: string
  emergency_contact_name: string
  emergency_contact_phone: string
  reason: string
}

export default function StaffDetailModal({ staff, onClose, onSaved }: Props) {
  const inputClass =
    'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roles, setRoles] = useState<RoleOut[]>([])
  const [departments, setDepartments] = useState<DepartmentOut[]>([])
  const [teams, setTeams] = useState<TeamOut[]>([])
  const [sensitiveProfile, setSensitiveProfile] = useState<AdminSensitiveProfile | null>(null)
  const [sensitiveLogs, setSensitiveLogs] = useState<AdminSensitiveAccessLog[]>([])
  const [sensitiveLoading, setSensitiveLoading] = useState(false)
  const [sensitiveSaving, setSensitiveSaving] = useState(false)
  const [sensitiveError, setSensitiveError] = useState('')
  const [sensitiveMessage, setSensitiveMessage] = useState('')
  const [showRevealForm, setShowRevealForm] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)
  const [revealAccountPassword, setRevealAccountPassword] = useState('')
  const [revealReason, setRevealReason] = useState('')
  const [includeResidentNumber, setIncludeResidentNumber] = useState(true)
  const [includeAccountNumber, setIncludeAccountNumber] = useState(false)
  const [revealResult, setRevealResult] = useState<AdminSensitiveRevealResponse | null>(null)
  const [personalDocuments, setPersonalDocuments] = useState<PersonalDocument[]>([])
  const [personalDocStatuses, setPersonalDocStatuses] = useState<PersonalDocumentStatusItem[]>([])
  const [personalDocLoading, setPersonalDocLoading] = useState(false)
  const [personalDocError, setPersonalDocError] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null)
  const [previewingDocumentId, setPreviewingDocumentId] = useState<number | null>(null)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null)
  const [sensitiveForm, setSensitiveForm] = useState<SensitiveFormState>({
    resident_number: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    zip_code: '',
    address1: '',
    address2: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    reason: '',
  })

  const [form, setForm] = useState({
    name: staff.name || '',
    phone: staff.phone || '',
    profile_image: null as File | null,
    profile_image_url: staff.profile_image_url || '',
    hired_at: staff.hired_at || '',
    birth_date: staff.birth_date || '',
    retired_at: staff.retired_at || '',
    team_id: staff.team_id ?? staff.team?.id ?? null,
    role_id: staff.role_id || undefined,
  })
  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name || '',
        phone: staff.phone || '',
        profile_image: null,
        profile_image_url: staff.profile_image_url || '',
        hired_at: staff.hired_at || '',
        birth_date: staff.birth_date || '',
        retired_at: staff.retired_at || '',
        team_id: staff.team_id ?? staff.team?.id ?? null,
        role_id: staff.role_id || undefined,
      })
    }
  }, [staff])

  useEffect(() => {
    async function loadOptions() {
      const [roleList, departmentList, teamList] = await Promise.all([
        getRoles(),
        getDepartments(),
        getTeams(),
      ])
      setRoles(roleList)
      setDepartments(departmentList)
      setTeams(teamList)
    }
    loadOptions()
  }, [])

  useEffect(() => {
    async function loadSensitiveProfile() {
      try {
        setSensitiveLoading(true)
        setSensitiveError('')
        setSensitiveMessage('')
        setRevealResult(null)

        const [profileRes, logsRes] = await Promise.allSettled([
          fetchClientStaffSensitiveProfile(staff.id),
          fetchClientStaffSensitiveProfileLogs(staff.id),
        ])

        if (profileRes.status === 'fulfilled') {
          const profile = profileRes.value
          setSensitiveProfile(profile)
          setSensitiveForm((prev) => ({
            ...prev,
            resident_number: '',
            bank_name: profile.bank_name || '',
            account_holder: profile.account_holder || '',
            account_number: '',
            zip_code: profile.zip_code || '',
            address1: profile.address1 || '',
            address2: profile.address2 || '',
            emergency_contact_name: profile.emergency_contact_name || '',
            emergency_contact_phone: profile.emergency_contact_phone || '',
            reason: '',
          }))
        } else if (isNotFoundError(profileRes.reason)) {
          setSensitiveProfile(null)
          setSensitiveForm((prev) => ({
            ...prev,
            resident_number: '',
            bank_name: '',
            account_holder: '',
            account_number: '',
            zip_code: '',
            address1: '',
            address2: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            reason: '',
          }))
        } else {
          setSensitiveError(getClientStaffSensitiveProfileErrorMessage(profileRes.reason))
        }

        if (logsRes.status === 'fulfilled') {
          setSensitiveLogs(logsRes.value.items || [])
        } else if (!isNotFoundError(logsRes.reason)) {
          setSensitiveError(getClientStaffSensitiveProfileErrorMessage(logsRes.reason))
        }
      } catch (error) {
        setSensitiveError(getClientStaffSensitiveProfileErrorMessage(error))
      } finally {
        setSensitiveLoading(false)
      }
    }

    void loadSensitiveProfile()
  }, [staff.id])

  const loadPersonalDocuments = async () => {
    try {
      setPersonalDocLoading(true)
      setPersonalDocError('')

      const [listRes, statusRes] = await Promise.all([
        fetchClientStaffPersonalDocuments(staff.id),
        fetchClientStaffPersonalDocumentStatus(staff.id),
      ])
      setPersonalDocuments(listRes.items || [])
      setPersonalDocStatuses(statusRes.statuses || [])
    } catch (error) {
      setPersonalDocError(getClientStaffPersonalDocumentErrorMessage(error))
      setPersonalDocuments([])
      setPersonalDocStatuses([])
    } finally {
      setPersonalDocLoading(false)
    }
  }

  useEffect(() => {
    void loadPersonalDocuments()
  }, [staff.id])

  const handleSensitiveSave = async () => {
    try {
      setSensitiveSaving(true)
      setSensitiveError('')
      setSensitiveMessage('')

      const payload = {
        bank_name: sensitiveForm.bank_name || '',
        account_holder: sensitiveForm.account_holder || '',
        zip_code: sensitiveForm.zip_code || '',
        address1: sensitiveForm.address1 || '',
        address2: sensitiveForm.address2 || '',
        emergency_contact_name: sensitiveForm.emergency_contact_name || '',
        emergency_contact_phone: sensitiveForm.emergency_contact_phone || '',
        reason: sensitiveForm.reason.trim() || undefined,
        ...(sensitiveForm.resident_number.trim() ? { resident_number: sensitiveForm.resident_number.trim() } : {}),
        ...(sensitiveForm.account_number.trim() ? { account_number: sensitiveForm.account_number.trim() } : {}),
      }

      const profile = await upsertClientStaffSensitiveProfile(staff.id, payload)
      setSensitiveProfile(profile)
      setSensitiveMessage('민감정보가 저장되었습니다.')
      setSensitiveForm((prev) => ({
        ...prev,
        resident_number: '',
        account_number: '',
        reason: '',
      }))

      const logsRes = await fetchClientStaffSensitiveProfileLogs(staff.id)
      setSensitiveLogs(logsRes.items || [])
    } catch (error) {
      setSensitiveError(getClientStaffSensitiveProfileErrorMessage(error))
    } finally {
      setSensitiveSaving(false)
    }
  }

  const handleReveal = async () => {
    if (!revealAccountPassword.trim()) {
      setSensitiveError('평문 조회를 위해 계정 비밀번호를 입력해 주세요.')
      return
    }
    if (!includeResidentNumber && !includeAccountNumber) {
      setSensitiveError('조회할 항목을 하나 이상 선택해 주세요.')
      return
    }

    try {
      setRevealLoading(true)
      setSensitiveError('')
      setSensitiveMessage('')
      const result = await revealClientStaffSensitiveProfile(staff.id, {
        account_password: revealAccountPassword,
        reason: revealReason.trim() || undefined,
        include_resident_number: includeResidentNumber,
        include_account_number: includeAccountNumber,
      })
      setRevealResult(result)
      setRevealAccountPassword('')
      setRevealReason('')

      const logsRes = await fetchClientStaffSensitiveProfileLogs(staff.id)
      setSensitiveLogs(logsRes.items || [])
    } catch (error) {
      setSensitiveError(getClientStaffSensitiveProfileErrorMessage(error))
    } finally {
      setRevealLoading(false)
    }
  }

  const handlePreviewPersonalDocument = async (documentId: number) => {
    try {
      setPreviewingDocumentId(documentId)
      const response = await fetchClientStaffPersonalDocumentPreviewUrl(staff.id, documentId)
      window.open(response.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setPersonalDocError(getClientStaffPersonalDocumentErrorMessage(error))
    } finally {
      setPreviewingDocumentId(null)
    }
  }

  const handleDownloadPersonalDocument = async (documentId: number) => {
    try {
      setDownloadingDocumentId(documentId)
      const response = await fetchClientStaffPersonalDocumentDownloadUrl(staff.id, documentId)
      window.open(response.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setPersonalDocError(getClientStaffPersonalDocumentErrorMessage(error))
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  const handleDeletePersonalDocument = async (documentId: number) => {
    try {
      setDeletingDocumentId(documentId)
      setPersonalDocError('')
      await deleteClientStaffPersonalDocument(staff.id, documentId)
      await loadPersonalDocuments()
    } catch (error) {
      setPersonalDocError(getClientStaffPersonalDocumentErrorMessage(error))
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const prevTeamId = staff.team_id ?? staff.team?.id ?? null
      const nextTeamId = form.team_id ?? null
      const teamChanged = prevTeamId !== nextTeamId

      const nameChanged = form.name !== (staff.name || '')
      const phoneChanged = form.phone !== (staff.phone || '')
      const roleChanged = (form.role_id ?? null) !== (staff.role_id ?? null)
      const hiredAtChanged = form.hired_at !== (staff.hired_at || '')
      const birthDateChanged = form.birth_date !== (staff.birth_date || '')
      const retiredAtChanged = form.retired_at !== (staff.retired_at || '')

      const formData = new FormData()
      let hasGeneralChanges = false
      if (nameChanged && form.name) {
        formData.append('name', form.name)
        hasGeneralChanges = true
      }
      if (phoneChanged && form.phone) {
        formData.append('phone', form.phone)
        hasGeneralChanges = true
      }
      if (roleChanged && form.role_id !== undefined) {
        formData.append('role_id', String(form.role_id))
        hasGeneralChanges = true
      }
      if (hiredAtChanged && form.hired_at) {
        formData.append('hired_at', form.hired_at)
        hasGeneralChanges = true
      }
      if (birthDateChanged && form.birth_date) {
        formData.append('birth_date', form.birth_date)
        hasGeneralChanges = true
      }
      if (retiredAtChanged && form.retired_at) {
        formData.append('retired_at', form.retired_at)
        hasGeneralChanges = true
      }
      if (form.profile_image) {
        formData.append('file', form.profile_image)
        hasGeneralChanges = true
      }

      if (!hasGeneralChanges && !teamChanged) {
        setSuccess('변경된 내용이 없습니다.')
        setError('')
        return
      }

      if (hasGeneralChanges) {
        await updateClientStaff(staff.id, formData)
      }

      if (teamChanged) {
        await patchClientStaffTeam(staff.id, nextTeamId)
      }

      setSuccess('정보가 저장되었습니다.')
      setError('')
      await onSaved?.()

      if (form.profile_image) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setForm((prev) => ({
            ...prev,
            profile_image_url: reader.result as string,
            profile_image: null,
          }))
        }
        reader.readAsDataURL(form.profile_image)
      }
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, '저장 실패'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-200 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <img
              src={form.profile_image_url || '/default-profile.png'}
              alt="사용자 이미지"
              className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
            />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{staff.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {staff.role?.name || '직급 미지정'}
                {staff.email ? ` · ${staff.email}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          {loading ? <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">처리 중입니다...</div> : null}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">이메일</label>
                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">{staff.email || '-'}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">연락처</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">직급</label>
                {staff.role_id === 1 || staff.role_id === 2 ? (
                  <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">{staff.role?.name || '-'}</div>
                ) : (
                  <select
                    value={form.role_id ?? ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, role_id: Number(e.target.value) as StaffRole }))}
                    className={inputClass}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">팀</label>
                <select
                  value={form.team_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      team_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">선택 안함</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.department?.name ? `(${t.department.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">부서</label>
                <select
                  value={teams.find((t) => t.id === form.team_id)?.department?.id ?? ''}
                  disabled
                  className={`${inputClass} cursor-not-allowed bg-zinc-100 text-zinc-500`}
                >
                  <option value="">(자동 선택)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">입사일</label>
                <input
                  type="date"
                  value={form.hired_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, hired_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">생일</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">퇴사일</label>
                <input
                  type="date"
                  value={form.retired_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, retired_at: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600">프로필 이미지 변경</label>
                <div className="flex items-end gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        profile_image: e.target.files?.[0] || null,
                      }))
                    }
                    className={inputClass}
                  />
                  {form.profile_image ? (
                    <img
                      src={URL.createObjectURL(form.profile_image)}
                      alt="프로필 미리보기"
                      className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">민감정보</p>
                <p className="mt-1 text-xs text-zinc-500">주민번호/계좌번호는 암호화 저장되며 기본 조회는 마스킹값만 표시됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRevealForm((prev) => !prev)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                {showRevealForm ? '평문조회 닫기' : '평문조회'}
              </button>
            </div>

            {sensitiveError ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sensitiveError}</div>
            ) : null}
            {sensitiveMessage ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{sensitiveMessage}</div>
            ) : null}
            {sensitiveLoading ? (
              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">민감정보를 불러오는 중입니다...</div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">주민번호(마스킹)</label>
                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
                  {sensitiveProfile?.resident_number_masked || '-'}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">계좌번호(마스킹)</label>
                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800">
                  {sensitiveProfile?.account_number_masked || '-'}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">주민번호 변경 입력</label>
                <input
                  type="text"
                  value={sensitiveForm.resident_number}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, resident_number: e.target.value }))}
                  placeholder="변경 시에만 입력"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">계좌번호 변경 입력</label>
                <input
                  type="text"
                  value={sensitiveForm.account_number}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_number: e.target.value }))}
                  placeholder="변경 시에만 입력"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">은행명</label>
                <input
                  type="text"
                  value={sensitiveForm.bank_name}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">예금주</label>
                <input
                  type="text"
                  value={sensitiveForm.account_holder}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_holder: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">우편번호</label>
                <input
                  type="text"
                  value={sensitiveForm.zip_code}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, zip_code: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">기본주소</label>
                <input
                  type="text"
                  value={sensitiveForm.address1}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address1: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">상세주소</label>
                <input
                  type="text"
                  value={sensitiveForm.address2}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address2: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">비상연락처 이름</label>
                <input
                  type="text"
                  value={sensitiveForm.emergency_contact_name}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">비상연락처 전화</label>
                <input
                  type="text"
                  value={sensitiveForm.emergency_contact_phone}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600">수정 사유(선택)</label>
                <textarea
                  value={sensitiveForm.reason}
                  onChange={(e) => setSensitiveForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSensitiveSave}
                disabled={sensitiveSaving}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sensitiveSaving ? '저장 중...' : '민감정보 저장'}
              </button>
            </div>

            {showRevealForm ? (
              <div className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
                <p className="text-sm font-medium text-zinc-900">평문 조회(비밀번호 재확인)</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <input
                    type="password"
                    placeholder="클라이언트 계정 비밀번호"
                    value={revealAccountPassword}
                    onChange={(e) => setRevealAccountPassword(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="조회 사유(선택)"
                    value={revealReason}
                    onChange={(e) => setRevealReason(e.target.value)}
                    className={inputClass}
                  />
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={includeResidentNumber}
                      onChange={(e) => setIncludeResidentNumber(e.target.checked)}
                    />
                    주민번호 조회
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={includeAccountNumber}
                      onChange={(e) => setIncludeAccountNumber(e.target.checked)}
                    />
                    계좌번호 조회
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleReveal}
                    disabled={revealLoading}
                    className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {revealLoading ? '조회 중...' : '평문 조회'}
                  </button>
                </div>

                {revealResult ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p>주민번호: {revealResult.resident_number || '-'}</p>
                    <p className="mt-1">계좌번호: {revealResult.account_number || '-'}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-md border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600">접근 로그</div>
              <div className="max-h-48 overflow-y-auto">
                {sensitiveLogs.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-zinc-500">로그가 없습니다.</div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {sensitiveLogs.map((log) => (
                      <li key={log.id} className="px-3 py-2 text-xs text-zinc-700">
                        <p className="font-medium text-zinc-900">{getSensitiveActionLabel(log.action)}</p>
                        <p className="mt-0.5">{formatDateTime(log.created_at)}</p>
                        <p className="mt-0.5 text-zinc-500">{log.reason || '-'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">개인문서</p>
                <p className="mt-1 text-xs text-zinc-500">신분증/통장사본 등록 여부를 확인하고 미리보기, 다운로드, 삭제할 수 있습니다.</p>
              </div>
            </div>

            {personalDocError ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{personalDocError}</div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['id_card', 'bank_account'] as PersonalDocumentDocType[]).map((docType) => {
                const status = personalDocStatuses.find((item) => item.doc_type_code === docType)
                const isRegistered = Boolean(status?.is_registered)
                return (
                  <div key={docType} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-zinc-900">{getPersonalDocTypeLabel(docType)}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      상태: {isRegistered ? '등록됨' : '미등록'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">최종 업로드: {formatDateTime(status?.latest_uploaded_at)}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">문서종류</th>
                    <th className="px-3 py-2 text-left">파일명</th>
                    <th className="px-3 py-2 text-center">업로드일</th>
                    <th className="px-3 py-2 text-center">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {personalDocLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">조회 중...</td>
                    </tr>
                  ) : personalDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">등록된 문서가 없습니다.</td>
                    </tr>
                  ) : (
                    personalDocuments.map((document) => (
                      <tr key={document.id}>
                        <td className="px-3 py-2 text-zinc-700">{getPersonalDocTypeLabel(document.doc_type_code)}</td>
                        <td className="px-3 py-2 text-zinc-700">{document.file_name}</td>
                        <td className="px-3 py-2 text-center text-zinc-700">{formatDateTime(document.uploaded_at)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handlePreviewPersonalDocument(document.id)}
                              disabled={previewingDocumentId === document.id}
                              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              미리보기
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadPersonalDocument(document.id)}
                              disabled={downloadingDocumentId === document.id}
                              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                              다운로드
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePersonalDocument(document.id)}
                              disabled={deletingDocumentId === document.id}
                              className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
