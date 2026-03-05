'use client'

import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { fetchCompanyDetail } from '@/services/admin/company'
import type { CompanyDetailResponse, CompanyUpdateRequest } from '@/types/admin_campany'
import type { CompanyDocumentPreviewResponse } from '@/services/admin/company'

interface Props {
  company: CompanyDetailResponse
  businessLicensePreview?: CompanyDocumentPreviewResponse | null
  editable?: boolean
  listPath?: string
  fetchDetailFn?: (company_id: number) => Promise<CompanyDetailResponse>
  updateFn?: (company_id: number, payload: CompanyUpdateRequest) => Promise<{ message: string }>
  fetchBusinessLicensePreviewFn?: (company_id: number) => Promise<CompanyDocumentPreviewResponse>
  uploadBusinessLicenseFn?: (company_id: number, file: File) => Promise<unknown>
  deleteBusinessLicenseFn?: (company_id: number) => Promise<unknown>
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
  editable = true,
  listPath = '/admin/companies',
  fetchDetailFn = fetchCompanyDetail,
  updateFn,
  fetchBusinessLicensePreviewFn,
  uploadBusinessLicenseFn,
  deleteBusinessLicenseFn,
}: Props) {
  const { id } = useParams()
  const companyId = Number(id)
  const router = useRouter()
  const [form, setForm] = useState<CompanyDetailResponse | null>(null)
  const [localPreview, setLocalPreview] = useState<CompanyDocumentPreviewResponse | null>(businessLicensePreview)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState(false)
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null)
  const [isDragOverDocument, setIsDragOverDocument] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  useEffect(() => {
    setLocalPreview(businessLicensePreview)
  }, [businessLicensePreview])

  const reloadBusinessLicensePreview = async () => {
    if (!fetchBusinessLicensePreviewFn) return
    try {
      const preview = await fetchBusinessLicensePreviewFn(companyId)
      setLocalPreview(preview)
    } catch {
      setLocalPreview(null)
    }
  }

  const handleUploadBusinessLicense = async () => {
    if (!uploadBusinessLicenseFn) return
    if (!selectedDocumentFile) {
      toast.error('업로드할 파일을 먼저 선택해 주세요.')
      return
    }
    try {
      setUploadingDocument(true)
      await uploadBusinessLicenseFn(companyId, selectedDocumentFile)
      await reloadBusinessLicensePreview()
      toast.success('사업자등록증이 등록되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '사업자등록증 등록 중 오류가 발생했습니다.')
    } finally {
      setUploadingDocument(false)
      setSelectedDocumentFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteBusinessLicense = async () => {
    if (!localPreview) return
    if (!deleteBusinessLicenseFn) {
      toast.error('문서 삭제 API가 아직 준비되지 않았습니다.')
      return
    }
    if (!confirm('등록된 사업자등록증을 삭제하시겠습니까?')) return
    try {
      setDeletingDocument(true)
      await deleteBusinessLicenseFn(companyId)
      setLocalPreview(null)
      toast.success('사업자등록증이 삭제되었습니다.')
    } catch (error) {
      toast.error(extractApiDetail(error) || '사업자등록증 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingDocument(false)
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
        </div>
        <div className="w-full xl:col-span-2 xl:max-w-[500px] xl:justify-self-start">
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="px-5 py-5">
            {localPreview?.preview_url ? (
              <div className="space-y-3">
                {editable ? (
                  <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingDocument || !selectedDocumentFile}
                        onClick={handleUploadBusinessLicense}
                        className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {uploadingDocument ? '등록 중...' : '등록'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteBusinessLicense}
                        disabled={deletingDocument}
                        className="inline-flex h-8 items-center rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        {deletingDocument ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="aspect-[3/4] min-h-[520px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  {isImageFile(localPreview.file_name) ? (
                    <img
                      src={localPreview.preview_url}
                      alt="사업자등록증 미리보기"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <object
                      data={buildPreviewSrc(localPreview.preview_url, localPreview.file_name)}
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
                  href={localPreview.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  새 창에서 보기
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {editable ? (
                  <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingDocument || !selectedDocumentFile}
                        onClick={handleUploadBusinessLicense}
                        className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {uploadingDocument ? '등록 중...' : '등록'}
                      </button>
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-400"
                        title="등록된 문서가 없습니다."
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                  등록된 사업자등록증이 없습니다.
                </div>
              </div>
            )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
