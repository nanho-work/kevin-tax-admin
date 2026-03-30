'use client'

import { useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  listClientIndustryRateVersions,
  previewClientIndustryRates,
  uploadClientIndustryRates,
} from '@/services/client/clientConsultToolService'
import { getApiErrorMessage } from '@/utils/apiError'

type ParsedPreview = {
  type: 'csv' | 'json'
  rows: number
  columns: string[]
}

type PreviewRateRow = {
  industryCode: string
  rate: Record<string, unknown>
}

const PREVIEW_RATE_KEY_ORDER = [
  'industryName',
  'simpleRateGeneral',
  'simpleRateExcess',
  'standardRateGeneral',
  'middleCategory',
  'subCategory',
  'detailCategory',
  'applyCriteria',
] as const

const PREVIEW_RATE_KEY_LABEL: Record<string, string> = {
  industryName: '업태명',
  simpleRateGeneral: '단순경비율(일반율)',
  simpleRateExcess: '단순경비율(초과율)',
  standardRateGeneral: '기준경비율(일반율)',
  middleCategory: '중분류',
  subCategory: '세분류',
  detailCategory: '세세분류',
  applyCriteria: '적용기준내용',
}

function parseCsvPreview(text: string): ParsedPreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return { type: 'csv', rows: 0, columns: [] }
  }
  const columns = lines[0].split(',').map((v) => v.trim())
  return {
    type: 'csv',
    rows: Math.max(0, lines.length - 1),
    columns,
  }
}

function parseJsonPreview(text: string): ParsedPreview {
  const parsed = JSON.parse(text) as unknown
  if (Array.isArray(parsed)) {
    const first = parsed[0]
    const columns =
      first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first as Record<string, unknown>) : []
    return {
      type: 'json',
      rows: parsed.length,
      columns,
    }
  }
  if (parsed && typeof parsed === 'object') {
    return { type: 'json', rows: 1, columns: Object.keys(parsed as Record<string, unknown>) }
  }
  return { type: 'json', rows: 0, columns: [] }
}

export default function ClientExpenseRateBasePage() {
  const currentYear = new Date().getFullYear()
  const [taxYear, setTaxYear] = useState(currentYear)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedPreview | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeVersions, setActiveVersions] = useState<
    Array<{ taxYear: number; sourceFileName: string; rowCount: number; updatedAt: string }>
  >([])
  const [selectedYearForPreview, setSelectedYearForPreview] = useState<number | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRateRow[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)

  const acceptedText = useMemo(() => 'CSV 또는 JSON 파일만 업로드 가능합니다.', [])

  const loadActiveVersions = async () => {
    setLoadingVersions(true)
    try {
      const data = await listClientIndustryRateVersions(true)
      setActiveVersions(
        (data.items || []).map((item) => ({
          taxYear: item.tax_year,
          sourceFileName: item.source_file_name,
          rowCount: item.row_count,
          updatedAt: item.updated_at,
        }))
      )
    } catch {
      setActiveVersions([])
    } finally {
      setLoadingVersions(false)
    }
  }

  const loadPreviewRows = async (year: number) => {
    setLoadingRows(true)
    try {
      const res = await previewClientIndustryRates({ taxYear: year, limit: 5 })
      const rows = (res.rows || []).map((row) => {
        return {
          industryCode: row.industry_code || '-',
          rate: (row.rate || {}) as Record<string, unknown>,
        }
      })
      setPreviewRows(rows)
      setSelectedYearForPreview(year)
    } catch (error) {
      setPreviewRows([])
      toast.error(getApiErrorMessage(error, '미리보기를 불러오지 못했습니다.'))
    } finally {
      setLoadingRows(false)
    }
  }

  useEffect(() => {
    void loadActiveVersions()
  }, [])

  useEffect(() => {
    if (selectedYearForPreview !== null) return
    const first = activeVersions[0]
    if (!first) return
    setTaxYear(first.taxYear)
    void loadPreviewRows(first.taxYear)
  }, [activeVersions, selectedYearForPreview])

  const previewRateColumns = useMemo(() => {
    const keys = new Set<string>()
    previewRows.forEach((row) => {
      Object.keys(row.rate || {}).forEach((key) => keys.add(key))
    })
    const ordered = PREVIEW_RATE_KEY_ORDER.filter((key) => keys.has(key))
    const rest = Array.from(keys).filter(
      (key) => !PREVIEW_RATE_KEY_ORDER.includes(key as (typeof PREVIEW_RATE_KEY_ORDER)[number])
    )
    return [...ordered, ...rest]
  }, [previewRows])

  const readAndPreview = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'json') {
      toast.error('CSV 또는 JSON 파일만 업로드할 수 있습니다.')
      return
    }
    setLoadingPreview(true)
    setSelectedFile(file)
    try {
      const text = await file.text()
      if (ext === 'csv') {
        setPreview(parseCsvPreview(text))
      } else {
        setPreview(parseJsonPreview(text))
      }
      toast.success('파일을 불러왔습니다.')
    } catch {
      setPreview(null)
      toast.error('파일 미리보기 파싱에 실패했습니다.')
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">기준 단순 경비율 등록</h2>
        <p className="mt-1 text-xs text-zinc-500">
          국가 공시 데이터(CSV/JSON)를 업로드해 기준 단순 경비율을 갱신합니다. (슈퍼클라이언트 전용)
        </p>
        <div className="mt-3 rounded-md border border-zinc-200 p-3">
          <p className="text-xs font-medium text-zinc-700">활성 연도</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {loadingVersions ? (
              <span className="text-xs text-zinc-500">조회 중...</span>
            ) : activeVersions.length === 0 ? (
              <span className="text-xs text-zinc-500">활성화된 업로드 연도가 없습니다.</span>
            ) : (
              activeVersions.map((item) => (
                <button
                  key={item.taxYear}
                  type="button"
                  onClick={() => {
                    setTaxYear(item.taxYear)
                    void loadPreviewRows(item.taxYear)
                  }}
                  className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition ${
                    selectedYearForPreview === item.taxYear
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {item.taxYear}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-zinc-600">
                <th className="w-20 px-3 py-2 text-center font-medium">No</th>
                <th className="w-40 px-3 py-2 text-center font-medium">업종코드</th>
                {previewRateColumns.map((columnKey) => (
                  <th key={columnKey} className="min-w-[140px] px-3 py-2 text-center font-medium">
                    {PREVIEW_RATE_KEY_LABEL[columnKey] || columnKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr className="border-t border-zinc-100">
                  <td colSpan={2 + previewRateColumns.length} className="px-3 py-3 text-center text-zinc-500">
                    미리보기를 불러오는 중입니다.
                  </td>
                </tr>
              ) : previewRows.length === 0 ? (
                <tr className="border-t border-zinc-100">
                  <td colSpan={2 + previewRateColumns.length} className="px-3 py-3 text-center text-zinc-500">
                    선택한 연도의 미리보기 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                previewRows.map((row, index) => (
                  <tr key={`${row.industryCode}-${index}`} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-center text-zinc-500">{index + 1}</td>
                    <td className="px-3 py-2 text-center text-zinc-800">{row.industryCode}</td>
                    {previewRateColumns.map((columnKey) => (
                      <td
                        key={`${row.industryCode}-${index}-${columnKey}`}
                        className="px-3 py-2 text-center text-zinc-800"
                      >
                        {row.rate?.[columnKey] == null ? (
                          '-'
                        ) : columnKey === 'applyCriteria' ? (
                          <span
                            className="mx-auto block max-w-[280px] whitespace-normal break-words text-center"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                            title={String(row.rate[columnKey])}
                          >
                            {String(row.rate[columnKey])}
                          </span>
                        ) : (
                          String(row.rate[columnKey])
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor="expense-rate-tax-year" className="text-sm font-medium text-zinc-700">
            귀속연도
          </label>
          <input
            id="expense-rate-tax-year"
            type="number"
            min={2000}
            max={2100}
            value={taxYear}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (!Number.isFinite(next)) return
              setTaxYear(next)
            }}
            className="h-9 w-28 rounded-md border border-zinc-300 px-2 text-sm text-zinc-800"
          />
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files?.[0]
            if (!file) return
            void readAndPreview(file)
          }}
          className={`flex min-h-44 flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? 'border-sky-400 bg-sky-50' : 'border-zinc-300 bg-zinc-50'
          }`}
        >
          <Upload className="h-7 w-7 text-zinc-400" />
          <p className="mt-2 text-sm font-medium text-zinc-700">파일을 드래그하거나 직접 선택하세요</p>
          <p className="mt-1 text-xs text-zinc-500">{acceptedText}</p>

          <label className="mt-3 inline-flex">
            <input
              type="file"
              accept=".csv,.json,application/json,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void readAndPreview(file)
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100">
              파일 선택
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-sm font-semibold text-zinc-900">미리보기</p>
        {!selectedFile ? (
          <p className="mt-2 text-sm text-zinc-500">선택된 파일이 없습니다.</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-md border border-zinc-200">
            <table className="min-w-full table-fixed text-sm">
              <tbody>
                <tr className="border-b border-zinc-100">
                  <th className="w-40 bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-600">파일명</th>
                  <td className="px-3 py-2 font-medium text-zinc-900">{selectedFile.name}</td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <th className="bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-600">유형</th>
                  <td className="px-3 py-2 text-zinc-800">{preview?.type?.toUpperCase() || '-'}</td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <th className="bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-600">데이터 행 수</th>
                  <td className="px-3 py-2 text-zinc-800">{preview?.rows ?? '-'}</td>
                </tr>
                <tr>
                  <th className="bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-600">컬럼 수</th>
                  <td className="px-3 py-2 text-zinc-800">{preview?.columns?.length ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedFile(null)
              setPreview(null)
            }}
            disabled={!selectedFile || loadingPreview || uploading}
          >
            초기화
          </UiButton>
          <UiButton
            size="sm"
            onClick={async () => {
              if (!selectedFile) return
              if (!Number.isFinite(taxYear) || taxYear < 2000 || taxYear > 2100) {
                toast.error('귀속연도는 2000~2100 범위여야 합니다.')
                return
              }
              setUploading(true)
              try {
                const result = await uploadClientIndustryRates(taxYear, selectedFile)
                toast.success(result.message || '기준 단순 경비율 파일이 등록되었습니다.')
                await loadActiveVersions()
                await loadPreviewRows(taxYear)
              } catch (error) {
                toast.error(getApiErrorMessage(error, '기준 단순 경비율 등록에 실패했습니다.'))
              } finally {
                setUploading(false)
              }
            }}
            disabled={!selectedFile || loadingPreview || uploading}
          >
            {uploading ? '등록 중...' : '등록'}
          </UiButton>
        </div>
      </div>
    </section>
  )
}
