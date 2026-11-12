'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Download } from 'lucide-react'
import {
  fetchAdminDocsEntryDownloadUrl, fetchAdminDocsEntryPreviewUrl, fetchAdminDocsSpreadsheetPreview,
  type DocsSpreadsheetPreview,
} from '@/services/admin/adminDocsService'
import { getTaskBoardErrorMessage, type TaskItemDocLink } from '@/services/workflowTaskBoard'
import { toast } from 'react-hot-toast'

export default function PayrollFilePreview({ doc }: { doc: TaskItemDocLink }) {
  const name = doc.file_name || doc.title || `문서 #${doc.docs_entry_id}`
  const type = doc.content_type ?? ''
  const pdf = type === 'application/pdf' || /\.pdf$/i.test(name)
  const image = type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)
  const spreadsheet = /\.(xlsx|xlsm|xltx|xltm|xls|csv)$/i.test(name)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [preview, setPreview] = useState<DocsSpreadsheetPreview | string | null>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!pdf && !image && !spreadsheet) return
    let active = true
    setPreview(null)
    setError('')
    const request = spreadsheet
      ? fetchAdminDocsSpreadsheetPreview(doc.docs_entry_id, sheetIndex)
      : fetchAdminDocsEntryPreviewUrl(doc.docs_entry_id).then(result => result.preview_url)
    void request.then(result => {
      if (!active) return
      if (typeof result !== 'string') setSheetNames(result.sheets)
      setPreview(result)
    }).catch(error => { if (active) setError(getTaskBoardErrorMessage(error)) })
    return () => { active = false }
  }, [doc.docs_entry_id, pdf, image, spreadsheet, sheetIndex])

  const download = async () => {
    setDownloading(true)
    try {
      const { download_url } = await fetchAdminDocsEntryDownloadUrl(doc.docs_entry_id)
      const link = document.createElement('a')
      link.href = download_url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    } catch (error) {
      toast.error(getTaskBoardErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section aria-label="파일 미리보기" className="flex min-h-[17rem] flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 py-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-zinc-800" title={name}>{name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {typeof preview === 'string' && (
            <a href={preview} target="_blank" rel="noopener noreferrer" aria-label="새 창에서 보기" title="새 창에서 보기"
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100"><ArrowUpRight size={16} aria-hidden="true" /></a>
          )}
          <button type="button" disabled={downloading} onClick={() => void download()} aria-label="다운로드" title="다운로드"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
            <Download size={16} aria-hidden="true" /><span className="hidden sm:inline">다운로드</span>
          </button>
        </div>
      </div>
      {sheetNames.length > 1 && (
        <div className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2">
          <select aria-label="미리 볼 시트" className="max-w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            value={sheetIndex} onChange={event => { setPreview(null); setError(''); setSheetIndex(Number(event.target.value)) }}>
            {sheetNames.map((sheet, index) => <option key={sheet} value={index}>{sheet}</option>)}
          </select>
        </div>
      )}
      {error ? <p role="alert" className="p-4 text-sm text-zinc-600">{error}</p>
        : typeof preview === 'string' ? (
          pdf ? (
            <div className="relative min-h-0 flex-1">
              <object data={`${preview.split('#')[0]}#view=FitH&zoom=page-width&toolbar=0&navpanes=0`}
                type="application/pdf" aria-label={`${name} 미리보기`} className="absolute inset-0 block h-full w-full">
                <p className="p-4 text-sm text-zinc-600">PDF를 새 창에서 보거나 내려받을 수 있습니다.</p>
              </object>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={`${name} 미리보기`} className="absolute inset-0 h-full w-full object-contain p-2"
                onError={() => setError('이미지를 불러오지 못했습니다. 내려받아 확인해 주세요.')} />
            </div>
          )
        ) : preview ? (
          <>
            {preview.truncated && <p className="shrink-0 px-3 py-1.5 text-xs text-zinc-500">최대 100행 · 30열 미리보기</p>}
            {preview.rows.length ? (
              <div className="min-h-0 flex-1 overflow-auto">
                <table aria-label={`${name} 미리보기`} className="w-full border-separate border-spacing-0 bg-white text-xs">
                  <tbody>{preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="even:bg-zinc-50">
                      <th scope="row" className="sticky left-0 w-9 border-b border-r border-zinc-200 bg-zinc-100 px-2 py-1.5 text-right font-normal tabular-nums text-zinc-500">{rowIndex + 1}</th>
                      {row.map((value, columnIndex) => <td key={columnIndex} title={value} className="max-w-64 truncate border-b border-r border-zinc-200 px-2 py-1.5">{value}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="p-3 text-sm text-zinc-600">이 시트에 표시할 내용이 없습니다.</p>}
          </>
        ) : <p role="status" className="p-4 text-sm text-zinc-600">
          {pdf || image || spreadsheet ? '미리보기를 불러오는 중…' : '이 형식은 다운로드해서 확인할 수 있습니다.'}
        </p>}
    </section>
  )
}
