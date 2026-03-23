'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import FileDropzone from '@/components/common/FileDropzone'
import KakaoAddressSearchModal from '@/components/common/KakaoAddressSearchModal'
import { fetchCompanyDetail } from '@/services/admin/company'
import {
  createCompanyAccount as createAdminCompanyAccount,
  getCompanyAccounts as getAdminCompanyAccounts,
  updateCompanyAccountStatus as updateAdminCompanyAccountStatus,
} from '@/services/admin/companyAccountService'
import { downloadFileViaBlob } from '@/services/download/browserDownload'
import { validateUploadFile } from '@/utils/fileUploadPolicy'
import type { CompanyCreateRequest, CompanyDetailResponse, CompanyUpdateRequest } from '@/types/admin_campany'
import type { CompanyDocumentPreviewResponse } from '@/services/admin/company'
import type {
  CompanyAccountCreateRequest,
  CompanyAccountListParams,
  CompanyAccountListResponse,
  CompanyAccountOut,
  CompanyAccountStatus,
} from '@/types/companyAccount'

interface Props {
  company: CompanyDetailResponse
  mode?: 'edit' | 'create'
  businessLicensePreview?: CompanyDocumentPreviewResponse | null
  documentTypes?: { code: string; label: string }[]
  enableCustomDocuments?: boolean
  editable?: boolean
  showSystemInfo?: boolean
  listPath?: string
  fetchDetailFn?: (company_id: number) => Promise<CompanyDetailResponse>
  createFn?: (payload: CompanyCreateRequest) => Promise<unknown>
  updateFn?: (company_id: number, payload: CompanyUpdateRequest) => Promise<{ message: string }>
  fetchBusinessLicensePreviewFn?: (company_id: number) => Promise<CompanyDocumentPreviewResponse>
  uploadBusinessLicenseFn?: (company_id: number, file: File) => Promise<unknown>
  deleteBusinessLicenseFn?: (company_id: number) => Promise<unknown>
  fetchDocumentPreviewFn?: (company_id: number, docTypeCode: string) => Promise<CompanyDocumentPreviewResponse>
  uploadDocumentFn?: (company_id: number, docTypeCode: string, file: File) => Promise<unknown>
  deleteDocumentFn?: (company_id: number, docTypeCode: string) => Promise<unknown>
  listCustomDocumentsFn?: (
    company_id: number,
    include_deleted?: boolean
  ) => Promise<{
    total: number
    items: Array<{ id: number; title: string; file_name: string; created_at: string; uploaded_at?: string }>
  }>
  uploadCustomDocumentFn?: (
    company_id: number,
    params: { title: string; file: File }
  ) => Promise<unknown>
  uploadCustomDocumentsBulkFn?: (
    company_id: number,
    params: { files: File[]; titles?: string[] }
  ) => Promise<{
    total: number
    success_count: number
    failed_count: number
    items: Array<{ id: number; title: string; file_name: string }>
    failed_items: Array<{ index: number; file_name: string; title?: string | null; error: string }>
  }>
  deleteCustomDocumentFn?: (company_id: number, document_id: number) => Promise<{ message: string }>
  getCustomDocumentDownloadUrlFn?: (
    company_id: number,
    document_id: number
  ) => Promise<{ download_url: string; file_name: string }>
  getCustomDocumentPreviewUrlFn?: (
    company_id: number,
    document_id: number
  ) => Promise<{ preview_url: string; file_name: string }>
  listCustomDocumentLogsFn?: (
    company_id: number,
    document_id: number
  ) => Promise<{ total: number; items: Array<{ action: string }> }>
  getHometaxCredentialFn?: (company_id: number) => Promise<{
    id: number
    client_id: number
    company_id: number
    hometax_login_id: string
    password_set: boolean
    enc_key_version: string
    is_active: boolean
    created_at: string
    updated_at: string
  }>
  upsertHometaxCredentialFn?: (
    company_id: number,
    payload: { hometax_login_id: string; hometax_password: string; is_active: boolean }
  ) => Promise<unknown>
  patchHometaxCredentialActiveFn?: (company_id: number, payload: { is_active: boolean }) => Promise<{ message: string }>
  revealHometaxCredentialPasswordFn?: (
    company_id: number,
    payload: { account_password: string }
  ) => Promise<{
    company_id: number
    hometax_login_id: string
    hometax_password: string
    reveal_count: number
  }>
  listHometaxCredentialLogsFn?: (
    company_id: number,
    limit?: number
  ) => Promise<{
    total: number
    items: Array<{
      id: number
      action: string
      actor_type: string
      created_at: string
      ip?: string | null
    }>
  }>
  createCompanyAccountFn?: (payload: CompanyAccountCreateRequest) => Promise<CompanyAccountOut>
  listCompanyAccountsFn?: (params: CompanyAccountListParams) => Promise<CompanyAccountListResponse>
  updateCompanyAccountStatusFn?: (account_id: number, status: CompanyAccountStatus) => Promise<CompanyAccountOut>
}

type LocalCustomDocument = {
  id: number
  title: string
  fileName: string
  uploadedAt: string
  downloadCount: number
}

type LocalCustomUploadDraft = {
  file: File
  title: string
}

type LocalHometaxCredential = {
  hometax_login_id: string
  password_set: boolean
  is_active: boolean
  enc_key_version: string
}

function formatBusinessRegistrationNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 5)
  const p3 = digits.slice(5, 10)
  if (digits.length <= 3) return p1
  if (digits.length <= 5) return `${p1}-${p2}`
  return `${p1}-${p2}-${p3}`
}

function toSuggestedDocumentTitle(fileName: string) {
  const trimmed = fileName.trim()
  if (!trimmed) return ''
  return trimmed.replace(/\.[^.]+$/, '').trim() || trimmed
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
          </div>
          {action ? <div className="sm:ml-auto">{action}</div> : null}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`.trim()}>
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'
const MAX_CUSTOM_DOCUMENT_FILE_SIZE = 2 * 1024 * 1024 * 1024

function validateCustomDocumentFile(file: File): string | null {
  const result = validateUploadFile(file, { maxBytes: MAX_CUSTOM_DOCUMENT_FILE_SIZE })
  return result.valid ? null : result.message || '파일 검증에 실패했습니다.'
}

function toDateOnly(value?: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return value.slice(0, 10)
}

function toDateTime(value?: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('ko-KR')
  }
  return value
}

function formatBytes(value?: number | null): string {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B'
  if (bytes < 1024) return `${Math.floor(bytes)}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)}MB`
  return `${(bytes / (1024 ** 3)).toFixed(1)}GB`
}

function buildPreviewSrc(previewUrl: string, fileName?: string | null): string {
  const isPdf = (fileName ?? '').toLowerCase().endsWith('.pdf')
  if (!isPdf) return previewUrl
  const hash = 'view=FitH&zoom=page-width&toolbar=0&navpanes=0&scrollbar=0'
  return `${previewUrl}#${hash}`
}

function isImageFile(fileName?: string | null): boolean {
  if (!fileName) return false
  const lower = fileName.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.bmp')
  )
}

function isPreviewableCustomDocument(fileName?: string | null): boolean {
  if (!fileName) return false
  if (isImageFile(fileName)) return true
  return fileName.toLowerCase().endsWith('.pdf')
}

export default function CompanyDetailForm({
  company,
  mode = 'edit',
  businessLicensePreview = null,
  documentTypes,
  enableCustomDocuments = false,
  editable = true,
  showSystemInfo = true,
  listPath = '/admin/companies',
  fetchDetailFn = fetchCompanyDetail,
  createFn,
  updateFn,
  fetchBusinessLicensePreviewFn,
  uploadBusinessLicenseFn,
  deleteBusinessLicenseFn,
  fetchDocumentPreviewFn,
  uploadDocumentFn,
  deleteDocumentFn,
  listCustomDocumentsFn,
  uploadCustomDocumentFn,
  uploadCustomDocumentsBulkFn,
  deleteCustomDocumentFn,
  getCustomDocumentDownloadUrlFn,
  getCustomDocumentPreviewUrlFn,
  listCustomDocumentLogsFn,
  getHometaxCredentialFn,
  upsertHometaxCredentialFn,
  patchHometaxCredentialActiveFn,
  revealHometaxCredentialPasswordFn,
  listHometaxCredentialLogsFn,
  createCompanyAccountFn = createAdminCompanyAccount,
  listCompanyAccountsFn = getAdminCompanyAccounts,
  updateCompanyAccountStatusFn = updateAdminCompanyAccountStatus,
}: Props) {
  const router = useRouter()
  const { id } = useParams()
  const companyId = Number(id)
  const isCreateMode = mode === 'create'
  const hasValidCompanyId = Number.isFinite(companyId) && companyId > 0
  const [form, setForm] = useState<CompanyDetailResponse | null>(null)
  const resolvedDocumentTypes = useMemo(
    () =>
      documentTypes?.length
        ? documentTypes
        : [{ code: 'business_license', label: '사업자등록증' }],
    [documentTypes]
  )
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, CompanyDocumentPreviewResponse | null>>(
    {}
  )
  const [activePreviewDocType, setActivePreviewDocType] = useState<string>(resolvedDocumentTypes[0].code)
  const [previewCheckedDocCodes, setPreviewCheckedDocCodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(!isCreateMode)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(isCreateMode)
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)
  const [hometaxExpanded, setHometaxExpanded] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [deletingDocumentCode, setDeletingDocumentCode] = useState<string | null>(null)
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null)
  const [selectedUploadDocType, setSelectedUploadDocType] = useState<string>(resolvedDocumentTypes[0].code)
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [customDocFile, setCustomDocFile] = useState<File | null>(null)
  const [customDocFiles, setCustomDocFiles] = useState<File[]>([])
  const [customDocDrafts, setCustomDocDrafts] = useState<LocalCustomUploadDraft[]>([])
  const [customDocuments, setCustomDocuments] = useState<LocalCustomDocument[]>([])
  const [loadingCustomDocs, setLoadingCustomDocs] = useState(false)
  const [uploadingCustomDoc, setUploadingCustomDoc] = useState(false)
  const [companyAccount, setCompanyAccount] = useState<CompanyAccountOut | null>(null)
  const [loadingCompanyAccount, setLoadingCompanyAccount] = useState(false)
  const [savingCompanyAccount, setSavingCompanyAccount] = useState(false)
  const [companyAccountForm, setCompanyAccountForm] = useState({
    login_id: '',
    password: '',
  })
  const [hometaxCredential, setHometaxCredential] = useState<LocalHometaxCredential | null>(null)
  const [loadingHometax, setLoadingHometax] = useState(false)
  const [savingHometax, setSavingHometax] = useState(false)
  const [hometaxForm, setHometaxForm] = useState({
    hometax_login_id: '',
    hometax_password: '',
    is_active: true,
  })
  const [revealAccountPassword, setRevealAccountPassword] = useState('')
  const [revealedHometaxPassword, setRevealedHometaxPassword] = useState<string | null>(null)
  const [revealedCount, setRevealedCount] = useState<number | null>(null)
  const [hometaxLogs, setHometaxLogs] = useState<
    Array<{ id: number; action: string; actor_type: string; created_at: string; ip?: string | null }>
  >([])
  const [loadingHometaxLogs, setLoadingHometaxLogs] = useState(false)
  const [hometaxFetched, setHometaxFetched] = useState(false)
  const [hometaxLogsFetched, setHometaxLogsFetched] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const customDocFileInputRef = useRef<HTMLInputElement | null>(null)

  const activePreview = documentPreviews[activePreviewDocType] || null
  const supportsDocumentUpload = !isCreateMode && Boolean(uploadDocumentFn || uploadBusinessLicenseFn)
  const supportsDocumentDelete = !isCreateMode && Boolean(deleteDocumentFn || deleteBusinessLicenseFn)
  const supportsCustomDocumentRead =
    !isCreateMode &&
    Boolean(listCustomDocumentsFn) &&
    Boolean(getCustomDocumentDownloadUrlFn) &&
    Boolean(getCustomDocumentPreviewUrlFn)
  const supportsCustomDocumentWrite =
    !isCreateMode &&
    Boolean(uploadCustomDocumentFn) &&
    Boolean(deleteCustomDocumentFn)
  const supportsCustomDocumentBulkWrite = !isCreateMode && Boolean(uploadCustomDocumentsBulkFn)
  const sortedCustomDocuments = useMemo(
    () =>
      [...customDocuments].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    [customDocuments]
  )
  const supportsHometaxRead = !isCreateMode && Boolean(getHometaxCredentialFn)
  const supportsHometaxWrite = !isCreateMode && Boolean(upsertHometaxCredentialFn)
  const supportsHometaxActivePatch = !isCreateMode && Boolean(patchHometaxCredentialActiveFn)
  const supportsHometaxReveal = !isCreateMode && Boolean(revealHometaxCredentialPasswordFn)
  const supportsHometaxLogs = !isCreateMode && Boolean(listHometaxCredentialLogsFn)
  const supportsHometax = supportsHometaxRead
  const supportsCompanyAccount =
    !isCreateMode &&
    hasValidCompanyId &&
    Boolean(createCompanyAccountFn) &&
    Boolean(listCompanyAccountsFn) &&
    Boolean(updateCompanyAccountStatusFn)
  const hasHometaxRegistered = Boolean(hometaxCredential?.password_set)

  const extractApiDetail = (error: unknown): string | null => {
    const detail = (error as any)?.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (detail && typeof detail === 'object') {
      const code = typeof detail.code === 'string' ? detail.code : ''
      const message = typeof detail.message === 'string' && detail.message.trim() ? detail.message.trim() : ''
      if (code === 'DOCS_QUOTA_EXCEEDED') {
        const availableBytes = Number(detail.available_bytes || 0)
        const incomingBytes = Number(detail.incoming_size_bytes || 0)
        return `문서함 용량이 부족합니다. 남은 용량 ${formatBytes(availableBytes)} / 업로드 파일 ${formatBytes(incomingBytes)}`
      }
      if (message) return message
    }
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
    return null
  }
  const canEditFields = isCreateMode ? true : editable && editMode
  const editableInputClass = canEditFields ? inputClass : `${inputClass} bg-zinc-100 text-zinc-600`

  useEffect(() => {
    if (isCreateMode) {
      setForm({
        id: 0,
        company_name: '',
        owner_name: '',
        registration_number: '',
        category: '',
        industry_type: '',
        business_type: '',
        postal_code: '',
        address1: '',
        address2: '',
        is_active: true,
        created_at: '',
        updated_at: '',
      })
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const data = await fetchDetailFn(companyId)
        setForm(data)
      } catch (err) {
        console.error('상세 정보 불러오기 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    if (hasValidCompanyId) load()
  }, [companyId, fetchDetailFn, hasValidCompanyId, isCreateMode])

  const fetchPreviewByDocType = async (docTypeCode: string): Promise<CompanyDocumentPreviewResponse | null> => {
    try {
      if (fetchDocumentPreviewFn) {
        return await fetchDocumentPreviewFn(companyId, docTypeCode)
      }
      if (docTypeCode === 'business_license' && fetchBusinessLicensePreviewFn) {
        return await fetchBusinessLicensePreviewFn(companyId)
      }
      return null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!hasValidCompanyId || isCreateMode) return
    if (!businessLicensePreview) return
    setDocumentPreviews((prev) => ({ ...prev, business_license: businessLicensePreview }))
    setPreviewCheckedDocCodes((prev) => {
      if (prev.has('business_license')) return prev
      const next = new Set(prev)
      next.add('business_license')
      return next
    })
  }, [businessLicensePreview, hasValidCompanyId, isCreateMode])

  useEffect(() => {
    if (!hasValidCompanyId || isCreateMode) return
    if (previewCheckedDocCodes.has(activePreviewDocType)) return
    let cancelled = false
    const loadActivePreview = async () => {
      const preview = await fetchPreviewByDocType(activePreviewDocType)
      if (cancelled) return
      setDocumentPreviews((prev) => ({ ...prev, [activePreviewDocType]: preview }))
      setPreviewCheckedDocCodes((prev) => {
        if (prev.has(activePreviewDocType)) return prev
        const next = new Set(prev)
        next.add(activePreviewDocType)
        return next
      })
    }
    void loadActivePreview()
    return () => {
      cancelled = true
    }
  }, [activePreviewDocType, hasValidCompanyId, isCreateMode, previewCheckedDocCodes])

  const loadCustomDocuments = async () => {
    if (!enableCustomDocuments || !listCustomDocumentsFn) return
    try {
      setLoadingCustomDocs(true)
      const res = await listCustomDocumentsFn(companyId, false)
      const rows = res.items || []
      if (!listCustomDocumentLogsFn) {
        setCustomDocuments(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            fileName: row.file_name,
            uploadedAt: row.uploaded_at || row.created_at,
            downloadCount: 0,
          }))
        )
        return
      }

      const countEntries = await Promise.all(
        rows.map(async (row) => {
          try {
            const logs = await listCustomDocumentLogsFn(companyId, row.id)
            const downloadCount = (logs.items || []).filter((log) => log.action === 'download').length
            return [row.id, downloadCount] as const
          } catch {
            return [row.id, 0] as const
          }
        })
      )
      const countMap = Object.fromEntries(countEntries)
      setCustomDocuments(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          fileName: row.file_name,
          uploadedAt: row.uploaded_at || row.created_at,
          downloadCount: countMap[row.id] ?? 0,
        }))
      )
    } finally {
      setLoadingCustomDocs(false)
    }
  }

  useEffect(() => {
    if (isCreateMode || !hasValidCompanyId) return
    void loadCustomDocuments()
  }, [companyId, enableCustomDocuments, hasValidCompanyId, isCreateMode, listCustomDocumentsFn])

  const loadCompanyAccount = async () => {
    if (!supportsCompanyAccount) return
    try {
      setLoadingCompanyAccount(true)
      const response = await listCompanyAccountsFn({
        company_id: companyId,
        page: 1,
        limit: 1,
      })
      setCompanyAccount(response.items?.[0] ?? null)
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(extractApiDetail(error) || '고객사 계정 정보를 불러오지 못했습니다.')
      }
      setCompanyAccount(null)
    } finally {
      setLoadingCompanyAccount(false)
    }
  }

  useEffect(() => {
    if (!supportsCompanyAccount) return
    void loadCompanyAccount()
  }, [companyId, supportsCompanyAccount])

  useEffect(() => {
    setHometaxFetched(false)
    setHometaxLogsFetched(false)
    setHometaxCredential(null)
    setHometaxLogs([])
    setRevealedCount(null)
  }, [companyId])

  useEffect(() => {
    if (!supportsHometaxRead || !hasValidCompanyId || !getHometaxCredentialFn) return
    if (!hometaxExpanded || hometaxFetched) return
    const loadHometax = async () => {
      try {
        setLoadingHometax(true)
        const res = await getHometaxCredentialFn(companyId)
        setHometaxCredential({
          hometax_login_id: res.hometax_login_id,
          password_set: res.password_set,
          is_active: res.is_active,
          enc_key_version: res.enc_key_version,
        })
        setHometaxForm((prev) => ({
          ...prev,
          hometax_login_id: res.hometax_login_id || '',
          is_active: Boolean(res.is_active),
          hometax_password: '',
        }))
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          toast.error(extractApiDetail(error) || '홈택스 정보 조회에 실패했습니다.')
        }
        setHometaxCredential(null)
      } finally {
        setLoadingHometax(false)
        setHometaxFetched(true)
      }
    }
    void loadHometax()
  }, [
    companyId,
    getHometaxCredentialFn,
    hasValidCompanyId,
    supportsHometaxRead,
    hometaxExpanded,
    hometaxFetched,
  ])

  useEffect(() => {
    if (!supportsHometaxRead || !supportsHometaxLogs || !hasValidCompanyId || !listHometaxCredentialLogsFn) return
    if (!hometaxExpanded || hometaxLogsFetched) return
    const loadHometaxLogs = async () => {
      try {
        setLoadingHometaxLogs(true)
        const res = await listHometaxCredentialLogsFn(companyId, 50)
        const items = res.items || []
        setHometaxLogs(items)
        if (revealedCount === null) {
          setRevealedCount(items.filter((item) => item.action === 'reveal').length)
        }
      } catch {
        setHometaxLogs([])
      } finally {
        setLoadingHometaxLogs(false)
        setHometaxLogsFetched(true)
      }
    }
    void loadHometaxLogs()
  }, [
    companyId,
    hasValidCompanyId,
    listHometaxCredentialLogsFn,
    supportsHometaxRead,
    supportsHometaxLogs,
    hometaxExpanded,
    hometaxLogsFetched,
  ])

  const handleUpsertHometax = async () => {
    if (!upsertHometaxCredentialFn || !supportsHometaxWrite) {
      toast.error('홈택스 정보 저장 권한이 없습니다.')
      return
    }
    if (!hometaxForm.hometax_login_id.trim()) {
      toast.error('홈택스 아이디를 입력해 주세요.')
      return
    }
    if (!hometaxForm.hometax_password.trim()) {
      toast.error('홈택스 비밀번호를 입력해 주세요.')
      return
    }
    try {
      setSavingHometax(true)
      const res: any = await upsertHometaxCredentialFn(companyId, {
        hometax_login_id: hometaxForm.hometax_login_id.trim(),
        hometax_password: hometaxForm.hometax_password,
        is_active: hometaxForm.is_active,
      })
      const next = {
        hometax_login_id: res?.hometax_login_id || hometaxForm.hometax_login_id.trim(),
        password_set: true,
        is_active: Boolean(res?.is_active ?? hometaxForm.is_active),
        enc_key_version: res?.enc_key_version || 'v1',
      }
      setHometaxCredential(next)
      setHometaxForm((prev) => ({ ...prev, hometax_password: '' }))
      setRevealedHometaxPassword(null)
      setRevealAccountPassword('')
      toast.success('홈택스 정보가 저장되었습니다.')
      if (listHometaxCredentialLogsFn) {
        const logs = await listHometaxCredentialLogsFn(companyId, 50)
        setHometaxLogs(logs.items || [])
        setHometaxLogsFetched(true)
      }
    } catch (error) {
      toast.error(extractApiDetail(error) || '홈택스 정보 저장에 실패했습니다.')
    } finally {
      setSavingHometax(false)
    }
  }

  const handlePatchHometaxActive = async (nextActive: boolean) => {
    if (!patchHometaxCredentialActiveFn || !supportsHometaxActivePatch) {
      setHometaxForm((prev) => ({ ...prev, is_active: nextActive }))
      return
    }
    try {
      const res = await patchHometaxCredentialActiveFn(companyId, { is_active: nextActive })
      setHometaxCredential((prev) => (prev ? { ...prev, is_active: nextActive } : prev))
      setHometaxForm((prev) => ({ ...prev, is_active: nextActive }))
      toast.success(res.message || '상태가 변경되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '활성 상태 변경에 실패했습니다.')
    }
  }

  const handleRevealHometax = async () => {
    if (!revealHometaxCredentialPasswordFn || !supportsHometaxReveal) {
      toast.error('홈택스 정보 확인 권한이 없습니다.')
      return
    }
    if (!revealAccountPassword.trim()) {
      toast.error('본인 계정 비밀번호를 입력해 주세요.')
      return
    }
    try {
      const res = await revealHometaxCredentialPasswordFn(companyId, {
        account_password: revealAccountPassword,
      })
      setRevealedHometaxPassword(res.hometax_password)
      setRevealedCount(res.reveal_count)
      setRevealAccountPassword('')
      toast.success('홈택스 정보가 확인되었습니다.')
      window.setTimeout(() => {
        setRevealedHometaxPassword(null)
      }, 15000)
      if (listHometaxCredentialLogsFn) {
        const logs = await listHometaxCredentialLogsFn(companyId, 50)
        const items = logs.items || []
        setHometaxLogs(items)
        setHometaxLogsFetched(true)
        setRevealedCount(items.filter((item) => item.action === 'reveal').length)
      }
    } catch (error) {
      toast.error(extractApiDetail(error) || '홈택스 정보 확인에 실패했습니다.')
    }
  }

  const handleUploadBusinessLicense = async () => {
    if (!selectedUploadDocType) {
      toast.error('문서이름을 먼저 선택해 주세요.')
      return
    }
    if (!supportsDocumentUpload) return
    if (!selectedDocumentFile) {
      toast.error('업로드할 파일을 먼저 선택해 주세요.')
      return
    }
    try {
      setUploadingDocument(true)
      if (uploadDocumentFn) {
        await uploadDocumentFn(companyId, selectedUploadDocType, selectedDocumentFile)
      } else if (selectedUploadDocType === 'business_license' && uploadBusinessLicenseFn) {
        await uploadBusinessLicenseFn(companyId, selectedDocumentFile)
      } else {
        toast.error('선택한 문서이름의 업로드 API가 준비되지 않았습니다.')
        return
      }
      const nextPreview = await fetchPreviewByDocType(selectedUploadDocType)
      setDocumentPreviews((prev) => ({ ...prev, [selectedUploadDocType]: nextPreview }))
      setPreviewCheckedDocCodes((prev) => {
        const next = new Set(prev)
        next.add(selectedUploadDocType)
        return next
      })
      if (nextPreview?.preview_url) {
        setActivePreviewDocType(selectedUploadDocType)
      }
      toast.success('문서가 등록되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingDocument(false)
      setSelectedDocumentFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOpenDocumentPreview = async (docTypeCode: string) => {
    let preview = documentPreviews[docTypeCode] ?? null
    const isChecked = previewCheckedDocCodes.has(docTypeCode)

    if (!isChecked) {
      preview = await fetchPreviewByDocType(docTypeCode)
      setDocumentPreviews((prev) => ({ ...prev, [docTypeCode]: preview }))
      setPreviewCheckedDocCodes((prev) => {
        const next = new Set(prev)
        next.add(docTypeCode)
        return next
      })
    }

    if (!preview?.preview_url) {
      toast.error('등록된 파일이 없습니다.')
      return
    }

    setActivePreviewDocType(docTypeCode)
  }

  const handleDeleteDocument = async (docTypeCode: string) => {
    if (!documentPreviews[docTypeCode]) return
    if (!deleteDocumentFn && !(docTypeCode === 'business_license' && deleteBusinessLicenseFn)) {
      toast.error('문서 삭제 API가 아직 준비되지 않았습니다.')
      return
    }
    if (!confirm('등록된 문서를 삭제하시겠습니까?')) return
    try {
      setDeletingDocumentCode(docTypeCode)
      if (deleteDocumentFn) {
        await deleteDocumentFn(companyId, docTypeCode)
      } else if (docTypeCode === 'business_license' && deleteBusinessLicenseFn) {
        await deleteBusinessLicenseFn(companyId)
      }
      setDocumentPreviews((prev) => ({ ...prev, [docTypeCode]: null }))
      if (activePreviewDocType === docTypeCode) {
        const fallback = resolvedDocumentTypes.find((item) => item.code !== docTypeCode)?.code
        if (fallback) setActivePreviewDocType(fallback)
      }
      toast.success('문서가 삭제되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingDocumentCode(null)
    }
  }

  const handleAddCustomDocument = async () => {
    if (!uploadCustomDocumentFn) {
      toast.error('커스텀 문서 업로드 API가 아직 준비되지 않았습니다.')
      return
    }
    const selectedFiles = customDocFiles.length > 0 ? customDocFiles : customDocFile ? [customDocFile] : []
    if (selectedFiles.length === 0) {
      toast.error('업로드할 파일을 선택해 주세요.')
      return
    }

    const drafts =
      customDocDrafts.length === selectedFiles.length
        ? customDocDrafts
        : selectedFiles.map((file) => ({ file, title: toSuggestedDocumentTitle(file.name) }))

    for (const file of selectedFiles) {
      const filePolicyError = validateCustomDocumentFile(file)
      if (filePolicyError) {
        toast.error(`${file.name}: ${filePolicyError}`)
        return
      }
    }

    try {
      setUploadingCustomDoc(true)
      if (selectedFiles.length > 1 && uploadCustomDocumentsBulkFn) {
        const titles = drafts.map((item) => item.title.trim())
        const result = await uploadCustomDocumentsBulkFn(companyId, {
          files: selectedFiles,
          titles,
        })
        if (result.failed_count > 0) {
          const failedPreview = (result.failed_items || [])
            .slice(0, 3)
            .map((item) => `${item.file_name}: ${item.error}`)
            .join(' / ')
          toast.success(`총 ${result.total}건 중 ${result.success_count}건 업로드, ${result.failed_count}건 실패`)
          if (failedPreview) {
            toast.error(`실패 항목: ${failedPreview}`)
          }
        } else {
          toast.success(`${result.success_count}건 업로드되었습니다. 문서함(공용문서 > 고객사 자료)에도 반영됩니다.`)
        }
      } else {
        const singleFile = selectedFiles[0]
        const title = drafts[0]?.title?.trim() || toSuggestedDocumentTitle(singleFile.name)
        await uploadCustomDocumentFn(companyId, { title, file: singleFile })
        toast.success('기타 관련 서류가 등록되었습니다. 문서함(공용문서 > 고객사 자료)에도 반영됩니다.')
      }
      setCustomDocFile(null)
      setCustomDocFiles([])
      setCustomDocDrafts([])
      if (customDocFileInputRef.current) customDocFileInputRef.current.value = ''
      await loadCustomDocuments()
    } catch (error) {
      toast.error(extractApiDetail(error) || '기타 관련 서류 등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingCustomDoc(false)
    }
  }

  const applyCustomDocumentFiles = (files: File[]) => {
    const incomingFiles = files.filter(Boolean)
    if (incomingFiles.length === 0) {
      setCustomDocFiles([])
      setCustomDocFile(null)
      setCustomDocDrafts([])
      return
    }

    const toKey = (file: File) => `${file.name}::${file.size}::${file.lastModified}`

    setCustomDocFiles((prev) => {
      const merged = [...prev]
      const seen = new Set(prev.map(toKey))
      for (const file of incomingFiles) {
        const key = toKey(file)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(file)
      }

      setCustomDocFile(merged[0] || null)
      setCustomDocDrafts((prevDrafts) => {
        const titleMap = new Map(prevDrafts.map((draft) => [toKey(draft.file), draft.title]))
        return merged.map((file) => ({
          file,
          title: titleMap.get(toKey(file)) ?? toSuggestedDocumentTitle(file.name),
        }))
      })
      return merged
    })
  }

  const issueCustomDocumentAction = async (
    documentId: number,
    mode: 'preview' | 'download',
    fileName: string
  ) => {
    if (mode === 'preview' && !getCustomDocumentPreviewUrlFn) {
      toast.error('미리보기 URL API가 아직 준비되지 않았습니다.')
      return
    }
    if (mode === 'download' && !getCustomDocumentDownloadUrlFn) {
      toast.error('다운로드 URL API가 아직 준비되지 않았습니다.')
      return
    }
    try {
      if (mode === 'preview') {
        const res = await getCustomDocumentPreviewUrlFn!(companyId, documentId)
        window.open(res.preview_url, '_blank', 'noopener,noreferrer')
      } else {
        const res = await getCustomDocumentDownloadUrlFn!(companyId, documentId)
        const resolvedFileName = fileName || res.file_name
        try {
          await downloadFileViaBlob(res.download_url, resolvedFileName)
        } catch {
          const link = document.createElement('a')
          link.href = res.download_url
          link.download = resolvedFileName
          link.target = '_blank'
          link.rel = 'noreferrer'
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
        setCustomDocuments((prev) =>
          prev.map((doc) => (doc.id === documentId ? { ...doc, downloadCount: doc.downloadCount + 1 } : doc))
        )
      }
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 URL 발급에 실패했습니다.')
    }
  }

  const handleDeleteCustomDocument = async (documentId: number) => {
    if (!deleteCustomDocumentFn) {
      toast.error('커스텀 문서 삭제 API가 아직 준비되지 않았습니다.')
      return
    }
    if (!confirm('등록된 기타 관련 서류를 삭제하시겠습니까?\n삭제 시 휴지통으로 이동됩니다.')) return
    try {
      await deleteCustomDocumentFn(companyId, documentId)
      toast.success('문서가 삭제되었습니다.')
      await loadCustomDocuments()
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCreateCompanyAccount = async () => {
    const loginId = companyAccountForm.login_id.trim()
    const password = companyAccountForm.password
    if (!loginId || !password) {
      toast.error('로그인 아이디와 비밀번호를 입력해 주세요.')
      return
    }

    try {
      setSavingCompanyAccount(true)
      await createCompanyAccountFn({
        company_id: companyId,
        login_id: loginId,
        password,
      })
      toast.success('고객사 계정이 등록되었습니다.')
      setCompanyAccountForm({ login_id: '', password: '' })
      await loadCompanyAccount()
    } catch (error) {
      toast.error(extractApiDetail(error) || '고객사 계정 등록에 실패했습니다.')
    } finally {
      setSavingCompanyAccount(false)
    }
  }

  const handleToggleCompanyAccountStatus = async () => {
    if (!companyAccount) return
    const nextStatus: CompanyAccountStatus = companyAccount.status === 'active' ? 'inactive' : 'active'
    try {
      setSavingCompanyAccount(true)
      const updated = await updateCompanyAccountStatusFn(companyAccount.id, nextStatus)
      setCompanyAccount(updated)
      toast.success(nextStatus === 'active' ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '고객사 계정 상태 변경에 실패했습니다.')
    } finally {
      setSavingCompanyAccount(false)
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">회사 정보를 불러오는 중...</div>
  }
  if (!form) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">회사 정보를 찾을 수 없습니다.</div>
  }

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Section
            title="기본 정보"
            action={
              <div className="flex items-center gap-3">
                {supportsHometax ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                      hasHometaxRegistered
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-zinc-300 bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    홈택스 {hasHometaxRegistered ? '등록됨' : '미등록'}
                  </span>
                ) : null}
                {isCreateMode && createFn ? (
                  <button
                    onClick={async () => {
                      try {
                        setSaving(true)
                        const payload: CompanyCreateRequest = {
                          company_name: form.company_name?.trim() || '',
                          owner_name: form.owner_name?.trim() || '',
                          registration_number: form.registration_number?.trim() || '',
                          category: form.category?.trim() || undefined,
                          industry_type: form.industry_type?.trim() || undefined,
                          business_type: form.business_type?.trim() || undefined,
                          postal_code: form.postal_code?.trim() || undefined,
                          address1: form.address1?.trim() || undefined,
                          address2: form.address2?.trim() || undefined,
                        }
                        await createFn(payload)
                        toast.success('등록이 완료되었습니다.')
                        router.push(listPath)
                      } catch (err: any) {
                        toast.error(err?.response?.data?.detail || '등록 실패')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    disabled={saving}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {saving ? '등록 중...' : '등록완료'}
                  </button>
                ) : editable && updateFn ? (
                  <>
                    <span className="text-sm font-medium text-zinc-700">수정</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editMode}
                      onClick={() => setEditMode((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        editMode ? 'bg-blue-500' : 'bg-zinc-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                          editMode ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {editMode ? (
                      <button
                        onClick={async () => {
                          try {
                            setSaving(true)
                            const { id: _id, created_at, updated_at, ...payload } = form
                            const res = await updateFn(companyId, payload)
                            toast.success(res.message || '수정이 완료되었습니다.')
                            const refreshed = await fetchDetailFn(companyId)
                            setForm(refreshed)
                            setEditMode(false)
                          } catch (err: any) {
                            toast.error(err.response?.data?.detail || '수정 실패')
                          } finally {
                            setSaving(false)
                          }
                        }}
                        disabled={saving}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                      >
                        {saving ? '저장 중...' : '수정완료'}
                      </button>
                    ) : null}
                  </>
                ) : null}
                </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="회사명">
                <input className={editableInputClass} value={form.company_name} readOnly={!canEditFields} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </Field>
              <Field label="대표자">
                <input className={editableInputClass} value={form.owner_name} readOnly={!canEditFields} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
              </Field>
              <Field label="구분">
                <select className={editableInputClass} value={form.category || ''} disabled={!canEditFields} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">선택</option>
                  <option value="법인">법인</option>
                  <option value="개인">개인</option>
                </select>
              </Field>
              <Field label="사업자등록번호">
                <input
                  className={editableInputClass}
                  value={form.registration_number || ''}
                  readOnly={!canEditFields}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      registration_number: formatBusinessRegistrationNumber(e.target.value),
                    })
                  }
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="000-00-00000"
                />
              </Field>
              <Field label="업태">
                <input className={editableInputClass} value={form.industry_type || ''} readOnly={!canEditFields} onChange={(e) => setForm({ ...form, industry_type: e.target.value })} />
              </Field>
              <Field label="종목">
                <input className={editableInputClass} value={form.business_type || ''} readOnly={!canEditFields} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
              </Field>
              <div className="xl:col-span-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_auto_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label="우편번호">
                    <input
                      className={editableInputClass}
                      value={form.postal_code || ''}
                      readOnly={!canEditFields}
                      onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    />
                  </Field>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700">우편번호검색</label>
                    <button
                      type="button"
                      disabled={!canEditFields}
                      onClick={() => setAddressSearchOpen(true)}
                      className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      <Search size={14} />
                      검색
                    </button>
                  </div>
                  <Field label="주소1">
                    <input
                      className={editableInputClass}
                      value={form.address1 || ''}
                      readOnly={!canEditFields}
                      onChange={(e) => setForm({ ...form, address1: e.target.value })}
                    />
                  </Field>
                  <Field label="주소2">
                    <input
                      className={editableInputClass}
                      value={form.address2 || ''}
                      readOnly={!canEditFields}
                      onChange={(e) => setForm({ ...form, address2: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Section>
          <KakaoAddressSearchModal
            open={addressSearchOpen}
            onClose={() => setAddressSearchOpen(false)}
            onSelect={(item) =>
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      postal_code: item.postal_code || prev.postal_code,
                      address1: item.address1 || prev.address1,
                      address2: item.address2 || prev.address2,
                    }
                  : prev
              )
            }
          />

          {showSystemInfo ? (
            <Section title="시스템 정보">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="활성 상태">
                  <input className={`${inputClass} bg-zinc-100`} value="활성중" readOnly />
                </Field>
                <Field label="등록일">
                  <input className={`${inputClass} bg-zinc-100`} value={toDateOnly(form.created_at)} readOnly />
                </Field>
                <Field label="수정일">
                  <input className={`${inputClass} bg-zinc-100`} value={toDateOnly(form.updated_at)} readOnly />
                </Field>
              </div>
            </Section>
          ) : null}

          {supportsCompanyAccount ? (
            <Section
              title="고객사 계정"
              action={
                companyAccount ? (
                  <button
                    type="button"
                    onClick={handleToggleCompanyAccountStatus}
                    disabled={savingCompanyAccount}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {savingCompanyAccount ? '처리 중...' : companyAccount.status === 'active' ? '비활성화' : '활성화'}
                  </button>
                ) : null
              }
            >
              {loadingCompanyAccount ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                  고객사 계정 정보를 불러오는 중...
                </div>
              ) : companyAccount ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="로그인 아이디">
                    <input className={`${inputClass} bg-zinc-100`} value={companyAccount.login_id} readOnly />
                  </Field>
                  <Field label="상태">
                    <div className="flex h-10 items-center rounded-lg border border-zinc-300 bg-zinc-100 px-3">
                      {companyAccount.status === 'active' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          비활성
                        </span>
                      )}
                    </div>
                  </Field>
                  <Field label="마지막 로그인">
                    <input className={`${inputClass} bg-zinc-100`} value={toDateTime(companyAccount.last_login_at)} readOnly />
                  </Field>
                  <Field label="등록일">
                    <input className={`${inputClass} bg-zinc-100`} value={toDateTime(companyAccount.created_at)} readOnly />
                  </Field>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <Field label="로그인 아이디">
                      <input
                        className={inputClass}
                        value={companyAccountForm.login_id}
                        onChange={(e) => setCompanyAccountForm((prev) => ({ ...prev, login_id: e.target.value }))}
                        placeholder="로그인 아이디 입력"
                      />
                    </Field>
                    <Field label="비밀번호">
                      <input
                        type="password"
                        className={inputClass}
                        value={companyAccountForm.password}
                        onChange={(e) => setCompanyAccountForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="비밀번호 입력"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={handleCreateCompanyAccount}
                      disabled={savingCompanyAccount}
                      className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60 md:min-w-[120px]"
                    >
                      {savingCompanyAccount ? '등록 중...' : '계정 생성'}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          ) : null}

          {supportsHometax ? (
            <Section
              title="홈택스 정보"
              action={
                <div className="flex items-center gap-2">
                  {hasHometaxRegistered ? (
                    <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      등록됨
                    </div>
                  ) : (
                    <div className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      미등록
                    </div>
                  )}
                  <span className="text-xs text-zinc-500">{hometaxExpanded ? '펼침' : '접힘'}</span>
                  <button
                    type="button"
                    onClick={() => setHometaxExpanded((prev) => !prev)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {hometaxExpanded ? '접기 ▴' : '펼치기 ▾'}
                  </button>
                </div>
              }
            >
              {hometaxExpanded ? (
                <div className="space-y-4">
                  {loadingHometax ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                      홈택스 정보를 불러오는 중...
                    </div>
                  ) : null}
                  {!hasHometaxRegistered && supportsHometaxWrite ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="홈택스 아이디">
                          <input
                            className={inputClass}
                            value={hometaxForm.hometax_login_id}
                            onChange={(e) => setHometaxForm((prev) => ({ ...prev, hometax_login_id: e.target.value }))}
                          />
                        </Field>
                        <Field label="홈택스 비밀번호">
                          <input
                            type="password"
                            className={inputClass}
                            value={hometaxForm.hometax_password}
                            onChange={(e) => setHometaxForm((prev) => ({ ...prev, hometax_password: e.target.value }))}
                          />
                        </Field>
                        <Field label="활성 상태">
                          <select
                            className={inputClass}
                            value={hometaxForm.is_active ? 'active' : 'inactive'}
                            disabled={!supportsHometaxActivePatch}
                            onChange={(e) => handlePatchHometaxActive(e.target.value === 'active')}
                          >
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                          </select>
                        </Field>
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={handleUpsertHometax}
                          disabled={savingHometax}
                          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                        >
                          {savingHometax ? '저장 중...' : '홈택스 정보 저장'}
                        </button>
                      </div>
                    </>
                  ) : null}
                  {!hasHometaxRegistered && !supportsHometaxWrite ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                      홈택스 등록/수정 권한이 없습니다.
                    </div>
                  ) : null}

                  {supportsHometaxReveal ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-600">정보 확인 시 본인 계정 비밀번호 재입력이 필요합니다.</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                        <input
                          type="password"
                          className={inputClass}
                          placeholder="본인 계정 비밀번호 입력"
                          value={revealAccountPassword}
                          onChange={(e) => setRevealAccountPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleRevealHometax}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          정보 확인
                        </button>
                      </div>
                      {revealedHometaxPassword !== null ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input
                            className={`${inputClass} bg-white`}
                            value={`아이디: ${hometaxCredential?.hometax_login_id || hometaxForm.hometax_login_id}`}
                            readOnly
                          />
                          <input
                            className={`${inputClass} bg-white`}
                            value={`비밀번호: ${revealedHometaxPassword}`}
                            readOnly
                          />
                        </div>
                      ) : null}
                      {revealedCount !== null ? (
                        <p className="mt-2 text-xs text-zinc-500">정보 확인 누적 횟수: {revealedCount}</p>
                      ) : null}
                      {hometaxCredential?.enc_key_version ? (
                        <p className="mt-1 text-xs text-zinc-400">암호화 키 버전: {hometaxCredential.enc_key_version}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                      홈택스 평문 확인 권한이 없습니다.
                    </div>
                  )}

                  {supportsHometaxLogs ? (
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
                        조회 이력
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-white text-zinc-500">
                          <tr>
                            <th className="border-b border-zinc-200 px-3 py-2 text-left">시각</th>
                            <th className="border-b border-zinc-200 px-3 py-2 text-center">액션</th>
                            <th className="border-b border-zinc-200 px-3 py-2 text-center">주체</th>
                            <th className="border-b border-zinc-200 px-3 py-2 text-left">IP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {loadingHometaxLogs ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                                로그를 불러오는 중...
                              </td>
                            </tr>
                          ) : hometaxLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                                로그가 없습니다.
                              </td>
                            </tr>
                          ) : (
                            hometaxLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="px-3 py-2 text-zinc-700">{toDateTime(log.created_at)}</td>
                                <td className="px-3 py-2 text-center text-zinc-700">{log.action}</td>
                                <td className="px-3 py-2 text-center text-zinc-700">{log.actor_type}</td>
                                <td className="px-3 py-2 text-zinc-500">{log.ip || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                      홈택스 조회 이력 확인 권한이 없습니다.
                    </div>
                  )}
                </div>
              ) : null}
            </Section>
          ) : null}

          {enableCustomDocuments ? (
            <Section title="기타 관련 서류">
              <div className="space-y-4">
                {supportsCustomDocumentWrite ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(280px,1fr)_minmax(240px,320px)] md:grid-rows-[auto_auto]">
                    <div className="md:row-span-2">
                      <input
                        ref={customDocFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => applyCustomDocumentFiles(Array.from(e.target.files || []))}
                      />
                      <FileDropzone
                        onFilesDrop={(files) => applyCustomDocumentFiles(Array.from(files))}
                        onClick={() => customDocFileInputRef.current?.click()}
                        className="flex h-full min-h-[92px] cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-sm transition"
                        idleClassName="border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                        activeClassName="border-zinc-500 bg-zinc-100 text-zinc-900"
                        title={
                          customDocFiles.length > 1
                            ? `${customDocFiles.length}개 파일 선택됨`
                            : customDocFile?.name || '파일 드래그 또는 클릭 선택'
                        }
                      >
                        <span className="max-w-[440px] truncate">
                          {customDocFiles.length > 1
                            ? `${customDocFiles.length}개 파일 선택됨`
                            : customDocFile?.name || '파일 드래그 또는 클릭 선택'}
                        </span>
                      </FileDropzone>
                    </div>

                    <div className="max-h-[140px] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      {customDocDrafts.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-zinc-500">파일을 선택하면 목록과 문서이름 입력칸이 표시됩니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {customDocDrafts.map((draft, index) => (
                            <div key={`${draft.file.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(160px,220px)] items-center gap-2">
                              <div className="truncate text-xs text-zinc-700" title={draft.file.name}>
                                {draft.file.name}
                              </div>
                              <input
                                className={`${inputClass} h-8 text-xs`}
                                placeholder="문서이름"
                                value={draft.title}
                                onChange={(e) =>
                                  setCustomDocDrafts((prev) =>
                                    prev.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, title: e.target.value } : item
                                    )
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {customDocFile ? (
                        <>
                        <button
                          type="button"
                          onClick={() => {
                            applyCustomDocumentFiles([])
                            if (customDocFileInputRef.current) customDocFileInputRef.current.value = ''
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomDocument}
                          disabled={uploadingCustomDoc || !supportsCustomDocumentWrite}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {uploadingCustomDoc ? '등록 중...' : customDocFiles.length > 1 ? '일괄등록' : '등록'}
                        </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {supportsCustomDocumentWrite && customDocFiles.length > 1 && !supportsCustomDocumentBulkWrite ? (
                  <p className="text-xs text-amber-600">현재 환경은 다건 API 미연동 상태입니다. 첫 파일만 등록됩니다.</p>
                ) : null}

                {supportsCustomDocumentRead && !supportsCustomDocumentWrite ? (
                  <p className="text-xs text-zinc-500">읽기 전용 권한입니다. 미리보기/다운로드만 가능합니다.</p>
                ) : null}

                {!supportsCustomDocumentRead ? (
                  <p className="text-xs text-zinc-500">커스텀 문서 API 연동 전입니다.</p>
                ) : null}

                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">문서이름</th>
                        <th className="px-3 py-2 text-center">업로드일자</th>
                        <th className="px-3 py-2 text-center">새창에서보기</th>
                        <th className="px-3 py-2 text-center">다운로드</th>
                        <th className="px-3 py-2 text-center">다운로드횟수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {loadingCustomDocs ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                            불러오는 중...
                          </td>
                        </tr>
                      ) : sortedCustomDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                            업로드된 기타 관련 서류가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        sortedCustomDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td className="px-3 py-2 text-zinc-900">{doc.title}</td>
                            <td className="px-3 py-2 text-center text-zinc-700">{toDateTime(doc.uploadedAt)}</td>
                            <td className="px-3 py-2 text-center">
                              {isPreviewableCustomDocument(doc.fileName) ? (
                                <button
                                  type="button"
                                  onClick={() => issueCustomDocumentAction(doc.id, 'preview', doc.fileName)}
                                  className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                                >
                                  새창에서보기
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => issueCustomDocumentAction(doc.id, 'download', doc.fileName)}
                                className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                              >
                                다운로드
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center text-zinc-700">
                              <div className="flex items-center justify-center gap-2">
                                <span>{doc.downloadCount}</span>
                                {supportsCustomDocumentWrite ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomDocument(doc.id)}
                                    className="inline-flex h-7 items-center rounded border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50"
                                  >
                                    삭제
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          ) : null}
        </div>
        <div className="w-full xl:col-span-2 xl:max-w-[500px] xl:justify-self-start">
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="px-5 py-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">문서 목록</p>
                  <button
                    type="button"
                    onClick={() => setDocumentsExpanded((prev) => !prev)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    {documentsExpanded ? '접기 ▴' : '펼치기 ▾'}
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  3개 필수 문서 외 다른 문서는 스크롤을 내려서 등록해 주세요.
                </p>

                {supportsDocumentUpload ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)] md:grid-rows-[auto_auto]">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                      className="hidden"
                      onChange={(e) => setSelectedDocumentFile(e.target.files?.[0] || null)}
                    />
                    <div className="md:row-span-2">
                      <FileDropzone
                        onFilesDrop={(files) => setSelectedDocumentFile(files[0] || null)}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-full min-h-[88px] cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-sm transition"
                        idleClassName={
                          selectedDocumentFile
                            ? 'border-emerald-300 bg-emerald-50 text-zinc-600 animate-[pulse_1.8s_ease-in-out_infinite]'
                            : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                        }
                        activeClassName="border-zinc-500 bg-zinc-100 text-zinc-900"
                      >
                        <span className={selectedDocumentFile ? 'font-semibold' : undefined}>
                          {selectedDocumentFile ? selectedDocumentFile.name : '파일을 드래그 하거나 클릭해서 선택하세요'}
                        </span>
                      </FileDropzone>
                    </div>
                    <select
                      className={`${inputClass} h-10`}
                      value={selectedUploadDocType}
                      onChange={(e) => setSelectedUploadDocType(e.target.value)}
                    >
                      {resolvedDocumentTypes.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={uploadingDocument || !selectedDocumentFile}
                      onClick={handleUploadBusinessLicense}
                      className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {uploadingDocument ? '등록 중...' : '등록'}
                    </button>
                  </div>
                ) : null}
                {isCreateMode ? (
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-xs text-zinc-500">
                    회사 등록 후 문서 업로드/미리보기가 가능합니다.
                  </div>
                ) : null}

                {documentsExpanded ? (
                  <div className="overflow-hidden rounded-lg border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-xs text-zinc-600">
                        <tr>
                          <th className="px-3 py-2 text-left">문서명</th>
                          <th className="px-3 py-2 text-center">상태</th>
                          <th className="px-3 py-2 text-center">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {resolvedDocumentTypes.map((item) => {
                          const checked = previewCheckedDocCodes.has(item.code)
                          const hasPreview = Boolean(documentPreviews[item.code]?.preview_url)
                          const statusLabel = hasPreview ? '등록됨' : checked ? '미등록' : '확인 전'
                          const statusClass = hasPreview
                            ? 'bg-emerald-50 text-emerald-700'
                            : checked
                              ? 'bg-zinc-100 text-zinc-500'
                              : 'bg-blue-50 text-blue-700'
                          return (
                            <tr key={item.code}>
                              <td className="px-3 py-2 text-zinc-900">{item.label}</td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`rounded px-2 py-1 text-xs ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenDocumentPreview(item.code)}
                                    className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                                  >
                                    미리보기
                                  </button>
                                  {supportsDocumentDelete ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDocument(item.code)}
                                      disabled={!hasPreview || deletingDocumentCode === item.code}
                                      className="inline-flex h-7 items-center rounded border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                    >
                                      {deletingDocumentCode === item.code ? '삭제 중...' : '삭제'}
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {activePreview?.preview_url ? (
                  <div className="space-y-2">
                    <div className="aspect-[3/4] min-h-[520px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                      {isImageFile(activePreview.file_name) ? (
                        <img
                          src={activePreview.preview_url}
                          alt="문서 미리보기"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <object
                          data={buildPreviewSrc(activePreview.preview_url, activePreview.file_name)}
                          type="application/pdf"
                          className="h-full w-full"
                        >
                          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
                            미리보기를 불러오지 못했습니다. 아래 버튼으로 새 창에서 확인해 주세요.
                          </div>
                        </object>
                      )}
                    </div>
                    <a
                      href={activePreview.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      새 창에서 보기
                    </a>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                    선택한 문서의 미리보기가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
