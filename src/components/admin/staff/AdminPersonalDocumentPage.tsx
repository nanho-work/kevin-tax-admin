'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { changeAdminPassword, deleteMyProfileImage, uploadMyProfileImage } from '@/services/admin/adminService'
import {
  fetchMySensitiveProfile,
  getAdminSensitiveProfileErrorMessage,
  upsertMySensitiveProfile,
} from '@/services/admin/adminSensitiveProfileService'
import { useAdminSessionContext } from '@/contexts/AdminSessionContext'
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
import type { AdminSensitiveProfile } from '@/types/adminSensitiveProfile'

const DOC_TYPES: Array<{ code: PersonalDocumentDocType; label: string }> = [
  { code: 'id_card', label: '신분증' },
  { code: 'bank_account', label: '통장사본' },
]

const inputClass =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
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
  const [savingSensitive, setSavingSensitive] = useState(false)
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

  const loadSensitiveProfile = async () => {
    try {
      setSensitiveLoading(true)
      const profile = await fetchMySensitiveProfile()
      setSensitiveProfile(profile)
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
  }

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
    try {
      setSavingSensitive(true)
      const profile = await upsertMySensitiveProfile({
        resident_number: sensitiveForm.resident_number.trim() || undefined,
        bank_name: sensitiveForm.bank_name || undefined,
        account_holder: sensitiveForm.account_holder || undefined,
        account_number: sensitiveForm.account_number.trim() || undefined,
        zip_code: sensitiveForm.zip_code || undefined,
        address1: sensitiveForm.address1 || undefined,
        address2: sensitiveForm.address2 || undefined,
        emergency_contact_name: sensitiveForm.emergency_contact_name || undefined,
        emergency_contact_phone: sensitiveForm.emergency_contact_phone || undefined,
        reason: sensitiveForm.reason.trim() || undefined,
      })
      setSensitiveProfile(profile)
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
              <div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsPasswordPanelOpen(true)}
                    className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50"
                  >
                    비밀번호 변경
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {sessionLoading && session ? <p className="mt-3 text-xs text-zinc-400">세션 동기화 중...</p> : null}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">개인서류</h2>
        <p className="mt-1 text-sm text-zinc-500">급여/4대보험 업무에 필요한 본인 신분증과 통장사본을 업로드하고 확인할 수 있습니다.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">민감정보</h2>
        <p className="mt-1 text-sm text-zinc-500">직원 본인 정보 입력/수정용입니다. 주민번호/계좌번호는 암호화 저장됩니다.</p>
        {!hasLoadedSensitive ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void loadSensitiveProfile()}
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50"
            >
              민감정보 불러오기
            </button>
          </div>
        ) : null}
        {sensitiveLoading ? <p className="mt-3 text-sm text-zinc-500">불러오는 중...</p> : null}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-zinc-500">주민번호(마스킹)</p>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
              {sensitiveProfile?.resident_number_masked || '-'}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">계좌번호(마스킹)</p>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
              {sensitiveProfile?.account_number_masked || '-'}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">주민번호 입력/변경</p>
            <input
              type="text"
              value={sensitiveForm.resident_number}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, resident_number: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">계좌번호 입력/변경</p>
            <input
              type="text"
              value={sensitiveForm.account_number}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_number: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">은행명</p>
            <input
              type="text"
              value={sensitiveForm.bank_name}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, bank_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">예금주</p>
            <input
              type="text"
              value={sensitiveForm.account_holder}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, account_holder: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">우편번호</p>
            <input
              type="text"
              value={sensitiveForm.zip_code}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, zip_code: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">기본주소</p>
            <input
              type="text"
              value={sensitiveForm.address1}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address1: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">상세주소</p>
            <input
              type="text"
              value={sensitiveForm.address2}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, address2: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">비상연락처 이름</p>
            <input
              type="text"
              value={sensitiveForm.emergency_contact_name}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">비상연락처 전화</p>
            <input
              type="text"
              value={sensitiveForm.emergency_contact_phone}
              onChange={(e) => setSensitiveForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
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
            {savingSensitive ? '저장 중...' : '민감정보 저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
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
