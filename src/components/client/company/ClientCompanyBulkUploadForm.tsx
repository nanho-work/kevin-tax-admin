'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import FileDropzone from '@/components/common/FileDropzone'
import {
  commitClientCompanyBulkUpload,
  previewClientCompanyBulkUpload,
  type ClientCompanyBulkCommitResponse,
  type ClientCompanyBulkPreviewResponse,
} from '@/services/client/company'
import { getApiErrorMessageFromDetail } from '@/utils/apiError'

const ALLOWED_BULK_EXTENSIONS = ['.xlsx', '.xls', '.csv']

function isAllowedBulkFile(name: string) {
  const lower = name.toLowerCase()
  return ALLOWED_BULK_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function formatBulkStatus(status: string) {
  if (status === 'valid') return '검증완료'
  if (status === 'invalid') return '검증실패'
  if (status === 'created') return '등록완료'
  if (status === 'failed') return '등록실패'
  return status
}

export default function ClientCompanyBulkUploadForm() {
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkPreview, setBulkPreview] = useState<ClientCompanyBulkPreviewResponse | null>(null)
  const [bulkCommitResult, setBulkCommitResult] = useState<ClientCompanyBulkCommitResponse | null>(null)
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false)
  const [bulkCommitLoading, setBulkCommitLoading] = useState(false)

  const handleBulkFileSelect = (file: File | null) => {
    if (!file) return
    if (!isAllowedBulkFile(file.name)) {
      setError('엑셀/CSV 파일(.xlsx, .xls, .csv)만 업로드할 수 있습니다.')
      return
    }
    setError('')
    setSuccess('')
    setBulkFile(file)
    setBulkPreview(null)
    setBulkCommitResult(null)
  }

  const handleBulkDrop = (files: FileList) => {
    handleBulkFileSelect(files?.[0] || null)
  }

  const handleBulkPreview = async () => {
    if (!bulkFile) {
      setError('일괄등록 파일을 먼저 선택해 주세요.')
      return
    }
    setError('')
    setSuccess('')
    setBulkPreviewLoading(true)
    try {
      const preview = await previewClientCompanyBulkUpload(bulkFile)
      setBulkPreview(preview)
      setBulkCommitResult(null)
    } catch (err: any) {
      setError(getApiErrorMessageFromDetail(err?.response?.data?.detail, '일괄등록 프리뷰 실패'))
      setBulkPreview(null)
    } finally {
      setBulkPreviewLoading(false)
    }
  }

  const handleBulkCommit = async () => {
    if (!bulkFile) {
      setError('일괄등록 파일을 먼저 선택해 주세요.')
      return
    }
    if (!bulkPreview) {
      setError('프리뷰 검증을 먼저 진행해 주세요.')
      return
    }
    setError('')
    setSuccess('')
    setBulkCommitLoading(true)
    try {
      const result = await commitClientCompanyBulkUpload(bulkFile)
      setBulkCommitResult(result)
      setSuccess(`일괄등록 완료: ${result.created_count}건 등록, ${result.failed_count}건 실패`)
      if (result.created_count > 0) {
        setBulkFile(null)
        setBulkPreview(null)
      }
    } catch (err: any) {
      setError(getApiErrorMessageFromDetail(err?.response?.data?.detail, '일괄등록 커밋 실패'))
      setBulkCommitResult(null)
    } finally {
      setBulkCommitLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">거래처 일괄등록</h2>
          <p className="mt-1 text-xs text-zinc-500">엑셀/CSV 파일을 검증한 뒤 한 번에 등록합니다.</p>
        </div>
        <Link
          href="/client/companies"
          className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          목록으로
        </Link>
      </div>

      {(error || success) && (
        <div
          className={
            success
              ? 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700'
              : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'
          }
        >
          {success || error}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <FileDropzone
          onFilesDrop={handleBulkDrop}
          onClick={() => bulkFileInputRef.current?.click()}
          className="h-10"
          idleClassName="rounded-lg border border-zinc-300 bg-white"
          activeClassName="rounded-lg border border-sky-300 bg-sky-50"
          disabled={bulkPreviewLoading || bulkCommitLoading}
        >
          <button
            type="button"
            disabled={bulkPreviewLoading || bulkCommitLoading}
            className="w-full truncate px-3 text-left text-xs text-zinc-600 disabled:cursor-not-allowed"
          >
            {bulkFile ? bulkFile.name : '파일을 드래그하거나 클릭하여 선택'}
          </button>
        </FileDropzone>
        <input
          ref={bulkFileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleBulkFileSelect(e.target.files?.[0] || null)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBulkPreview}
            disabled={!bulkFile || bulkPreviewLoading || bulkCommitLoading}
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkPreviewLoading ? '검증 중...' : '프리뷰'}
          </button>
          <button
            type="button"
            onClick={handleBulkCommit}
            disabled={!bulkPreview || bulkPreviewLoading || bulkCommitLoading}
            className="inline-flex h-9 items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkCommitLoading ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      {bulkPreview ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <div className="text-xs text-zinc-600">
            총 {bulkPreview.total_rows}행 · 검증완료 {bulkPreview.valid_rows}행 · 검증실패 {bulkPreview.invalid_rows}행
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-zinc-200">
            <table className="min-w-full table-auto text-xs">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-2 py-2 text-center">행</th>
                  <th className="px-2 py-2 text-center">회사명</th>
                  <th className="px-2 py-2 text-center">대표자</th>
                  <th className="px-2 py-2 text-center">사업자번호</th>
                  <th className="px-2 py-2 text-center">상태</th>
                  <th className="px-2 py-2 text-center">사유</th>
                </tr>
              </thead>
              <tbody>
                {bulkPreview.rows.map((row) => (
                  <tr key={`preview-${row.row_no}-${row.registration_number ?? row.company_name ?? ''}`} className="border-t border-zinc-100">
                    <td className="px-2 py-2 text-center">{row.row_no}</td>
                    <td className="px-2 py-2 text-center">{row.company_name || '-'}</td>
                    <td className="px-2 py-2 text-center">{row.owner_name || '-'}</td>
                    <td className="px-2 py-2 text-center">{row.registration_number || '-'}</td>
                    <td className="px-2 py-2 text-center">{formatBulkStatus(row.status)}</td>
                    <td className="px-2 py-2 text-center text-rose-600">{row.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {bulkCommitResult ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <div className="text-xs text-zinc-600">
            총 {bulkCommitResult.total_rows}행 · 등록완료 {bulkCommitResult.created_count}행 · 등록실패 {bulkCommitResult.failed_count}행
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-zinc-200">
            <table className="min-w-full table-auto text-xs">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-2 py-2 text-center">행</th>
                  <th className="px-2 py-2 text-center">회사명</th>
                  <th className="px-2 py-2 text-center">사업자번호</th>
                  <th className="px-2 py-2 text-center">상태</th>
                  <th className="px-2 py-2 text-center">사유</th>
                </tr>
              </thead>
              <tbody>
                {bulkCommitResult.rows.map((row) => (
                  <tr key={`commit-${row.row_no}-${row.registration_number ?? row.company_name ?? ''}`} className="border-t border-zinc-100">
                    <td className="px-2 py-2 text-center">{row.row_no}</td>
                    <td className="px-2 py-2 text-center">{row.company_name || '-'}</td>
                    <td className="px-2 py-2 text-center">{row.registration_number || '-'}</td>
                    <td className="px-2 py-2 text-center">{formatBulkStatus(row.status)}</td>
                    <td className="px-2 py-2 text-center text-rose-600">{row.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
