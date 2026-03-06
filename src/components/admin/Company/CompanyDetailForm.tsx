'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { fetchCompanyDetail } from '@/services/admin/company'
import type { CompanyDetailResponse, CompanyUpdateRequest } from '@/types/admin_campany'
import type { CompanyDocumentPreviewResponse } from '@/services/admin/company'

interface Props {
  company: CompanyDetailResponse
  businessLicensePreview?: CompanyDocumentPreviewResponse | null
  documentTypes?: { code: string; label: string }[]
  enableCustomDocuments?: boolean
  editable?: boolean
  listPath?: string
  fetchDetailFn?: (company_id: number) => Promise<CompanyDetailResponse>
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
}

type LocalCustomDocument = {
  id: number
  title: string
  fileName: string
  uploadedAt: string
  downloadCount: number
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

export default function CompanyDetailForm({
  company,
  businessLicensePreview = null,
  documentTypes,
  enableCustomDocuments = false,
  editable = true,
  listPath = '/admin/companies',
  fetchDetailFn = fetchCompanyDetail,
  updateFn,
  fetchBusinessLicensePreviewFn,
  uploadBusinessLicenseFn,
  deleteBusinessLicenseFn,
  fetchDocumentPreviewFn,
  uploadDocumentFn,
  deleteDocumentFn,
  listCustomDocumentsFn,
  uploadCustomDocumentFn,
  deleteCustomDocumentFn,
  getCustomDocumentDownloadUrlFn,
  getCustomDocumentPreviewUrlFn,
  listCustomDocumentLogsFn,
}: Props) {
  const { id } = useParams()
  const companyId = Number(id)
  const [form, setForm] = useState<CompanyDetailResponse | null>(null)
  const resolvedDocumentTypes = documentTypes?.length
    ? documentTypes
    : [{ code: 'business_license', label: '사업자등록증' }]
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, CompanyDocumentPreviewResponse | null>>(
    {}
  )
  const [activePreviewDocType, setActivePreviewDocType] = useState<string>(resolvedDocumentTypes[0].code)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [deletingDocumentCode, setDeletingDocumentCode] = useState<string | null>(null)
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null)
  const [selectedUploadDocType, setSelectedUploadDocType] = useState<string>(resolvedDocumentTypes[0].code)
  const [isDragOverDocument, setIsDragOverDocument] = useState(false)
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [customDocTypeInput, setCustomDocTypeInput] = useState('')
  const [customDocFile, setCustomDocFile] = useState<File | null>(null)
  const [isDragOverCustomDoc, setIsDragOverCustomDoc] = useState(false)
  const [customDocuments, setCustomDocuments] = useState<LocalCustomDocument[]>([])
  const [loadingCustomDocs, setLoadingCustomDocs] = useState(false)
  const [uploadingCustomDoc, setUploadingCustomDoc] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const customDocFileInputRef = useRef<HTMLInputElement | null>(null)

  const activePreview = documentPreviews[activePreviewDocType] || null
  const supportsDocumentCrud = Boolean(uploadDocumentFn || uploadBusinessLicenseFn)
  const supportsCustomDocumentCrud =
    Boolean(listCustomDocumentsFn) &&
    Boolean(uploadCustomDocumentFn) &&
    Boolean(deleteCustomDocumentFn) &&
    Boolean(getCustomDocumentDownloadUrlFn) &&
    Boolean(getCustomDocumentPreviewUrlFn)
  const sortedCustomDocuments = useMemo(
    () =>
      [...customDocuments].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    [customDocuments]
  )

  const extractApiDetail = (error: unknown): string | null => {
    const detail = (error as any)?.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg
    return null
  }

  useEffect(() => {
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
    if (companyId) load()
  }, [companyId, fetchDetailFn])

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

  const reloadAllDocumentPreviews = async () => {
    const entries = await Promise.all(
      resolvedDocumentTypes.map(async (item) => [item.code, await fetchPreviewByDocType(item.code)] as const)
    )
    setDocumentPreviews(Object.fromEntries(entries))
  }

  useEffect(() => {
    if (!companyId) return
    const initialMap: Record<string, CompanyDocumentPreviewResponse | null> = {}
    if (businessLicensePreview) {
      initialMap.business_license = businessLicensePreview
    }
    setDocumentPreviews(initialMap)
    void reloadAllDocumentPreviews()
  }, [companyId, businessLicensePreview])

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
    void loadCustomDocuments()
  }, [companyId, enableCustomDocuments, listCustomDocumentsFn])

  const handleUploadBusinessLicense = async () => {
    if (!selectedUploadDocType) {
      toast.error('문서이름을 먼저 선택해 주세요.')
      return
    }
    if (!supportsDocumentCrud) return
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
      await reloadAllDocumentPreviews()
      setActivePreviewDocType(selectedUploadDocType)
      toast.success('문서가 등록되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingDocument(false)
      setSelectedDocumentFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
    const title = customDocTypeInput.trim()
    if (!title) {
      toast.error('문서이름을 입력해 주세요.')
      return
    }
    if (!customDocFile) {
      toast.error('업로드할 파일을 선택해 주세요.')
      return
    }

    try {
      setUploadingCustomDoc(true)
      await uploadCustomDocumentFn(companyId, { title, file: customDocFile })
      setCustomDocTypeInput('')
      setCustomDocFile(null)
      if (customDocFileInputRef.current) customDocFileInputRef.current.value = ''
      toast.success('기타 관련 서류가 등록되었습니다.')
      await loadCustomDocuments()
    } catch (error) {
      toast.error(extractApiDetail(error) || '기타 관련 서류 등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingCustomDoc(false)
    }
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
        const link = document.createElement('a')
        link.href = res.download_url
        link.download = fileName || res.file_name
        link.target = '_blank'
        link.rel = 'noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
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
    if (!confirm('등록된 기타 관련 서류를 삭제하시겠습니까?')) return
    try {
      await deleteCustomDocumentFn(companyId, documentId)
      toast.success('문서가 삭제되었습니다.')
      await loadCustomDocuments()
    } catch (error) {
      toast.error(extractApiDetail(error) || '문서 삭제 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">회사 정보를 불러오는 중...</div>
  }
  if (!company || !form) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">회사 정보를 찾을 수 없습니다.</div>
  }

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Section
            title="기본 정보"
            action={
              editable && updateFn ? (
                <button
                  onClick={async () => {
                    try {
                      setSaving(true)
                      const { id: _id, created_at, updated_at, ...payload } = form
                      const res = await updateFn(companyId, payload)
                      toast.success(res.message || '수정이 완료되었습니다.')
                      const refreshed = await fetchDetailFn(companyId)
                      setForm(refreshed)
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
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="회사명">
                <input className={inputClass} value={form.company_name} readOnly={!editable} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </Field>
              <Field label="대표자">
                <input className={inputClass} value={form.owner_name} readOnly={!editable} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
              </Field>
              <Field label="사업자등록번호">
                <input className={inputClass} value={form.registration_number || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
              </Field>
              <Field label="구분">
                <select className={inputClass} value={form.category || ''} disabled={!editable} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">선택</option>
                  <option value="법인">법인</option>
                  <option value="개인">개인</option>
                </select>
              </Field>
              <Field label="업태">
                <input className={inputClass} value={form.industry_type || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, industry_type: e.target.value })} />
              </Field>
              <Field label="종목">
                <input className={inputClass} value={form.business_type || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section title="주소 정보">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="우편번호">
                <input className={inputClass} value={form.postal_code || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
              </Field>
              <Field label="주소1">
                <input className={inputClass} value={form.address1 || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
              </Field>
              <Field label="주소2">
                <input className={inputClass} value={form.address2 || ''} readOnly={!editable} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              </Field>
            </div>
          </Section>

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

          {enableCustomDocuments ? (
            <Section title="기타 관련 서류">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className={inputClass}
                    placeholder="문서이름입력 (예: 주주명부)"
                    value={customDocTypeInput}
                    onChange={(e) => setCustomDocTypeInput(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={customDocFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setCustomDocFile(e.target.files?.[0] || null)}
                    />
                    <label
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragOverCustomDoc(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setIsDragOverCustomDoc(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragOverCustomDoc(false)
                        setCustomDocFile(e.dataTransfer.files?.[0] || null)
                      }}
                      onClick={() => customDocFileInputRef.current?.click()}
                      className={`inline-flex h-10 min-w-[170px] cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-sm transition ${
                        isDragOverCustomDoc
                          ? 'border-zinc-500 bg-zinc-100 text-zinc-900'
                          : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      파일 드래그 또는 클릭 선택
                    </label>
                    <span className="truncate text-xs text-zinc-500" title={customDocFile?.name || ''}>
                      {customDocFile?.name || '선택된 파일 없음'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomDocument}
                    disabled={uploadingCustomDoc || !supportsCustomDocumentCrud}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {uploadingCustomDoc ? '등록 중...' : '등록'}
                  </button>
                </div>

                {!supportsCustomDocumentCrud ? (
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
                              <button
                                type="button"
                                onClick={() => issueCustomDocumentAction(doc.id, 'preview', doc.fileName)}
                                className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                              >
                                새창에서보기
                              </button>
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
                                {supportsCustomDocumentCrud ? (
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

                {editable && supportsDocumentCrud ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                      className="hidden"
                      onChange={(e) => setSelectedDocumentFile(e.target.files?.[0] || null)}
                    />
                    <label
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragOverDocument(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setIsDragOverDocument(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragOverDocument(false)
                        setSelectedDocumentFile(e.dataTransfer.files?.[0] || null)
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed px-3 text-sm transition ${
                        isDragOverDocument
                          ? 'border-zinc-500 bg-zinc-100 text-zinc-900'
                          : 'border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {selectedDocumentFile ? selectedDocumentFile.name : '파일을 드래그 하거나 클릭해서 선택하세요'}
                    </label>
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
                          const hasPreview = Boolean(documentPreviews[item.code]?.preview_url)
                          return (
                            <tr key={item.code}>
                              <td className="px-3 py-2 text-zinc-900">{item.label}</td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`rounded px-2 py-1 text-xs ${
                                    hasPreview ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                                  }`}
                                >
                                  {hasPreview ? '등록됨' : '미등록'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hasPreview) {
                                        toast.error('등록된 파일이 없습니다.')
                                        return
                                      }
                                      setActivePreviewDocType(item.code)
                                    }}
                                    className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                                  >
                                    미리보기
                                  </button>
                                  {editable && supportsDocumentCrud ? (
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
