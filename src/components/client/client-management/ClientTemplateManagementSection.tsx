'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  createClientTemplateCode,
  listClientTemplates,
  updateClientTemplateCode,
  uploadClientTemplateFileByCode,
} from '@/services/client/clientTemplateService'
import type { SupervisorTemplateCodeOut } from '@/types/clientTemplate'
import TemplateDownloadButton from '@/components/client/templates/TemplateDownloadButton'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'

const ALLOWED_EXCEL_EXTENSIONS = ['.xls', '.xlsx', '.xlsm', '.xltx', '.xltm']

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

export default function ClientTemplateManagementSection() {
  const [rows, setRows] = useState<SupervisorTemplateCodeOut[]>([])
  const [loading, setLoading] = useState(false)
  const { session, loading: checkingRole } = useClientSessionContext()
  const isSuperManager = session?.role_level === 0
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({})
  const [uploadingCode, setUploadingCode] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    description: '',
    file_key: '',
    is_active: true,
  })
  const [editForm, setEditForm] = useState({
    template_id: 0,
    name: '',
    description: '',
    file_key: '',
    is_active: true,
  })

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [rows])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const res = await listClientTemplates()
      setRows(res.items || [])
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '템플릿 목록을 불러오지 못했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  const handleSelectFile = (code: string, file: File | null) => {
    setFileMap((prev) => ({ ...prev, [code]: file }))
  }

  const handleUpload = async (code: string) => {
    const file = fileMap[code]
    if (!file) {
      toast.error('업로드할 파일을 먼저 선택해 주세요.')
      return
    }
    const lowerFileName = file.name.toLowerCase()
    const canUpload = ALLOWED_EXCEL_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))
    if (!canUpload) {
      toast.error('엑셀 파일(.xls, .xlsx, .xlsm, .xltx, .xltm)만 업로드할 수 있습니다.')
      return
    }

    try {
      setUploadingCode(code)
      const res = await uploadClientTemplateFileByCode(code, file)
      toast.success(res.message || '템플릿 파일이 업로드되었습니다.')
      setFileMap((prev) => ({ ...prev, [code]: null }))
      await loadTemplates()
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '템플릿 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingCode(null)
    }
  }

  const handleCreateTemplateCode = async () => {
    const code = createForm.code.trim().toUpperCase()
    const name = createForm.name.trim()
    if (!code || !name) {
      toast.error('코드와 품목명은 필수입니다.')
      return
    }

    try {
      setSavingTemplate(true)
      await createClientTemplateCode({
        code,
        name,
        description: createForm.description.trim() || null,
        file_key: createForm.file_key.trim() || null,
        is_active: createForm.is_active,
      })
      toast.success('템플릿 코드가 등록되었습니다.')
      setCreateForm({
        code: '',
        name: '',
        description: '',
        file_key: '',
        is_active: true,
      })
      await loadTemplates()
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '템플릿 코드 등록 중 오류가 발생했습니다.')
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleLoadEditTarget = (row: SupervisorTemplateCodeOut) => {
    setEditForm({
      template_id: row.id,
      name: row.name,
      description: row.description || '',
      file_key: row.file_key || '',
      is_active: row.is_active,
    })
  }

  const handleUpdateTemplateCode = async () => {
    if (!editForm.template_id) {
      toast.error('수정할 템플릿을 먼저 선택해 주세요.')
      return
    }
    if (!editForm.name.trim()) {
      toast.error('품목명은 필수입니다.')
      return
    }

    try {
      setSavingTemplate(true)
      await updateClientTemplateCode(editForm.template_id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        file_key: editForm.file_key.trim() || null,
        is_active: editForm.is_active,
      })
      toast.success('템플릿 코드가 수정되었습니다.')
      await loadTemplates()
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : '템플릿 코드 수정 중 오류가 발생했습니다.')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">샘플양식 업로드</h2>
          <button
            type="button"
            onClick={() => void loadTemplates()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            새로고침
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          다운로드는 모든 클라이언트 세션에서 가능하며, 업로드는 슈퍼관리자(level 0)만 가능합니다.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1020px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-3 py-3 text-center">코드</th>
              <th className="px-3 py-3 text-center">품목명</th>
              <th className="px-3 py-3 text-center">설명</th>
              <th className="px-3 py-3 text-center">상태</th>
              <th className="px-3 py-3 text-center">수정일</th>
              <th className="px-3 py-3 text-center">다운로드</th>
              <th className="px-3 py-3 text-center">업로드(슈퍼)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading || checkingRole ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  조회 중...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                  등록된 템플릿이 없습니다.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-center">{row.code}</td>
                  <td className="px-3 py-3 text-center">{row.name}</td>
                  <td className="px-3 py-3 text-center">{row.description || '-'}</td>
                  <td className="px-3 py-3 text-center">{row.is_active ? '활성' : '비활성'}</td>
                  <td className="px-3 py-3 text-center">{formatDateTime(row.updated_at)}</td>
                  <td className="px-3 py-3 text-center">
                    <TemplateDownloadButton code={row.code} label="다운로드" className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50" />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isSuperManager ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadEditTarget(row)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          편집
                        </button>
                        <label className="cursor-pointer rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">
                          파일선택
                          <input
                            type="file"
                            accept=".xls,.xlsx,.xlsm,.xltx,.xltm"
                            className="hidden"
                            onChange={(e) => handleSelectFile(row.code, e.target.files?.[0] || null)}
                          />
                        </label>
                        <span className="max-w-[180px] truncate text-xs text-zinc-500" title={fileMap[row.code]?.name || ''}>
                          {fileMap[row.code]?.name || '선택된 파일 없음'}
                        </span>
                        <button
                          type="button"
                          disabled={uploadingCode === row.code}
                          onClick={() => void handleUpload(row.code)}
                          className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {uploadingCode === row.code ? '업로드 중...' : '업로드'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">권한 없음</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isSuperManager ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">템플릿 코드 등록</h3>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="코드 (예: BOOKKEEPING_CONTRACT_BULK)"
                value={createForm.code}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
              />
              <input
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="품목명"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="file_key (선택)"
                value={createForm.file_key}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, file_key: e.target.value }))}
              />
              <textarea
                className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="설명 (선택)"
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                활성
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={savingTemplate}
                onClick={() => void handleCreateTemplateCode()}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingTemplate ? '저장 중...' : '코드 등록'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">템플릿 코드 수정</h3>
            <div className="mt-2 text-xs text-zinc-500">리스트에서 편집 버튼을 눌러 대상을 선택하세요.</div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input
                className="h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500"
                readOnly
                value={editForm.template_id ? String(editForm.template_id) : ''}
                placeholder="template_id"
              />
              <input
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="품목명"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="file_key (선택)"
                value={editForm.file_key}
                onChange={(e) => setEditForm((prev) => ({ ...prev, file_key: e.target.value }))}
              />
              <textarea
                className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                placeholder="설명 (선택)"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                활성
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={savingTemplate || !editForm.template_id}
                onClick={() => void handleUpdateTemplateCode()}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingTemplate ? '저장 중...' : '코드 수정'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
