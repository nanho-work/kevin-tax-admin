'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { changeAdminPassword, deleteMyProfileImage, uploadMyProfileImage } from '@/services/admin/adminService'
import {
  fetchMySensitiveConsents,
  fetchMySensitiveConsentTerms,
  fetchMySensitiveProfile,
  getAdminSensitiveProfileErrorMessage,
  revealMySensitiveProfile,
  upsertMySensitiveProfile,
} from '@/services/admin/adminSensitiveProfileService'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
import { emitProfileImageUpdated } from '@/utils/profileImageEvents'
import {
  fetchMyPersonalDocumentPreviewUrl,
  fetchMyPersonalDocumentStatus,
  fetchMyPersonalDocuments,
  getAdminPersonalDocumentErrorMessage,
  uploadMyPersonalDocument,
} from '@/services/admin/adminPersonalDocumentService'
import type {
  PersonalDocument,
  PersonalDocumentDocType,
  PersonalDocumentStatusItem,
} from '@/types/personalDocument'
import type {
  AdminSensitiveConsentRecord,
  AdminSensitiveConsentTerm,
  AdminSensitiveProfile,
} from '@/types/adminSensitiveProfile'

const DOC_TYPES: Array<{ code: PersonalDocumentDocType; label: string }> = [
  { code: 'id_card', label: '신분증' },
  { code: 'bank_account', label: '통장사본' },
]
const RRN_CONSENT_CODE = 'staff.rrn.processing.required'
const PAYROLL_CONSENT_CODE = 'staff.payroll.processing.required'

const inputClass =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500'
const PROFILE_IMAGE_MAX_DIMENSION = 1024
const PROFILE_IMAGE_TARGET_BYTES = 600 * 1024
const SUPPORTED_PROFILE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const SUPPORTED_PROFILE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function isSupportedProfileImage(file: File) {
  const mimeType = file.type.toLowerCase()
  if (mimeType && SUPPORTED_PROFILE_IMAGE_MIME_TYPES.has(mimeType)) return true
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return SUPPORTED_PROFILE_IMAGE_EXTENSIONS.has(extension)
}

async function optimizeProfileImage(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
      img.src = imageUrl
    })

    const { width: originalWidth, height: originalHeight } = image
    const maxSide = Math.max(originalWidth, originalHeight)
    const scale = maxSide > PROFILE_IMAGE_MAX_DIMENSION ? PROFILE_IMAGE_MAX_DIMENSION / maxSide : 1
    const targetWidth = Math.max(1, Math.round(originalWidth * scale))
    const targetHeight = Math.max(1, Math.round(originalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이미지 변환에 실패했습니다.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    let quality = 0.85
    let blob: Blob | null = null
    while (quality >= 0.55) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) break
      if (blob.size <= PROFILE_IMAGE_TARGET_BYTES) break
      quality -= 0.1
    }

    if (!blob) throw new Error('이미지 변환에 실패했습니다.')
    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('이미지 미리보기를 생성할 수 없습니다.'))
    }
    reader.onerror = () => reject(new Error('이미지 미리보기를 생성할 수 없습니다.'))
    reader.readAsDataURL(file)
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR')
}

function docTypeLabel(code: string) {
  if (code === 'id_card') return '신분증'
  if (code === 'bank_account') return '통장사본'
  return code
}

function formatResidentNumberInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 6) return digits
  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

function applyCompanyNameTemplate(content: string, companyName: string) {
  return content
    .replaceAll('${company_name}', companyName)
    .replaceAll('{{company_name}}', companyName)
    .replaceAll('{company_name}', companyName)
    .replaceAll('${컴퍼니네임}', companyName)
    .replaceAll('{{컴퍼니네임}}', companyName)
    .replaceAll('{컴퍼니네임}', companyName)
}

function FieldLabel({ label, registered }: { label: string; registered?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <p className="text-xs text-zinc-500">{label}</p>
      {registered ? (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">등록됨</span>
      ) : null}
    </div>
  )
}

type ProfileTab = 'basic' | 'documents' | 'certificates'

export default function AdminPersonalDocumentPage() {
  const { session, loading: sessionLoading, refresh } = useAdminSessionContext()
  const [statusItems, setStatusItems] = useState<PersonalDocumentStatusItem[]>([])
  const [documents, setDocuments] = useState<PersonalDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingType, setUploadingType] = useState<PersonalDocumentDocType | null>(null)
  const [previewingType, setPreviewingType] = useState<PersonalDocumentDocType | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [isPasswordPanelOpen, setIsPasswordPanelOpen] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState('/default-profile.png')
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)
  const [sensitiveProfile, setSensitiveProfile] = useState<AdminSensitiveProfile | null>(null)
  const [sensitiveLoading, setSensitiveLoading] = useState(false)
  const [hasLoadedSensitive, setHasLoadedSensitive] = useState(false)
  const [sensitiveConsentTerms, setSensitiveConsentTerms] = useState<AdminSensitiveConsentTerm[]>([])
  const [sensitiveConsentRecords, setSensitiveConsentRecords] = useState<AdminSensitiveConsentRecord[]>([])
  const [sensitiveConsentLoading, setSensitiveConsentLoading] = useState(false)
  const [hasLoadedSensitiveConsents, setHasLoadedSensitiveConsents] = useState(false)
  const [sensitiveConsents, setSensitiveConsents] = useState({
    rrn: false,
    payroll: false,
  })
  const [savingSensitive, setSavingSensitive] = useState(false)
  const [revealedSensitive, setRevealedSensitive] = useState<{
    resident_number: string | null
    account_number: string | null
  }>({
    resident_number: null,
    account_number: null,
  })
  const [sensitiveEditMode, setSensitiveEditMode] = useState<{
    resident_number: boolean
    account_number: boolean
  }>({
    resident_number: false,
    account_number: false,
  })
  const [isSensitiveRevealPanelOpen, setIsSensitiveRevealPanelOpen] = useState(false)
  const [sensitiveRevealTarget, setSensitiveRevealTarget] = useState<'resident_number' | 'account_number' | null>(null)
  const [sensitiveRevealPassword, setSensitiveRevealPassword] = useState('')
  const [sensitiveRevealReason, setSensitiveRevealReason] = useState('본인 확인')
  const [showSensitiveRevealPassword, setShowSensitiveRevealPassword] = useState(false)
  const [revealingSensitive, setRevealingSensitive] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('basic')
  const [sensitiveForm, setSensitiveForm] = useState({
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
  const profileImageInputRef = useRef<HTMLInputElement | null>(null)

  const statusByType = useMemo(() => {
    return statusItems.reduce<Record<string, PersonalDocumentStatusItem>>((acc, item) => {
      acc[item.doc_type_code] = item
      return acc
    }, {})
  }, [statusItems])

  const passwordChecks = useMemo(
    () => ({
      minLength: newPassword.length >= 8,
      hasLetter: /[A-Za-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      differentFromCurrent: currentPassword.length > 0 && currentPassword !== newPassword,
    }),
    [currentPassword, newPassword]
  )

  const hasConfirmInput = confirmPassword.length > 0
  const isPasswordMatch = newPassword === confirmPassword
  const canSavePassword =
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber &&
    passwordChecks.differentFromCurrent &&
    hasConfirmInput &&
    isPasswordMatch

  const loadData = async () => {
    try {
      setLoading(true)
      const [statusRes, listRes] = await Promise.all([
        fetchMyPersonalDocumentStatus(),
        fetchMyPersonalDocuments(),
      ])
      setStatusItems(statusRes.statuses || [])
      setDocuments(listRes.items || [])
    } catch (error) {
      toast.error(getAdminPersonalDocumentErrorMessage(error))
      setStatusItems([])
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const loadSensitiveProfile = useCallback(async () => {
    try {
      setSensitiveLoading(true)
      const profile = await fetchMySensitiveProfile()
      setSensitiveProfile(profile)
      setRevealedSensitive({
        resident_number: null,
        account_number: null,
      })
      setSensitiveEditMode({
        resident_number: false,
        account_number: false,
      })
      setSensitiveForm((prev) => ({
        ...prev,
        bank_name: profile.bank_name || '',
        account_holder: profile.account_holder || '',
        zip_code: profile.zip_code || '',
        address1: profile.address1 || '',
        address2: profile.address2 || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
      }))
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        toast.error(getAdminSensitiveProfileErrorMessage(error))
      }
      setSensitiveProfile(null)
    } finally {
      setHasLoadedSensitive(true)
      setSensitiveLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'basic') return
    if (hasLoadedSensitive || sensitiveLoading) return
    void loadSensitiveProfile()
  }, [activeTab, hasLoadedSensitive, sensitiveLoading, loadSensitiveProfile])

  const loadSensitiveConsentTerms = useCallback(async () => {
    try {
      setSensitiveConsentLoading(true)
      const [terms, consentRecords] = await Promise.all([
        fetchMySensitiveConsentTerms(),
        fetchMySensitiveConsents(),
      ])
      setSensitiveConsentTerms(terms)
      setSensitiveConsentRecords(consentRecords)
    } catch {
      setSensitiveConsentTerms([])
      setSensitiveConsentRecords([])
    } finally {
      setHasLoadedSensitiveConsents(true)
      setSensitiveConsentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'basic') return
    if (hasLoadedSensitiveConsents || sensitiveConsentLoading) return
    void loadSensitiveConsentTerms()
  }, [activeTab, hasLoadedSensitiveConsents, loadSensitiveConsentTerms, sensitiveConsentLoading])

  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreviewUrl((session as any)?.profile_image_url || '/default-profile.png')
    }
  }, [profileImageFile, session])

  const handleUploadFile = async (docTypeCode: PersonalDocumentDocType, file: File) => {
    try {
      setUploadingType(docTypeCode)
      await uploadMyPersonalDocument(docTypeCode, file)
      toast.success(`${docTypeLabel(docTypeCode)} 문서를 업로드했습니다.`)
      await loadData()
    } catch (error) {
      toast.error(getAdminPersonalDocumentErrorMessage(error))
    } finally {
      setUploadingType(null)
    }
  }

  const handlePreview = async (docTypeCode: PersonalDocumentDocType) => {
    try {
      setPreviewingType(docTypeCode)
      const response = await fetchMyPersonalDocumentPreviewUrl(docTypeCode)
      window.open(response.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getAdminPersonalDocumentErrorMessage(error))
    } finally {
      setPreviewingType(null)
    }
  }

  const handleChangePassword = async () => {
    const current = currentPassword.trim()
    const next = newPassword.trim()
    const confirm = confirmPassword.trim()

    if (!current || !next || !confirm) {
      toast.error('현재 비밀번호, 새 비밀번호, 비밀번호 확인을 모두 입력해 주세요.')
      return false
    }
    if (current === next) {
      toast.error('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return false
    }
    if (next !== confirm) {
      toast.error('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return false
    }
    if (!passwordChecks.minLength || !passwordChecks.hasLetter || !passwordChecks.hasNumber) {
      toast.error('새 비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다.')
      return false
    }

    try {
      setSavingPassword(true)
      const response = await changeAdminPassword({
        current_password: current,
        new_password: next,
      })
      toast.success(response.message || '비밀번호가 변경되었습니다.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      return true
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail[0]?.msg
            ? detail[0].msg
            : '비밀번호 변경에 실패했습니다.'
      toast.error(message)
      return false
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSaveProfileImage = async () => {
    if (!profileImageFile) {
      toast.error('먼저 이미지를 선택해 주세요.')
      return
    }
    try {
      setIsOptimizingImage(true)
      let uploadFile = profileImageFile
      try {
        uploadFile = await optimizeProfileImage(profileImageFile)
      } catch {
        toast.error('이미지 최적화에 실패해 원본 파일을 사용합니다.')
      }

      await uploadMyProfileImage(uploadFile)
      toast.success('프로필 이미지가 저장되었습니다.')
      setProfileImageFile(null)
      await refresh()
      emitProfileImageUpdated({
        actorType: 'admin',
        actorId: Number((session as any)?.account_id ?? (session as any)?.id ?? 0) || undefined,
      })
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : '프로필 이미지 저장에 실패했습니다.'
      toast.error(message)
    } finally {
      setIsOptimizingImage(false)
    }
  }

  const handleDeleteProfileImage = async () => {
    try {
      const hasImage = Boolean((session as any)?.profile_image_url)
      if (!hasImage && !profileImageFile) {
        toast.error('삭제할 프로필 이미지가 없습니다.')
        return
      }
      await deleteMyProfileImage()
      toast.success('프로필 이미지가 삭제되었습니다.')
      setProfileImageFile(null)
      await refresh()
      emitProfileImageUpdated({
        actorType: 'admin',
        actorId: Number((session as any)?.account_id ?? (session as any)?.id ?? 0) || undefined,
      })
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : '프로필 이미지 삭제에 실패했습니다.'
      toast.error(message)
    }
  }

  const handleCancelProfileImagePreview = () => {
    setProfileImageFile(null)
    setProfileImagePreviewUrl((session as any)?.profile_image_url || '/default-profile.png')
  }

  const handleSaveSensitiveProfile = async () => {
    const residentDigits = sensitiveForm.resident_number.replace(/\D/g, '')
    const hasResidentStored = Boolean(sensitiveProfile?.has_resident_number || sensitiveProfile?.resident_number_masked)
    const residentWillUpdate = !hasResidentStored && residentDigits.length > 0
    if (residentWillUpdate && residentDigits.length !== 13) {
      toast.error('주민번호는 숫자 13자리로 입력해 주세요.')
      return
    }
    if (residentWillUpdate && !canEditResidentField) {
      toast.error('주민번호 처리 동의를 먼저 체크해 주세요.')
      return
    }

    const bankName = sensitiveForm.bank_name.trim()
    const accountHolder = sensitiveForm.account_holder.trim()
    const accountNumber = sensitiveForm.account_number.trim()
    const zipCode = sensitiveForm.zip_code.trim()
    const address1 = sensitiveForm.address1.trim()
    const address2 = sensitiveForm.address2.trim()
    const emergencyContactName = sensitiveForm.emergency_contact_name.trim()
    const emergencyContactPhone = sensitiveForm.emergency_contact_phone.trim()

    const profileBankName = (sensitiveProfile?.bank_name || '').trim()
    const profileAccountHolder = (sensitiveProfile?.account_holder || '').trim()
    const profileZipCode = (sensitiveProfile?.zip_code || '').trim()
    const profileAddress1 = (sensitiveProfile?.address1 || '').trim()
    const profileAddress2 = (sensitiveProfile?.address2 || '').trim()
    const profileEmergencyContactName = (sensitiveProfile?.emergency_contact_name || '').trim()
    const profileEmergencyContactPhone = (sensitiveProfile?.emergency_contact_phone || '').trim()

    const bankNameChanged = bankName !== profileBankName
    const accountHolderChanged = accountHolder !== profileAccountHolder
    const accountWillUpdate = sensitiveEditMode.account_number && accountNumber.length > 0
    const zipCodeChanged = zipCode !== profileZipCode
    const address1Changed = address1 !== profileAddress1
    const address2Changed = address2 !== profileAddress2
    const emergencyContactNameChanged = emergencyContactName !== profileEmergencyContactName
    const emergencyContactPhoneChanged = emergencyContactPhone !== profileEmergencyContactPhone

    const payrollWillUpdate = bankNameChanged || accountHolderChanged || accountWillUpdate

    if (payrollWillUpdate && !canEditPayrollFields) {
      toast.error('통장정보 처리 동의를 먼저 체크해 주세요.')
      return
    }

    const payload: Parameters<typeof upsertMySensitiveProfile>[0] = {
      reason: sensitiveForm.reason.trim() || undefined,
    }
    let hasPayloadChange = false

    if (residentWillUpdate) {
      payload.resident_number = residentDigits
      payload.rrn_processing_agreed = true
      payload.rrn_processing_term_id = rrnConsentTerm?.id
      hasPayloadChange = true
    }
    if (bankNameChanged) {
      payload.bank_name = bankName || undefined
      hasPayloadChange = true
    }
    if (accountHolderChanged) {
      payload.account_holder = accountHolder || undefined
      hasPayloadChange = true
    }
    if (accountWillUpdate) {
      payload.account_number = accountNumber
      hasPayloadChange = true
    }
    if (zipCodeChanged) {
      payload.zip_code = zipCode || undefined
      hasPayloadChange = true
    }
    if (address1Changed) {
      payload.address1 = address1 || undefined
      hasPayloadChange = true
    }
    if (address2Changed) {
      payload.address2 = address2 || undefined
      hasPayloadChange = true
    }
    if (emergencyContactNameChanged) {
      payload.emergency_contact_name = emergencyContactName || undefined
      hasPayloadChange = true
    }
    if (emergencyContactPhoneChanged) {
      payload.emergency_contact_phone = emergencyContactPhone || undefined
      hasPayloadChange = true
    }
    if (payrollWillUpdate) {
      payload.payroll_processing_agreed = true
      payload.payroll_processing_term_id = payrollConsentTerm?.id
      hasPayloadChange = true
    }

    if (!hasPayloadChange) {
      toast.error('변경된 민감정보가 없습니다.')
      return
    }

    try {
      setSavingSensitive(true)
      const profile = await upsertMySensitiveProfile(payload)
      setSensitiveProfile(profile)
      setRevealedSensitive({
        resident_number: null,
        account_number: null,
      })
      setSensitiveEditMode({
        resident_number: false,
        account_number: false,
      })
      setSensitiveForm((prev) => ({
        ...prev,
        resident_number: '',
        account_number: '',
        reason: '',
      }))
      toast.success('민감정보가 저장되었습니다.')
    } catch (error) {
      toast.error(getAdminSensitiveProfileErrorMessage(error))
    } finally {
      setSavingSensitive(false)
    }
  }

  const openSensitiveRevealPanel = (target: 'resident_number' | 'account_number') => {
    setSensitiveRevealTarget(target)
    setSensitiveRevealPassword('')
    setSensitiveRevealReason('본인 확인')
    setShowSensitiveRevealPassword(false)
    setIsSensitiveRevealPanelOpen(true)
  }

  const closeSensitiveRevealPanel = () => {
    setIsSensitiveRevealPanelOpen(false)
    setSensitiveRevealTarget(null)
    setSensitiveRevealPassword('')
    setSensitiveRevealReason('본인 확인')
    setShowSensitiveRevealPassword(false)
  }

  const hideRevealedSensitiveValue = (target: 'resident_number' | 'account_number') => {
    setRevealedSensitive((prev) => ({ ...prev, [target]: null }))
  }

  const startSensitiveFieldEdit = (target: 'resident_number' | 'account_number') => {
    if (target === 'resident_number' && !canEditResidentField) {
      toast.error('주민번호 처리 동의를 먼저 체크해 주세요.')
      return
    }
    if (target === 'account_number' && !canEditPayrollFields) {
      toast.error('통장정보 처리 동의를 먼저 체크해 주세요.')
      return
    }
    setSensitiveEditMode((prev) => ({ ...prev, [target]: true }))
    setRevealedSensitive((prev) => ({ ...prev, [target]: null }))
    setSensitiveForm((prev) => ({ ...prev, [target]: '' }))
  }

  const cancelSensitiveFieldEdit = (target: 'resident_number' | 'account_number') => {
    setSensitiveEditMode((prev) => ({ ...prev, [target]: false }))
    setSensitiveForm((prev) => ({ ...prev, [target]: '' }))
  }

  const handleRevealSensitiveValue = async () => {
    if (!sensitiveRevealTarget) {
      toast.error('조회할 항목을 선택해 주세요.')
      return
    }
    if (!sensitiveRevealPassword.trim()) {
      toast.error('현재 비밀번호를 입력해 주세요.')
      return
    }

    try {
      setRevealingSensitive(true)
      const result = await revealMySensitiveProfile({
        account_password: sensitiveRevealPassword.trim(),
        reason: sensitiveRevealReason.trim() || '본인 확인',
        include_resident_number: sensitiveRevealTarget === 'resident_number',
        include_account_number: sensitiveRevealTarget === 'account_number',
      })

      setRevealedSensitive((prev) => ({
        ...prev,
        resident_number:
          sensitiveRevealTarget === 'resident_number'
            ? result.resident_number || null
            : prev.resident_number,
        account_number:
          sensitiveRevealTarget === 'account_number'
            ? result.account_number || null
            : prev.account_number,
      }))

      toast.success('평문 정보를 확인했습니다.')
      closeSensitiveRevealPanel()
    } catch (error) {
      toast.error(getAdminSensitiveProfileErrorMessage(error))
    } finally {
      setRevealingSensitive(false)
    }
  }

  const residentDisplayValue = revealedSensitive.resident_number || sensitiveProfile?.resident_number_masked || '-'
  const accountDisplayValue = revealedSensitive.account_number || sensitiveProfile?.account_number_masked || '-'
  const canRevealResident = Boolean(sensitiveProfile?.has_resident_number || sensitiveProfile?.resident_number_masked)
  const canRevealAccount = Boolean(sensitiveProfile?.has_account_number || sensitiveProfile?.account_number_masked)
  const sensitiveFieldRegistered = useMemo(
    () => ({
      resident_number: Boolean(sensitiveProfile?.has_resident_number || sensitiveProfile?.resident_number_masked),
      account_number: Boolean(sensitiveProfile?.has_account_number || sensitiveProfile?.account_number_masked),
      bank_name: Boolean(sensitiveProfile?.bank_name),
      account_holder: Boolean(sensitiveProfile?.account_holder),
      zip_code: Boolean(sensitiveProfile?.zip_code),
      address1: Boolean(sensitiveProfile?.address1),
      address2: Boolean(sensitiveProfile?.address2),
      emergency_contact_name: Boolean(sensitiveProfile?.emergency_contact_name),
      emergency_contact_phone: Boolean(sensitiveProfile?.emergency_contact_phone),
    }),
    [sensitiveProfile]
  )
  const residentRegistered = sensitiveFieldRegistered.resident_number
  const accountRegistered = sensitiveFieldRegistered.account_number
  const showResidentInput = !residentRegistered
  const showAccountInput = !accountRegistered || sensitiveEditMode.account_number
  const rrnConsentTerm = useMemo(
    () => sensitiveConsentTerms.find((term) => term.code === RRN_CONSENT_CODE) || null,
    [sensitiveConsentTerms]
  )
  const payrollConsentTerm = useMemo(
    () => sensitiveConsentTerms.find((term) => term.code === PAYROLL_CONSENT_CODE) || null,
    [sensitiveConsentTerms]
  )

  const hasLatestConsent = useCallback(
    (code: string, term: AdminSensitiveConsentTerm | null) => {
      if (!term) return false

      const normalizeCode = (value?: string | null) => String(value || '').trim().toLowerCase()
      const targetCode = normalizeCode(code)

      const matchedRecords = sensitiveConsentRecords.filter((record) => {
        const recordCode = normalizeCode(
          (record as any).code ??
            (record as any).term_code ??
            (record as any).consent_code ??
            (record as any).consent_term_code
        )
        if (!recordCode || recordCode !== targetCode) return false

        const agreedFlag = (record as any).is_agreed ?? (record as any).agreed ?? (record as any).consented
        const statusValue = String((record as any).status || '').toLowerCase()
        const isAgreed =
          agreedFlag === true ||
          statusValue === 'agreed' ||
          statusValue === 'active' ||
          statusValue === 'done'

        return isAgreed
      })

      if (matchedRecords.length === 0) return false

      const hasMatchedLatest = matchedRecords.some((record) => {
        const recordTermId = Number((record as any).term_id ?? (record as any).consent_term_id ?? (record as any).latest_term_id)
        const recordTermVersion = Number(
          (record as any).term_version ??
            (record as any).consent_term_version ??
            (record as any).latest_term_version ??
            (record as any).version
        )

        if (Number.isFinite(recordTermId) && recordTermId === term.id) return true
        if (Number.isFinite(recordTermVersion) && recordTermVersion === term.version) return true
        return false
      })

      if (hasMatchedLatest) return true

      const hasExplicitVersionInfo = matchedRecords.some((record) => {
        const recordTermId = Number((record as any).term_id ?? (record as any).consent_term_id ?? (record as any).latest_term_id)
        const recordTermVersion = Number(
          (record as any).term_version ??
            (record as any).consent_term_version ??
            (record as any).latest_term_version ??
            (record as any).version
        )
        return Number.isFinite(recordTermId) || Number.isFinite(recordTermVersion)
      })

      // 레거시 이력(버전 정보 없음)만 있는 경우에는 동의 완료로 간주한다.
      if (!hasExplicitVersionInfo) return true

      return false
    },
    [sensitiveConsentRecords]
  )

  const isLatestRrnAgreed = useMemo(
    () => hasLatestConsent(RRN_CONSENT_CODE, rrnConsentTerm),
    [hasLatestConsent, rrnConsentTerm]
  )
  const isLatestPayrollAgreed = useMemo(
    () => hasLatestConsent(PAYROLL_CONSENT_CODE, payrollConsentTerm),
    [hasLatestConsent, payrollConsentTerm]
  )

  useEffect(() => {
    setSensitiveConsents({
      rrn: isLatestRrnAgreed,
      payroll: isLatestPayrollAgreed,
    })
  }, [isLatestRrnAgreed, isLatestPayrollAgreed])

  const showRrnConsentCheckbox = Boolean(rrnConsentTerm) && !isLatestRrnAgreed
  const showPayrollConsentCheckbox = Boolean(payrollConsentTerm) && !isLatestPayrollAgreed
  const showConsentContainer = sensitiveConsentLoading || showRrnConsentCheckbox || showPayrollConsentCheckbox

  const canEditResidentField = Boolean(rrnConsentTerm && (sensitiveConsents.rrn || isLatestRrnAgreed))
  const canEditPayrollFields = Boolean(payrollConsentTerm && (sensitiveConsents.payroll || isLatestPayrollAgreed))
  const sessionCompanyName =
    (session as any)?.client?.company_name?.trim() ||
    (session as any)?.company_name?.trim() ||
    (session as any)?.client_name?.trim() ||
    '해당 회사'
  const resolvedRrnConsentContent = useMemo(() => {
    if (!rrnConsentTerm?.content) return ''
    return applyCompanyNameTemplate(rrnConsentTerm.content, sessionCompanyName)
  }, [rrnConsentTerm?.content, sessionCompanyName])
  const resolvedPayrollConsentContent = useMemo(() => {
    if (!payrollConsentTerm?.content) return ''
    return applyCompanyNameTemplate(payrollConsentTerm.content, sessionCompanyName)
  }, [payrollConsentTerm?.content, sessionCompanyName])

  const certificateDocuments = useMemo(
    () => documents.filter((doc) => doc.doc_type_code !== 'id_card' && doc.doc_type_code !== 'bank_account'),
    [documents]
  )

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        {!session ? (
          <p className="text-sm text-rose-600">세션 정보를 불러오지 못했습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[96px_1fr]">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <div className="relative h-24 w-24">
                <img
                  src={profileImagePreviewUrl}
                  alt="프로필"
                  className="h-24 w-24 rounded-full border border-zinc-200 object-cover"
                />
                {profileImageFile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSaveProfileImage()}
                      disabled={isOptimizingImage}
                      className="absolute -bottom-1 -left-1 inline-flex h-7 items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-2 text-[10px] font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isOptimizingImage ? '저장중' : '등록'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelProfileImagePreview}
                      disabled={isOptimizingImage}
                      className="absolute -bottom-1 -right-1 inline-flex h-7 items-center justify-center rounded-full border border-zinc-300 bg-white px-2 text-[10px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      취소
                    </button>
                  </>
                ) : (session as any)?.profile_image_url ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteProfileImage()}
                    disabled={isOptimizingImage}
                    className="absolute -bottom-1 -right-1 inline-flex h-7 items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-2 text-[10px] font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    삭제
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => profileImageInputRef.current?.click()}
                    disabled={isOptimizingImage}
                    className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-[10px] text-zinc-700 shadow-sm hover:bg-zinc-50"
                    aria-label="프로필 이미지 선택"
                  >
                    <Camera size={14} />
                  </button>
                )}
                <input
                  ref={profileImageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    e.currentTarget.value = ''
                    if (!file) return
                    if (!isSupportedProfileImage(file)) {
                      const fileType = file.type || '알 수 없음'
                      toast.error(`지원하지 않는 이미지 형식입니다. (선택 파일 형식: ${fileType})`)
                      return
                    }
                    setProfileImageFile(file)
                    void (async () => {
                      try {
                        const previewUrl = await fileToDataUrl(file)
                        setProfileImagePreviewUrl(previewUrl)
                      } catch {
                        toast.error('미리보기 생성에 실패했습니다. 저장은 가능합니다.')
                      }
                    })()
                  }}
                />
              </div>
              {isOptimizingImage ? <p className="text-xs text-zinc-500">이미지를 최적화하는 중입니다...</p> : null}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-zinc-500">이름</p>
                  <p className="mt-1 text-sm text-zinc-900">{session.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">이메일</p>
                  <p className="mt-1 text-sm text-zinc-900">{session.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">입사일</p>
                  <p className="mt-1 text-sm text-zinc-900">{formatDate(session.hired_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">부서/소속</p>
                  <p className="mt-1 text-sm text-zinc-900">{session.team?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">직급</p>
                  <p className="mt-1 text-sm text-zinc-900">{session.role?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">생년월일</p>
                  <p className="mt-1 text-sm text-zinc-900">{formatDate(session.birth_date)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {sessionLoading && session ? <p className="mt-3 text-xs text-zinc-400">세션 동기화 중...</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-50 px-3 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                activeTab === 'basic'
                  ? 'bg-white text-zinc-900 border border-zinc-200 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              기본정보
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                activeTab === 'documents'
                  ? 'bg-white text-zinc-900 border border-zinc-200 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              등록서류
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('certificates')}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                activeTab === 'certificates'
                  ? 'bg-white text-zinc-900 border border-zinc-200 border-b-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              자격증
            </button>
          </div>
        </div>

        <div className="p-5">
          {activeTab === 'basic' ? (
            <div>
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPasswordPanelOpen(true)}
                  className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50"
                >
                  비밀번호 변경
                </button>
              </div>
              {sensitiveLoading ? <p className="mt-3 text-sm text-zinc-500">불러오는 중...</p> : null}
              {showConsentContainer ? (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">개인정보 처리 동의</p>
                  {sensitiveConsentLoading ? <p className="mt-2 text-xs text-zinc-500">동의 약관을 불러오는 중...</p> : null}
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {showRrnConsentCheckbox ? (
                      <div className="rounded-md border border-zinc-200 bg-white p-3">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={sensitiveConsents.rrn}
                            onChange={(e) => setSensitiveConsents((prev) => ({ ...prev, rrn: e.target.checked }))}
                            disabled={!rrnConsentTerm}
                            className="mt-0.5"
                          />
                          <span className="text-xs text-zinc-700">
                            주민번호 처리 동의
                            {rrnConsentTerm ? (
                              <span className="ml-1 text-zinc-500">(v{rrnConsentTerm.version})</span>
                            ) : (
                              <span className="ml-1 text-rose-600">(약관 미등록)</span>
                            )}
                          </span>
                        </label>
                        {resolvedRrnConsentContent ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] text-zinc-500">약관 보기</summary>
                            <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-4 text-zinc-600">
                              {resolvedRrnConsentContent}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                    {showPayrollConsentCheckbox ? (
                      <div className="rounded-md border border-zinc-200 bg-white p-3">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={sensitiveConsents.payroll}
                            onChange={(e) => setSensitiveConsents((prev) => ({ ...prev, payroll: e.target.checked }))}
                            disabled={!payrollConsentTerm}
                            className="mt-0.5"
                          />
                          <span className="text-xs text-zinc-700">
                            통장정보 처리 동의 (계좌번호/은행명/예금주)
                            {payrollConsentTerm ? (
                              <span className="ml-1 text-zinc-500">(v{payrollConsentTerm.version})</span>
                            ) : (
                              <span className="ml-1 text-rose-600">(약관 미등록)</span>
                            )}
                          </span>
                        </label>
                        {resolvedPayrollConsentContent ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] text-zinc-500">약관 보기</summary>
                            <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-4 text-zinc-600">
                              {resolvedPayrollConsentContent}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500">주민번호(마스킹)</p>
                      {sensitiveFieldRegistered.resident_number ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">등록됨</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {!showResidentInput ? (
                        revealedSensitive.resident_number ? (
                          <button
                            type="button"
                            onClick={() => hideRevealedSensitiveValue('resident_number')}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                            aria-label="주민번호 가리기"
                          >
                            <EyeOff size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSensitiveRevealPanel('resident_number')}
                            disabled={!canRevealResident}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="주민번호 보기"
                          >
                            <Eye size={14} />
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                  {showResidentInput ? (
                    <input
                      type="text"
                      value={sensitiveForm.resident_number}
                      onChange={(e) =>
                        setSensitiveForm((prev) => ({
                          ...prev,
                          resident_number: formatResidentNumberInput(e.target.value),
                        }))
                      }
                      maxLength={14}
                      placeholder="주민번호 13자리"
                      disabled={!canEditResidentField}
                      className={inputClass}
                    />
                  ) : (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                      {residentDisplayValue}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500">계좌번호(마스킹)</p>
                      {sensitiveFieldRegistered.account_number ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">등록됨</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {accountRegistered ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (sensitiveEditMode.account_number) {
                              cancelSensitiveFieldEdit('account_number')
                              return
                            }
                            startSensitiveFieldEdit('account_number')
                          }}
                          className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                          disabled={!canEditPayrollFields}
                        >
                          {sensitiveEditMode.account_number ? '취소' : '수정'}
                        </button>
                      ) : null}
                      {!showAccountInput ? (
                        revealedSensitive.account_number ? (
                          <button
                            type="button"
                            onClick={() => hideRevealedSensitiveValue('account_number')}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                            aria-label="계좌번호 가리기"
                          >
                            <EyeOff size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSensitiveRevealPanel('account_number')}
                            disabled={!canRevealAccount}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="계좌번호 보기"
                          >
                            <Eye size={14} />
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                  {showAccountInput ? (
                    <input
                      type="text"
                      value={sensitiveForm.account_number}
                      onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_number: e.target.value }))}
                      disabled={!canEditPayrollFields}
                      className={inputClass}
                    />
                  ) : (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                      {accountDisplayValue}
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel label="은행명" registered={sensitiveFieldRegistered.bank_name} />
                  <input
                    type="text"
                    value={sensitiveForm.bank_name}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                    disabled={!canEditPayrollFields}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="예금주" registered={sensitiveFieldRegistered.account_holder} />
                  <input
                    type="text"
                    value={sensitiveForm.account_holder}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_holder: e.target.value }))}
                    disabled={!canEditPayrollFields}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="우편번호" registered={sensitiveFieldRegistered.zip_code} />
                  <input
                    type="text"
                    value={sensitiveForm.zip_code}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, zip_code: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="기본주소" registered={sensitiveFieldRegistered.address1} />
                  <input
                    type="text"
                    value={sensitiveForm.address1}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address1: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="상세주소" registered={sensitiveFieldRegistered.address2} />
                  <input
                    type="text"
                    value={sensitiveForm.address2}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address2: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="비상연락처 이름" registered={sensitiveFieldRegistered.emergency_contact_name} />
                  <input
                    type="text"
                    value={sensitiveForm.emergency_contact_name}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel label="비상연락처 전화" registered={sensitiveFieldRegistered.emergency_contact_phone} />
                  <input
                    type="text"
                    value={sensitiveForm.emergency_contact_phone}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-4">
                  <p className="mb-1 text-xs text-zinc-500">수정 사유(선택)</p>
                  <textarea
                    rows={2}
                    value={sensitiveForm.reason}
                    onChange={(e) => setSensitiveForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSaveSensitiveProfile()}
                  disabled={savingSensitive}
                  className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
                >
                  {savingSensitive ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === 'documents' ? (
            <div>
              <h2 className="text-base font-semibold text-zinc-900">등록서류</h2>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {DOC_TYPES.map((docType) => {
                  const status = statusByType[docType.code]
                  const isRegistered = Boolean(status?.is_registered)
                  const isUploading = uploadingType === docType.code
                  const isPreviewing = previewingType === docType.code
                  return (
                    <div key={docType.code} className="rounded-xl border border-zinc-200 bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-zinc-900">{docType.label}</p>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isRegistered ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {isRegistered ? '등록됨' : '미등록'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">최종 업로드: {formatDateTime(status?.latest_uploaded_at)}</p>

                      <div className="mt-4 space-y-2">
                        <label className="block">
                          <span className="mb-1 block text-xs text-zinc-600">파일 업로드</span>
                          <input
                            type="file"
                            className={inputClass}
                            disabled={isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              void handleUploadFile(docType.code, file)
                              e.currentTarget.value = ''
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handlePreview(docType.code)}
                          disabled={isPreviewing}
                          className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                        >
                          {isPreviewing ? '미리보기 준비 중...' : '미리보기'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500">
                    <tr>
                      <th className="px-3 py-3 text-left">문서 종류</th>
                      <th className="px-3 py-3 text-left">파일명</th>
                      <th className="px-3 py-3 text-center">업로드일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
                      </tr>
                    ) : documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">업로드된 개인서류가 없습니다.</td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id}>
                          <td className="px-3 py-3 text-zinc-700">{docTypeLabel(doc.doc_type_code)}</td>
                          <td className="px-3 py-3 text-zinc-700">{doc.file_name}</td>
                          <td className="px-3 py-3 text-center text-zinc-700">{formatDateTime(doc.uploaded_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'certificates' ? (
            <div>
              <h2 className="text-base font-semibold text-zinc-900">자격증</h2>
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">자격증 파일 업로드</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className={inputClass}
                    disabled
                    onChange={(e) => {
                      e.currentTarget.value = ''
                    }}
                  />
                </label>
                <p className="mt-2 text-xs text-zinc-500">
                  서버 기준으로 자격증 전용 업로드 API가 아직 없어, 현재는 조회 전용으로 표시됩니다.
                </p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-zinc-500">
                    <tr>
                      <th className="px-3 py-3 text-left">파일명</th>
                      <th className="px-3 py-3 text-center">문서유형</th>
                      <th className="px-3 py-3 text-center">업로드일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">조회 중...</td>
                      </tr>
                    ) : certificateDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">등록된 자격증 문서가 없습니다.</td>
                      </tr>
                    ) : (
                      certificateDocuments.map((doc) => (
                        <tr key={doc.id}>
                          <td className="px-3 py-3 text-zinc-700">{doc.file_name}</td>
                          <td className="px-3 py-3 text-center text-zinc-700">{doc.doc_type_code}</td>
                          <td className="px-3 py-3 text-center text-zinc-700">{formatDateTime(doc.uploaded_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isSensitiveRevealPanelOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <div>
                <p className="text-base font-semibold text-zinc-900">민감정보 확인</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {sensitiveRevealTarget === 'resident_number' ? '주민번호' : '계좌번호'} 평문 조회를 위해 비밀번호를 입력해 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSensitiveRevealPanel}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showSensitiveRevealPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-16`}
                    value={sensitiveRevealPassword}
                    onChange={(e) => setSensitiveRevealPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSensitiveRevealPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showSensitiveRevealPassword ? '숨김' : '보기'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">조회 사유(선택)</label>
                <input
                  type="text"
                  className={inputClass}
                  value={sensitiveRevealReason}
                  onChange={(e) => setSensitiveRevealReason(e.target.value)}
                  placeholder="본인 확인"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeSensitiveRevealPanel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleRevealSensitiveValue()}
                disabled={revealingSensitive || !sensitiveRevealPassword.trim()}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
              >
                {revealingSensitive ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPasswordPanelOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <div>
                <p className="text-base font-semibold text-zinc-900">비밀번호 변경</p>
                <p className="mt-1 text-xs text-zinc-500">새 비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordPanelOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">현재 비밀번호</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-16`}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showCurrentPassword ? '숨김' : '보기'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-16`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showNewPassword ? '숨김' : '보기'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">새 비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-16`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showConfirmPassword ? '숨김' : '보기'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <p className={passwordChecks.minLength ? 'text-emerald-600' : 'text-zinc-500'}>
                  {passwordChecks.minLength ? '✓' : '•'} 8자 이상
                </p>
                <p className={passwordChecks.hasLetter ? 'text-emerald-600' : 'text-zinc-500'}>
                  {passwordChecks.hasLetter ? '✓' : '•'} 영문자 포함
                </p>
                <p className={passwordChecks.hasNumber ? 'text-emerald-600' : 'text-zinc-500'}>
                  {passwordChecks.hasNumber ? '✓' : '•'} 숫자 포함
                </p>
                <p className={passwordChecks.differentFromCurrent ? 'text-emerald-600' : 'text-zinc-500'}>
                  {passwordChecks.differentFromCurrent ? '✓' : '•'} 현재 비밀번호와 다름
                </p>
                {hasConfirmInput ? (
                  <p className={isPasswordMatch ? 'text-emerald-600' : 'text-rose-600'}>
                    {isPasswordMatch ? '✓ 비밀번호 확인 일치' : '• 비밀번호 확인 불일치'}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setIsPasswordPanelOpen(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={async () => {
                  const changed = await handleChangePassword()
                  if (changed) {
                    setIsPasswordPanelOpen(false)
                  }
                }}
                disabled={savingPassword || !canSavePassword}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingPassword ? '변경 중...' : '비밀번호 변경'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
