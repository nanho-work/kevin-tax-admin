'use client'

import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Download, PaintBucket, Square, Type } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  acquireAdminSheetLock,
  acquireAdminSheetRowLock,
  createAdminSheetFromDocEntry,
  createAdminSheetRow,
  deleteAdminSheetRow,
  exportAdminSheetXlsx,
  fetchAdminSheetDetail,
  fetchAdminSheetRows,
  getAdminSheetsErrorMessage,
  heartbeatAdminSheetLock,
  heartbeatAdminSheetRowLock,
  patchAdminSheetColumns,
  patchAdminSheetColumnWidths,
  patchAdminSheetRow,
  patchAdminSheetStyles,
  releaseAdminSheetLock,
  releaseAdminSheetRowLock,
} from '@/services/admin/adminSheetsService'
import type { AdminSheetCellStyle, AdminSheetRow } from '@/types/adminSheets'

type SaveState = 'saved' | 'saving' | 'error'
const SHEET_ROWS_PAGE_SIZE = 200
type ContextMenuTargetType = 'row' | 'column' | 'cell'
type ContextMenuState = {
  open: boolean
  x: number
  y: number
  targetType: ContextMenuTargetType
  rowId?: number
  colIndex?: number
}

type SheetApiErrorDetail = {
  code?: string
  message?: string
  row_id?: number
  expected_row_version?: number
  current_row_version?: number
}

type SheetCellStyleValue = {
  align?: 'left' | 'center' | 'right'
  font_family?: string
  font_size?: number
  font_weight?: 'normal' | 'bold'
  color?: string
  fill_color?: string
  border_top?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
  border_right?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
  border_bottom?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
  border_left?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
  number_format?: 'general' | 'number_comma' | 'date_ymd_dash'
}

type NumberFormatType = 'general' | 'number_comma' | 'date_ymd_dash'

function toTextValue(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

function formatDisplayValueByNumberFormat(value: unknown, numberFormat?: NumberFormatType): string {
  const raw = toTextValue(value)
  if (!numberFormat || numberFormat === 'general') return raw
  if (numberFormat === 'number_comma') {
    const parsed = Number(raw.replaceAll(',', ''))
    if (!Number.isFinite(parsed)) return raw
    return new Intl.NumberFormat('ko-KR').format(parsed)
  }
  if (numberFormat === 'date_ymd_dash') {
    const compact = raw.replaceAll('-', '').replaceAll('/', '').trim()
    if (/^\d{8}$/.test(compact)) {
      return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    }
    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  return raw
}

function getSheetApiErrorDetail(error: unknown): SheetApiErrorDetail | null {
  const detail = (error as any)?.response?.data?.detail
  if (!detail || typeof detail !== 'object') return null
  return detail as SheetApiErrorDetail
}

function saveBlobAsFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function getColumnLabel(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const mod = (n - 1) % 26
    label = String.fromCharCode(65 + mod) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function buildCellStyleKey(rowId: number, colKey: string): string {
  return `${rowId}:${colKey}`
}

function toCellStyleMap(items: AdminSheetCellStyle[]): Record<string, SheetCellStyleValue> {
  const next: Record<string, SheetCellStyleValue> = {}
  for (const item of items || []) {
    if (!item?.row_id || !item?.col_key) continue
    next[buildCellStyleKey(item.row_id, item.col_key)] = { ...(item.style || {}) }
  }
  return next
}

function borderCss(style: SheetCellStyleValue, side: 'top' | 'right' | 'bottom' | 'left'): string | undefined {
  const key = `border_${side}` as const
  const border = style[key]
  if (!border) return undefined
  if (border === 'none') return 'none'
  return `1px ${border} #64748b`
}

function toInlineCellStyle(style: SheetCellStyleValue | undefined): CSSProperties | undefined {
  if (!style) return undefined
  const css: CSSProperties = {}
  if (style.align) css.textAlign = style.align
  if (style.font_family) css.fontFamily = style.font_family
  if (typeof style.font_size === 'number') css.fontSize = `${style.font_size}px`
  if (style.font_weight) css.fontWeight = style.font_weight
  if (style.color) css.color = style.color
  if (style.fill_color) css.backgroundColor = style.fill_color
  const borderTop = borderCss(style, 'top')
  const borderRight = borderCss(style, 'right')
  const borderBottom = borderCss(style, 'bottom')
  const borderLeft = borderCss(style, 'left')
  if (borderTop) css.borderTop = borderTop
  if (borderRight) css.borderRight = borderRight
  if (borderBottom) css.borderBottom = borderBottom
  if (borderLeft) css.borderLeft = borderLeft
  return Object.keys(css).length > 0 ? css : undefined
}

export default function AdminDocsExcelEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const entryId = useMemo(() => Number(params?.id || 0), [params?.id])

  const [loading, setLoading] = useState(true)
  const [sheetId, setSheetId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [rows, setRows] = useState<AdminSheetRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [hasMoreRows, setHasMoreRows] = useState(false)
  const [cellStyleMap, setCellStyleMap] = useState<Record<string, SheetCellStyleValue>>({})
  const [lockToken, setLockToken] = useState<string | null>(null)
  const [rowLock, setRowLock] = useState<{ rowId: number; lockToken: string } | null>(null)
  const [readOnlyMode] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [draftValues, setDraftValues] = useState<Record<number, Record<string, string>>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [activeCell, setActiveCell] = useState<{ rowId: number; colIndex: number } | null>(null)
  const [activeColumnIndex, setActiveColumnIndex] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [columnHeaderDrafts, setColumnHeaderDrafts] = useState<string[]>([])
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [externallyLockedRowIds, setExternallyLockedRowIds] = useState<number[]>([])
  const [autoColumnDrafts, setAutoColumnDrafts] = useState<Record<number, string>>({})
  const [autoRowDraft, setAutoRowDraft] = useState<Record<string, string>>({})
  const [fontColor, setFontColor] = useState('#111827')
  const [fillColor, setFillColor] = useState('#ffffff')
  const [numberFormat, setNumberFormat] = useState<NumberFormatType>('general')

  const heartbeatFailedRef = useRef(false)
  const flushInFlightRef = useRef(false)
  const resizeInFlightRef = useRef(false)
  const rowLockRef = useRef<{ rowId: number; lockToken: string } | null>(null)
  const fillColorInputRef = useRef<HTMLInputElement | null>(null)
  const fontColorInputRef = useRef<HTMLInputElement | null>(null)
  const cellInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const rowsContainerRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRowsRef = useRef(false)

  const loadSheetMeta = useCallback(async (targetSheetId: number) => {
    const detail = await fetchAdminSheetDetail(targetSheetId, 1)
    setTitle(detail.document.title || `시트 #${targetSheetId}`)
    setSheetName(detail.document.sheet_name || 'Sheet1')
    setColumns(detail.document.columns || [])
    setColumnWidths(detail.document.column_widths || {})
    setTotalRows(Number(detail.total_rows || 0))
    setCellStyleMap(toCellStyleMap(detail.styles || []))
  }, [])

  const loadSheetRows = useCallback(
    async (targetSheetId: number, opts?: { reset?: boolean; offset?: number }) => {
      const shouldReset = opts?.reset ?? false
      const offset = opts?.offset ?? 0
      setRowsLoading(true)
      try {
        const page = await fetchAdminSheetRows(targetSheetId, {
          offset,
          limit: SHEET_ROWS_PAGE_SIZE,
        })
        const incomingRows = (page.rows || []).sort((a, b) => a.row_order - b.row_order)
        setTotalRows(Number(page.total_rows || 0))
        setRows((prev) => {
          if (shouldReset) return incomingRows
          const map = new Map<number, AdminSheetRow>()
          prev.forEach((row) => map.set(row.id, row))
          incomingRows.forEach((row) => map.set(row.id, row))
          return Array.from(map.values()).sort((a, b) => a.row_order - b.row_order)
        })
        const nextLoadedCount = shouldReset ? incomingRows.length : offset + incomingRows.length
        setHasMoreRows(nextLoadedCount < Number(page.total_rows || 0))
        const detail = await fetchAdminSheetDetail(targetSheetId, Math.max(1, nextLoadedCount))
        const nextStyleMap = toCellStyleMap(detail.styles || [])
        setCellStyleMap((prev) => (shouldReset ? nextStyleMap : { ...prev, ...nextStyleMap }))
        setColumnWidths(detail.document.column_widths || {})
      } finally {
        setRowsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    rowLockRef.current = rowLock
  }, [rowLock])

  const releaseCurrentRowLock = useCallback(async (options?: { rowId?: number }) => {
    if (!sheetId) return
    const current = rowLockRef.current
    if (!current) return
    if (options?.rowId != null && current.rowId !== options.rowId) return
    try {
      await releaseAdminSheetRowLock(sheetId, current.rowId)
    } catch {
      // no-op
    } finally {
      if (rowLockRef.current?.rowId === current.rowId) {
        rowLockRef.current = null
        setRowLock(null)
      }
    }
  }, [sheetId])

  const ensureRowLock = useCallback(
    async (rowId: number, options?: { silent?: boolean }): Promise<string | null> => {
      if (!sheetId || readOnlyMode) return null
      const current = rowLockRef.current
      if (current?.rowId === rowId && current.lockToken) return current.lockToken

      if (current && current.rowId !== rowId) {
        await releaseCurrentRowLock({ rowId: current.rowId })
      }

      try {
        const acquired = await acquireAdminSheetRowLock(sheetId, rowId, { ttl_seconds: 30 })
        const nextToken = (acquired?.lock_token || '').trim()
        if (!acquired?.is_locked || !nextToken) {
          if (!options?.silent) toast.error('행 잠금을 획득하지 못했습니다.')
          return null
        }
        const next = { rowId, lockToken: nextToken }
        rowLockRef.current = next
        setRowLock(next)
        setExternallyLockedRowIds((prev) => prev.filter((id) => id !== rowId))
        return nextToken
      } catch (error) {
        const status = (error as any)?.response?.status
        if (status === 409) {
          setExternallyLockedRowIds((prev) => (prev.includes(rowId) ? prev : [...prev, rowId]))
          if (!options?.silent) toast.error('다른 사용자가 해당 행을 편집 중입니다.')
          return null
        }
        if (!options?.silent) toast.error(getAdminSheetsErrorMessage(error))
        return null
      }
    },
    [readOnlyMode, releaseCurrentRowLock, sheetId]
  )

  const lockAsEditor = useCallback(async (targetSheetId: number) => {
    const lock = await acquireAdminSheetLock(targetSheetId, { ttl_seconds: 30 })
    if (lock.lock_token) {
      setLockToken(lock.lock_token)
      heartbeatFailedRef.current = false
      return
    }
    setLockToken(null)
  }, [])

  const bootstrap = useCallback(async () => {
    if (!Number.isFinite(entryId) || entryId <= 0) {
      toast.error('잘못된 문서 경로입니다.')
      router.replace('/admin/docs')
      return
    }
    setLoading(true)
    try {
      const created = await createAdminSheetFromDocEntry(entryId)
      const nextSheetId = Number(created.sheet_id || 0)
      if (!nextSheetId) {
        toast.error('시트 문서를 생성하지 못했습니다.')
        router.replace('/admin/docs')
        return
      }
      setSheetId(nextSheetId)
      setRows([])
      setCellStyleMap({})
      setColumnWidths({})
      setRowLock(null)
      rowLockRef.current = null
      setExternallyLockedRowIds([])
      setHasMoreRows(false)
      await loadSheetMeta(nextSheetId)
      await loadSheetRows(nextSheetId, { reset: true, offset: 0 })
      try {
        await lockAsEditor(nextSheetId)
      } catch (error) {
        setLockToken(null)
        toast.error('시트 공용 잠금을 획득하지 못했습니다. 행 단위 편집만 가능합니다.')
      }
    } catch (error) {
      toast.error(getAdminSheetsErrorMessage(error))
      router.replace('/admin/docs')
    } finally {
      setLoading(false)
    }
  }, [entryId, loadSheetMeta, loadSheetRows, lockAsEditor, router])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (!sheetId || !lockToken) return
    const timer = window.setInterval(async () => {
      try {
        await heartbeatAdminSheetLock(sheetId, {
          lock_token: lockToken,
          ttl_seconds: 30,
        })
        heartbeatFailedRef.current = false
      } catch (error) {
        if (!heartbeatFailedRef.current) {
          heartbeatFailedRef.current = true
          setLockToken(null)
          toast.error('시트 공용 잠금이 해제되었습니다. 행 단위 편집만 가능합니다.')
        }
      }
    }, 12000)
    return () => window.clearInterval(timer)
  }, [lockToken, sheetId])

  useEffect(() => {
    if (!sheetId || !rowLock?.rowId || !rowLock.lockToken) return
    const timer = window.setInterval(async () => {
      try {
        await heartbeatAdminSheetRowLock(sheetId, rowLock.rowId, {
          lock_token: rowLock.lockToken,
          ttl_seconds: 30,
        })
      } catch (error) {
        rowLockRef.current = null
        setRowLock(null)
        if (activeCell?.rowId === rowLock.rowId) {
          setActiveCell(null)
        }
        toast.error(getAdminSheetsErrorMessage(error))
      }
    }, 12000)
    return () => window.clearInterval(timer)
  }, [activeCell?.rowId, rowLock, sheetId])

  useEffect(() => {
    return () => {
      if (!sheetId) return
      void releaseAdminSheetLock(sheetId).catch(() => undefined)
      const currentRowLock = rowLockRef.current
      if (currentRowLock?.rowId) {
        void releaseAdminSheetRowLock(sheetId, currentRowLock.rowId).catch(() => undefined)
      }
    }
  }, [sheetId])

  useEffect(() => {
    if (!contextMenu?.open) return
    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu?.open])

  useEffect(() => {
    if (columns.length === 0) {
      setActiveColumnIndex(null)
      return
    }
    setActiveColumnIndex((prev) => {
      if (prev == null) return 0
      return Math.min(Math.max(prev, 0), columns.length - 1)
    })
  }, [columns.length])

  useEffect(() => {
    setColumnHeaderDrafts(columns)
  }, [columns])

  useEffect(() => {
    setColumnWidths((prev) => {
      const next: Record<string, number> = {}
      for (const column of columns) {
        const existing = Number(prev[column] || 0)
        next[column] = Number.isFinite(existing) && existing > 0 ? Math.max(72, Math.min(640, existing)) : 140
      }
      return next
    })
  }, [columns])

  const getColumnWidthPx = useCallback(
    (column: string): number => {
      const width = Number(columnWidths[column] || 0)
      if (!Number.isFinite(width) || width <= 0) return 140
      return Math.max(72, Math.min(640, width))
    },
    [columnWidths]
  )

  const loadMoreRows = useCallback(async () => {
    if (!sheetId || loading || rowsLoading || !hasMoreRows) return
    if (loadingMoreRowsRef.current) return
    loadingMoreRowsRef.current = true
    try {
      await loadSheetRows(sheetId, { offset: rows.length })
    } catch (error) {
      toast.error(getAdminSheetsErrorMessage(error))
    } finally {
      loadingMoreRowsRef.current = false
    }
  }, [hasMoreRows, loadSheetRows, loading, rows.length, rowsLoading, sheetId])

  const handleRowsContainerScroll = useCallback(() => {
    const element = rowsContainerRef.current
    if (!element) return
    const remain = element.scrollHeight - element.scrollTop - element.clientHeight
    if (remain < 180) {
      void loadMoreRows()
    }
  }, [loadMoreRows])

  const flushPendingChanges = useCallback(async () => {
    if (flushInFlightRef.current) return
    if (!sheetId) return

    const targetRowIds = Object.keys(draftValues)
      .map((key) => Number(key))
      .filter((id) => Number.isFinite(id) && id > 0)

    if (targetRowIds.length === 0) {
      setSaveState('saved')
      return
    }

    flushInFlightRef.current = true
    setSaveState('saving')
    try {
      let hasConflict = false
      for (const rowId of targetRowIds) {
        const payload = draftValues[rowId]
        if (!payload || Object.keys(payload).length === 0) continue
        const currentRow = rows.find((row) => row.id === rowId)
        if (!currentRow) continue
        const rowLockToken = await ensureRowLock(rowId, { silent: true })
        if (!rowLockToken) {
          hasConflict = true
          continue
        }
        const patched = await patchAdminSheetRow(
          sheetId,
          rowId,
          {
            row_version: Number(currentRow.row_version || 1),
            values: payload,
          },
          rowLockToken
        )
        setRows((prev) => prev.map((row) => (row.id === rowId ? patched : row)))
        setDraftValues((prev) => {
          const next = { ...prev }
          delete next[rowId]
          return next
        })
      }
      setSaveState(hasConflict ? 'error' : 'saved')
      if (hasConflict) {
        toast.error('잠긴 행이 있어 일부 변경을 저장하지 못했습니다.')
      }
    } catch (error) {
      setSaveState('error')
      const status = (error as any)?.response?.status
      const detail = getSheetApiErrorDetail(error)
      if (status === 409 && detail?.code === 'ROW_VERSION_CONFLICT') {
        await loadSheetRows(sheetId, { reset: true, offset: 0 })
        setDraftValues({})
        setActiveCell(null)
        toast.error(detail.message || '다른 사용자가 먼저 수정했습니다. 최신 내용으로 갱신했습니다.')
      } else if (status === 409) {
        rowLockRef.current = null
        setRowLock(null)
        toast.error(getAdminSheetsErrorMessage(error))
      } else {
        toast.error(getAdminSheetsErrorMessage(error))
      }
    } finally {
      flushInFlightRef.current = false
    }
  }, [draftValues, ensureRowLock, loadSheetRows, rows, sheetId])

  const hasPendingChanges = useMemo(() => {
    return Object.values(draftValues).some((rowDraft) => Object.keys(rowDraft || {}).length > 0)
  }, [draftValues])

  useEffect(() => {
    const hasDraft = hasPendingChanges
    if (!hasDraft) {
      if (saveState === 'saving') setSaveState('saved')
      return
    }
    if (readOnlyMode) {
      setSaveState('error')
      return
    }
    const timer = window.setTimeout(() => {
      void flushPendingChanges()
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [flushPendingChanges, hasPendingChanges, readOnlyMode, saveState])

  const handleCellChange = (rowId: number, column: string, value: string) => {
    if (readOnlyMode) return
    if (rowLockRef.current?.rowId !== rowId) return
    setDraftValues((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [column]: value,
      },
    }))
  }

  const focusCell = useCallback(async (rowIndex: number, colIndex: number) => {
    if (rowIndex < 0 || colIndex < 0) return
    const row = rows[rowIndex]
    if (!row) return
    const rowLockToken = await ensureRowLock(row.id, { silent: true })
    if (!rowLockToken) return
    const key = `${row.id}:${colIndex}`
    const input = cellInputRefs.current[key]
    if (!input) return
    input.focus()
    input.select()
    setActiveCell({ rowId: row.id, colIndex })
    setActiveColumnIndex(colIndex)
  }, [ensureRowLock, rows])

  const handleCellKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
      const maxRow = rows.length - 1
      const maxCol = columns.length - 1
      let nextRow = rowIndex
      let nextCol = colIndex

      if (event.key === 'ArrowRight') nextCol = Math.min(maxCol, colIndex + 1)
      else if (event.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1)
      else if (event.key === 'ArrowDown' || event.key === 'Enter') nextRow = Math.min(maxRow, rowIndex + 1)
      else if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1)
      else if (event.key === 'Tab') {
        event.preventDefault()
        if (event.shiftKey) nextCol = colIndex <= 0 ? maxCol : colIndex - 1
        else nextCol = colIndex >= maxCol ? 0 : colIndex + 1
      } else {
        return
      }

      event.preventDefault()
      window.requestAnimationFrame(() => {
        void focusCell(nextRow, nextCol)
      })
    },
    [columns.length, focusCell, rows.length]
  )

  const handleAddRow = async () => {
    if (!sheetId || !lockToken || readOnlyMode || actionLoading) return
    try {
      setActionLoading(true)
      const created = await createAdminSheetRow(sheetId, { values: {} }, lockToken)
      setRows((prev) => [...prev, created].sort((a, b) => a.row_order - b.row_order))
      setTotalRows((prev) => {
        const next = prev + 1
        setHasMoreRows(rows.length + 1 < next)
        return next
      })
    } catch (error) {
      if ((error as any)?.response?.status === 409) {
        setLockToken(null)
      }
      toast.error(getAdminSheetsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRow = async (rowId: number) => {
    if (!sheetId || readOnlyMode || actionLoading) return
    const confirmed = window.confirm('이 행을 삭제하시겠습니까?')
    if (!confirmed) return
    const rowLockToken = await ensureRowLock(rowId)
    if (!rowLockToken) return
    try {
      setActionLoading(true)
      await deleteAdminSheetRow(sheetId, rowId, rowLockToken)
      setRows((prev) => prev.filter((row) => row.id !== rowId))
      setDraftValues((prev) => {
        const next = { ...prev }
        delete next[rowId]
        return next
      })
      setExternallyLockedRowIds((prev) => prev.filter((id) => id !== rowId))
      if (rowLockRef.current?.rowId === rowId) {
        rowLockRef.current = null
        setRowLock(null)
      }
      setTotalRows((prev) => {
        const next = Math.max(0, prev - 1)
        setHasMoreRows(rows.length - 1 < next)
        return next
      })
    } catch (error) {
      if ((error as any)?.response?.status === 409) {
        rowLockRef.current = null
        setRowLock(null)
      }
      toast.error(getAdminSheetsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleExport = async () => {
    if (!sheetId || actionLoading) return
    try {
      setActionLoading(true)
      const downloaded = await exportAdminSheetXlsx(sheetId)
      saveBlobAsFile(downloaded.blob, downloaded.filename)
    } catch (error) {
      toast.error(getAdminSheetsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualSave = async () => {
    if (!hasPendingChanges) return
    await flushPendingChanges()
  }

  const selectedColumnName = useMemo(() => {
    if (activeColumnIndex == null) return null
    if (activeColumnIndex < 0 || activeColumnIndex >= columns.length) return null
    return columns[activeColumnIndex]
  }, [activeColumnIndex, columns])

  const resolveColumnIndexForAction = useCallback((actionLabel: string, preferredIndex?: number | null) => {
    if (columns.length === 0) {
      toast.error('컬럼이 없습니다.')
      return null
    }
    if (preferredIndex != null && preferredIndex >= 0 && preferredIndex < columns.length) {
      return preferredIndex
    }
    if (activeColumnIndex != null && activeColumnIndex >= 0 && activeColumnIndex < columns.length) {
      return activeColumnIndex
    }
    const picked = window.prompt(
      `${actionLabel}\n대상 컬럼명을 입력하세요.\n${columns.join(', ')}`,
      columns[0] || ''
    )
    const name = (picked || '').trim()
    if (!name) return null
    const index = columns.findIndex((column) => column === name)
    if (index < 0) {
      toast.error('컬럼명을 정확히 입력해 주세요.')
      return null
    }
    return index
  }, [activeColumnIndex, columns])

  const applyColumnsPatch = useCallback(
    async (
      payload: {
        add?: string[]
        remove?: string[]
        rename?: Array<{ from_col: string; to_col: string }>
        reorder?: string[]
      },
      successMessage?: string
    ) => {
      if (!sheetId || !lockToken || readOnlyMode || actionLoading) return false
      if (hasPendingChanges) {
        await flushPendingChanges()
      }
      try {
        setActionLoading(true)
        await patchAdminSheetColumns(sheetId, payload, lockToken)
        setDraftValues({})
        setActiveCell(null)
        await loadSheetMeta(sheetId)
        await loadSheetRows(sheetId, { reset: true, offset: 0 })
        if (successMessage) toast.success(successMessage)
        return true
      } catch (error) {
        if ((error as any)?.response?.status === 409) {
          setLockToken(null)
        }
        toast.error(getAdminSheetsErrorMessage(error))
        return false
      } finally {
        setActionLoading(false)
      }
    },
    [
      actionLoading,
      flushPendingChanges,
      hasPendingChanges,
      loadSheetMeta,
      loadSheetRows,
      lockToken,
      readOnlyMode,
      sheetId,
    ]
  )

  const handleAddColumn = async (afterIndex?: number | null) => {
    if (readOnlyMode || actionLoading) return
    const name = (window.prompt('추가할 컬럼명을 입력하세요.') || '').trim()
    if (!name) return
    if (columns.includes(name)) {
      toast.error('이미 존재하는 컬럼명입니다.')
      return
    }
    const insertIndex =
      afterIndex != null && afterIndex >= 0 && afterIndex < columns.length ? afterIndex + 1 : columns.length
    const nextColumns = [...columns]
    nextColumns.splice(insertIndex, 0, name)
    const applied = await applyColumnsPatch(
      {
        add: [name],
        reorder: nextColumns,
      },
      '컬럼을 추가했습니다.'
    )
    if (applied) setActiveColumnIndex(insertIndex)
  }

  const handleRenameColumn = async (targetIndex?: number | null) => {
    if (readOnlyMode || actionLoading) return
    const index = resolveColumnIndexForAction('컬럼명 변경', targetIndex)
    if (index == null) return
    const fromColumn = columns[index]
    if (!fromColumn) return
    const toColumn = (window.prompt('새 컬럼명을 입력하세요.', fromColumn) || '').trim()
    if (!toColumn || toColumn === fromColumn) return
    if (columns.includes(toColumn)) {
      toast.error('이미 존재하는 컬럼명입니다.')
      return
    }
    const nextColumns = columns.map((column, colIndex) => (colIndex === index ? toColumn : column))
    const applied = await applyColumnsPatch(
      {
        rename: [{ from_col: fromColumn, to_col: toColumn }],
        reorder: nextColumns,
      },
      '컬럼명을 변경했습니다.'
    )
    if (applied) setActiveColumnIndex(index)
  }

  const handleRemoveColumn = async (targetIndex?: number | null) => {
    if (readOnlyMode || actionLoading) return
    const index = resolveColumnIndexForAction('컬럼 삭제', targetIndex)
    if (index == null) return
    const targetColumn = columns[index]
    if (!targetColumn) return
    if (columns.length <= 1) {
      toast.error('최소 1개 이상의 컬럼이 필요합니다.')
      return
    }
    if (!window.confirm(`컬럼 "${targetColumn}"을 삭제하시겠습니까?`)) return
    const nextColumns = columns.filter((column) => column !== targetColumn)
    const applied = await applyColumnsPatch(
      {
        remove: [targetColumn],
        reorder: nextColumns,
      },
      '컬럼을 삭제했습니다.'
    )
    if (applied) setActiveColumnIndex(Math.max(0, index - 1))
  }

  const handleMoveColumn = async (direction: 'left' | 'right', targetIndex?: number | null) => {
    if (readOnlyMode || actionLoading) return
    const index = resolveColumnIndexForAction(
      direction === 'left' ? '컬럼 왼쪽 이동' : '컬럼 오른쪽 이동',
      targetIndex
    )
    if (index == null) return
    const nextIndex = direction === 'left' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= columns.length) return
    const reordered = [...columns]
    const [picked] = reordered.splice(index, 1)
    reordered.splice(nextIndex, 0, picked)
    const applied = await applyColumnsPatch(
      {
        reorder: reordered,
      },
      '컬럼 순서를 변경했습니다.'
    )
    if (applied) setActiveColumnIndex(nextIndex)
  }

  const getNextAutoColumnName = useCallback(() => {
    let seq = columns.length + 1
    while (true) {
      const candidate = `컬럼${seq}`
      if (!columns.includes(candidate)) return candidate
      seq += 1
    }
  }, [columns])

  const handleAutoColumnBlur = useCallback(
    async (rowId: number, rawValue: string) => {
      if (!sheetId || readOnlyMode || actionLoading) return
      const value = rawValue.trim()
      if (!value) return
      const sourceRow = rows.find((row) => row.id === rowId)
      if (!sourceRow) return

      const newColumn = getNextAutoColumnName()
      const nextColumns = [...columns, newColumn]
      const created = await applyColumnsPatch(
        {
          add: [newColumn],
          reorder: nextColumns,
        },
        undefined
      )
      if (!created) return

      try {
        const rowLockToken = await ensureRowLock(rowId)
        if (!rowLockToken) return
        const patched = await patchAdminSheetRow(
          sheetId,
          rowId,
          {
            row_version: Number(sourceRow.row_version || 1),
            values: {
              [newColumn]: value,
            },
          },
          rowLockToken
        )
        setRows((prev) => prev.map((row) => (row.id === rowId ? patched : row)))
        setAutoColumnDrafts((prev) => {
          const next = { ...prev }
          delete next[rowId]
          return next
        })
        setActiveColumnIndex(columns.length)
      } catch (error) {
        toast.error(getAdminSheetsErrorMessage(error))
      }
    },
    [actionLoading, applyColumnsPatch, columns, ensureRowLock, getNextAutoColumnName, readOnlyMode, rows, sheetId]
  )

  const handleAutoRowBlur = useCallback(
    async (column: string, rawValue: string) => {
      if (!sheetId || !lockToken || readOnlyMode || actionLoading) return
      const nextDraft = {
        ...autoRowDraft,
        [column]: rawValue,
      }
      setAutoRowDraft(nextDraft)
      const filtered = Object.fromEntries(
        Object.entries(nextDraft).filter(([, value]) => (value || '').trim() !== '')
      )
      if (Object.keys(filtered).length === 0) return
      try {
        setActionLoading(true)
        const created = await createAdminSheetRow(
          sheetId,
          {
            values: filtered,
          },
          lockToken
        )
        setRows((prev) => [...prev, created].sort((a, b) => a.row_order - b.row_order))
        setTotalRows((prev) => prev + 1)
        setAutoRowDraft({})
      } catch (error) {
        toast.error(getAdminSheetsErrorMessage(error))
      } finally {
        setActionLoading(false)
      }
    },
    [actionLoading, autoRowDraft, lockToken, readOnlyMode, sheetId]
  )

  const handleInlineHeaderRename = useCallback(
    async (colIndex: number) => {
      if (colIndex < 0 || colIndex >= columns.length) return
      const fromColumn = columns[colIndex]
      const toColumn = (columnHeaderDrafts[colIndex] || '').trim()
      if (!fromColumn) return
      if (!toColumn) {
        setColumnHeaderDrafts((prev) => prev.map((name, idx) => (idx === colIndex ? fromColumn : name)))
        toast.error('컬럼명은 비워둘 수 없습니다.')
        return
      }
      if (toColumn === fromColumn) return
      const duplicateIndex = columns.findIndex((column, idx) => idx !== colIndex && column === toColumn)
      if (duplicateIndex >= 0) {
        setColumnHeaderDrafts((prev) => prev.map((name, idx) => (idx === colIndex ? fromColumn : name)))
        toast.error('이미 존재하는 컬럼명입니다.')
        return
      }
      const nextColumns = columns.map((column, idx) => (idx === colIndex ? toColumn : column))
      const applied = await applyColumnsPatch(
        {
          rename: [{ from_col: fromColumn, to_col: toColumn }],
          reorder: nextColumns,
        },
        '컬럼명을 변경했습니다.'
      )
      if (!applied) {
        setColumnHeaderDrafts((prev) => prev.map((name, idx) => (idx === colIndex ? fromColumn : name)))
      }
    },
    [applyColumnsPatch, columnHeaderDrafts, columns]
  )

  const saveStateLabel = useMemo(() => {
    if (saveState === 'saving') return '저장 중...'
    if (saveState === 'error') return '저장 실패'
    return '저장됨'
  }, [saveState])

  const activeCellMeta = useMemo(() => {
    if (!activeCell) return null
    const rowIndex = rows.findIndex((r) => r.id === activeCell.rowId)
    if (rowIndex < 0) return null
    const row = rows[rowIndex]
    if (!row) return null
    const column = columns[activeCell.colIndex]
    if (!column) return null
    const displayRowNumber = rowIndex + 2
    const address = `${getColumnLabel(activeCell.colIndex)}${displayRowNumber}`
    const formulaValue = row.formulas?.[column]
    const value =
      draftValues[row.id]?.[column] ??
      (typeof formulaValue === 'string' && formulaValue.trim() ? formulaValue : toTextValue(row.values?.[column]))
    return {
      rowId: row.id,
      column,
      address,
      value,
    }
  }, [activeCell, columns, draftValues, rows])

  const openContextMenu = useCallback(
    (
      event: ReactMouseEvent,
      targetType: ContextMenuTargetType,
      options?: {
        rowId?: number
        colIndex?: number
      }
    ) => {
      event.preventDefault()
      event.stopPropagation()
      if (options?.colIndex != null) setActiveColumnIndex(options.colIndex)
      setContextMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        targetType,
        rowId: options?.rowId,
        colIndex: options?.colIndex,
      })
    },
    []
  )

  const clearSelection = useCallback(() => {
    setSelectedRowIndex(null)
    setIsAllSelected(false)
  }, [])

  const isCellInSelection = useCallback(
    (visualRowIndex: number) => {
      if (isAllSelected) return true
      if (selectedRowIndex === visualRowIndex) return true
      return false
    },
    [isAllSelected, selectedRowIndex]
  )

  const getCellStyleByLocation = useCallback(
    (rowId: number, colKey: string): SheetCellStyleValue | undefined => {
      return cellStyleMap[buildCellStyleKey(rowId, colKey)]
    },
    [cellStyleMap]
  )

  useEffect(() => {
    if (!activeCellMeta) return
    const currentStyle = getCellStyleByLocation(activeCellMeta.rowId, activeCellMeta.column)
    if (
      currentStyle?.number_format === 'general' ||
      currentStyle?.number_format === 'number_comma' ||
      currentStyle?.number_format === 'date_ymd_dash'
    ) {
      setNumberFormat(currentStyle.number_format)
    } else {
      setNumberFormat('general')
    }
  }, [activeCellMeta, getCellStyleByLocation])

  const resolveStyleTarget = useCallback(() => {
    if (isAllSelected) {
      if (externallyLockedRowIds.length > 0) {
        toast.error('다른 사용자가 점유 중인 행이 있어 전체 선택 스타일 적용이 불가합니다.')
        return null
      }
      return {
        row_ids: [] as number[],
        col_keys: [] as string[],
        apply_to_all_rows: true,
        apply_to_all_cols: true,
      }
    }
    if (selectedRowIndex != null) {
      if (selectedRowIndex <= 0) {
        toast.error('헤더 행에는 스타일을 적용할 수 없습니다.')
        return null
      }
      const targetRow = rows[selectedRowIndex - 1]
      if (!targetRow) {
        toast.error('대상 행을 찾을 수 없습니다.')
        return null
      }
      return {
        row_ids: [targetRow.id],
        col_keys: [] as string[],
        apply_to_all_rows: false,
        apply_to_all_cols: true,
      }
    }
    if (activeCell) {
      const targetCol = columns[activeCell.colIndex]
      if (!targetCol) {
        toast.error('대상 셀을 찾을 수 없습니다.')
        return null
      }
      return {
        row_ids: [activeCell.rowId],
        col_keys: [targetCol],
        apply_to_all_rows: false,
        apply_to_all_cols: false,
      }
    }
    toast.error('셀 또는 행을 먼저 선택해 주세요.')
    return null
  }, [activeCell, columns, externallyLockedRowIds.length, isAllSelected, rows, selectedRowIndex])

  const applyStyleDelta = useCallback(
    async (styleDelta: Record<string, unknown>) => {
      if (!sheetId || !lockToken || readOnlyMode || actionLoading) return
      const target = resolveStyleTarget()
      if (!target) return
      if (hasPendingChanges) {
        await flushPendingChanges()
      }
      try {
        setActionLoading(true)
        await patchAdminSheetStyles(
          sheetId,
          {
            ...target,
            style_delta: styleDelta,
          },
          lockToken
        )
        const targetRowIds = target.apply_to_all_rows ? rows.map((row) => row.id) : target.row_ids
        const targetColKeys = target.apply_to_all_cols ? columns : target.col_keys
        setCellStyleMap((prev) => {
          const next = { ...prev }
          for (const rowId of targetRowIds) {
            for (const colKey of targetColKeys) {
              const key = buildCellStyleKey(rowId, colKey)
              const merged: Record<string, unknown> = { ...(next[key] || {}) }
              for (const [styleKey, styleValue] of Object.entries(styleDelta)) {
                if (styleValue == null) delete merged[styleKey]
                else merged[styleKey] = styleValue
              }
              if (Object.keys(merged).length === 0) delete next[key]
              else next[key] = merged as SheetCellStyleValue
            }
          }
          return next
        })
      } catch (error) {
        if ((error as any)?.response?.status === 409) {
          setLockToken(null)
        }
        toast.error(getAdminSheetsErrorMessage(error))
      } finally {
        setActionLoading(false)
      }
    },
    [
      actionLoading,
      columns,
      flushPendingChanges,
      hasPendingChanges,
      lockToken,
      readOnlyMode,
      resolveStyleTarget,
      rows,
      sheetId,
    ]
  )

  const toggleBoldStyle = useCallback(async () => {
    const target = resolveStyleTarget()
    if (!target) return
    const targetRowIds = target.apply_to_all_rows ? rows.map((row) => row.id) : target.row_ids
    const targetColKeys = target.apply_to_all_cols ? columns : target.col_keys
    if (targetRowIds.length === 0 || targetColKeys.length === 0) return

    const isAllBold = targetRowIds.every((rowId) =>
      targetColKeys.every((colKey) => {
        const style = getCellStyleByLocation(rowId, colKey)
        return style?.font_weight === 'bold'
      })
    )

    await applyStyleDelta({ font_weight: isAllBold ? 'normal' : 'bold' })
  }, [applyStyleDelta, columns, getCellStyleByLocation, resolveStyleTarget, rows])

  const persistColumnWidths = useCallback(
    async (widths: Record<string, number>) => {
      if (!sheetId || !lockToken || readOnlyMode) return
      if (resizeInFlightRef.current) return
      try {
        resizeInFlightRef.current = true
        const normalized: Record<string, number> = {}
        for (const column of columns) {
          const width = Number(widths[column] || 0)
          normalized[column] = Math.max(72, Math.min(640, Number.isFinite(width) ? width : 140))
        }
        await patchAdminSheetColumnWidths(
          sheetId,
          {
            widths: normalized,
          },
          lockToken
        )
      } catch (error) {
        if ((error as any)?.response?.status === 409) {
          setLockToken(null)
        }
        toast.error(getAdminSheetsErrorMessage(error))
      } finally {
        resizeInFlightRef.current = false
      }
    },
    [columns, lockToken, readOnlyMode, sheetId]
  )

  const getRenderedCellText = useCallback(
    (row: AdminSheetRow, column: string): string => {
      const draft = draftValues[row.id]?.[column]
      if (typeof draft === 'string') return draft
      const style = getCellStyleByLocation(row.id, column)
      const numberFormat = style?.number_format as NumberFormatType | undefined
      return formatDisplayValueByNumberFormat(row.values?.[column], numberFormat)
    },
    [draftValues, getCellStyleByLocation]
  )

  const handleColumnAutoFit = useCallback(
    async (colIndex: number) => {
      const targetColumn = columns[colIndex]
      if (!targetColumn || readOnlyMode || !lockToken || !sheetId) return
      let maxLength = Math.max(
        (columnHeaderDrafts[colIndex] || targetColumn || '').length,
        getColumnLabel(colIndex).length
      )
      for (const row of rows) {
        maxLength = Math.max(maxLength, getRenderedCellText(row, targetColumn).length)
      }
      const autoWidth = Math.max(72, Math.min(640, Math.round(maxLength * 8 + 28)))
      const nextWidths = {
        ...columnWidths,
        [targetColumn]: autoWidth,
      }
      setColumnWidths(nextWidths)
      await persistColumnWidths(nextWidths)
    },
    [columnHeaderDrafts, columnWidths, columns, getRenderedCellText, lockToken, persistColumnWidths, readOnlyMode, rows, sheetId]
  )

  const handleColumnResizeStart = useCallback(
    (event: ReactMouseEvent, colIndex: number) => {
      event.preventDefault()
      event.stopPropagation()
      const targetColumn = columns[colIndex]
      if (!targetColumn || readOnlyMode || !lockToken || !sheetId) return
      const startX = event.clientX
      const startWidth = getColumnWidthPx(targetColumn)
      let finalWidth = startWidth
      let currentWidths = { ...columnWidths }
      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        finalWidth = Math.max(72, Math.min(640, Math.round(startWidth + delta)))
        currentWidths = {
          ...currentWidths,
          [targetColumn]: finalWidth,
        }
        setColumnWidths(currentWidths)
      }
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        const nextWidths = {
          ...currentWidths,
          [targetColumn]: finalWidth,
        }
        void persistColumnWidths(nextWidths)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [columnWidths, columns, getColumnWidthPx, lockToken, persistColumnWidths, readOnlyMode, sheetId]
  )

  const runContextAction = useCallback(
    async (action: 'add_row' | 'delete_row' | 'add_col' | 'rename_col' | 'delete_col' | 'move_col_left' | 'move_col_right') => {
      const rowId = contextMenu?.rowId
      const colIndex = contextMenu?.colIndex
      setContextMenu(null)
      if (action === 'add_row') {
        await handleAddRow()
        return
      }
      if (action === 'delete_row' && rowId) {
        await handleDeleteRow(rowId)
        return
      }
      if (action === 'add_col') {
        await handleAddColumn(colIndex)
        return
      }
      if (action === 'rename_col') {
        await handleRenameColumn(colIndex)
        return
      }
      if (action === 'delete_col') {
        await handleRemoveColumn(colIndex)
        return
      }
      if (action === 'move_col_left') {
        await handleMoveColumn('left', colIndex)
        return
      }
      if (action === 'move_col_right') {
        await handleMoveColumn('right', colIndex)
        return
      }
    },
    [contextMenu?.colIndex, contextMenu?.rowId, handleAddColumn, handleAddRow, handleDeleteRow, handleMoveColumn, handleRemoveColumn, handleRenameColumn]
  )

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">
            {title || `엑셀 문서 #${entryId || '-'}`}
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            {sheetName || 'Sheet1'} · 총 {totalRows}행
          </p>
        </div>
        <div className="ml-3 flex items-center gap-2">
          <span
            className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-medium ${
              saveState === 'saving'
                ? 'bg-amber-100 text-amber-700'
                : saveState === 'error'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {saveStateLabel}
          </span>
          {readOnlyMode ? (
            <span className="inline-flex h-7 items-center rounded-full bg-zinc-200 px-2.5 text-[11px] font-medium text-zinc-700">
              읽기 모드
            </span>
          ) : null}
          <UiButton
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={actionLoading}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            내보내기
          </UiButton>
          <UiButton
            size="sm"
            onClick={handleManualSave}
            disabled={readOnlyMode || !hasPendingChanges || saveState === 'saving'}
          >
            저장
          </UiButton>
          <UiButton variant="secondary" size="sm" onClick={() => router.push('/admin/docs')}>
            문서함 이동
          </UiButton>
        </div>
      </header>

      <main className="min-h-0 flex-1 bg-zinc-50 p-2">
        <div className="flex h-full min-h-0 flex-col border border-zinc-300 bg-white">
          <div className="flex items-center gap-1 border-b border-zinc-300 bg-zinc-100 px-2 py-1.5">
            <span className="inline-flex min-w-14 items-center justify-center border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">
              {activeCellMeta?.address || '-'}
            </span>
            <input
              value={activeCellMeta?.value || ''}
              onChange={(event) => {
                if (!activeCellMeta || readOnlyMode) return
                handleCellChange(activeCellMeta.rowId, activeCellMeta.column, event.target.value)
              }}
              readOnly={readOnlyMode || !activeCellMeta}
              placeholder="선택한 셀 값"
              className="h-8 flex-1 border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-sky-500 read-only:bg-zinc-100 read-only:text-zinc-500"
            />
            <span className="inline-flex min-w-28 items-center justify-center border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">
              컬럼: {selectedColumnName || '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
            <UiButton
              variant="secondary"
              size="sm"
              disabled={readOnlyMode || actionLoading}
              onClick={() => void applyStyleDelta({ align: 'left' })}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              disabled={readOnlyMode || actionLoading}
              onClick={() => void applyStyleDelta({ align: 'center' })}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              disabled={readOnlyMode || actionLoading}
              onClick={() => void applyStyleDelta({ align: 'right' })}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              disabled={readOnlyMode || actionLoading}
              onClick={() => void toggleBoldStyle()}
            >
              굵게
            </UiButton>
            <div className="mx-1 h-6 w-px bg-zinc-300" />
            <div className="flex items-center rounded border border-zinc-300 bg-white">
              <div className="flex h-8 w-8 items-center justify-center">
                <Square className="h-4 w-4 text-zinc-600" />
              </div>
              <select
                disabled={readOnlyMode || actionLoading}
                onChange={(event) => {
                  const value = event.target.value as 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
                  void applyStyleDelta({
                    border_top: value,
                    border_right: value,
                    border_bottom: value,
                    border_left: value,
                  })
                }}
                className="h-8 border-0 bg-transparent pl-0 pr-1 text-xs text-zinc-700 outline-none"
                defaultValue="solid"
              >
                <option value="solid">실선</option>
                <option value="none">없음</option>
                <option value="dashed">점선</option>
                <option value="dotted">도트</option>
                <option value="double">이중선</option>
              </select>
            </div>
            <div className="flex items-center rounded border border-zinc-300 bg-white">
              <button
                type="button"
                disabled={readOnlyMode || actionLoading}
                onClick={() => void applyStyleDelta({ fill_color: fillColor })}
                className="relative flex h-8 w-8 items-center justify-center disabled:opacity-50"
                title="선택한 배경색 적용"
              >
                <PaintBucket className="h-4 w-4 text-zinc-600" />
                <span
                  className="absolute bottom-1 left-1 right-1 h-0.5 rounded"
                  style={{ backgroundColor: fillColor }}
                />
              </button>
              <button
                type="button"
                disabled={readOnlyMode || actionLoading}
                onClick={() => fillColorInputRef.current?.click()}
                className="flex h-8 w-5 items-center justify-center disabled:opacity-50"
                title="배경색 선택"
              >
                <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
              </button>
              <input
                ref={fillColorInputRef}
                type="color"
                value={fillColor}
                onChange={(event) => {
                  const next = event.target.value
                  setFillColor(next)
                }}
                className="sr-only"
              />
            </div>
            <div className="flex items-center rounded border border-zinc-300 bg-white">
              <button
                type="button"
                disabled={readOnlyMode || actionLoading}
                onClick={() => void applyStyleDelta({ color: fontColor })}
                className="relative flex h-8 w-8 items-center justify-center disabled:opacity-50"
                title="선택한 글자색 적용"
              >
                <Type className="h-4 w-4 text-zinc-600" />
                <span
                  className="absolute bottom-1 left-1 right-1 h-0.5 rounded"
                  style={{ backgroundColor: fontColor }}
                />
              </button>
              <button
                type="button"
                disabled={readOnlyMode || actionLoading}
                onClick={() => fontColorInputRef.current?.click()}
                className="flex h-8 w-5 items-center justify-center disabled:opacity-50"
                title="글자색 선택"
              >
                <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
              </button>
              <input
                ref={fontColorInputRef}
                type="color"
                value={fontColor}
                onChange={(event) => {
                  const next = event.target.value
                  setFontColor(next)
                }}
                className="sr-only"
              />
            </div>
            <UiButton
              variant="secondary"
              size="sm"
              disabled={readOnlyMode || actionLoading}
              onClick={() =>
                void applyStyleDelta({
                  align: null,
                  font_family: null,
                  font_size: null,
                  font_weight: null,
                  color: null,
                  fill_color: null,
                  number_format: null,
                  border_top: null,
                  border_right: null,
                  border_bottom: null,
                  border_left: null,
                })
              }
            >
              스타일 초기화
            </UiButton>
            <select
              value={numberFormat}
              disabled={readOnlyMode || actionLoading}
              onChange={(event) => {
                const next = event.target.value as NumberFormatType
                setNumberFormat(next)
                void applyStyleDelta({ number_format: next })
              }}
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
            >
              <option value="general">표시: 일반</option>
              <option value="number_comma">표시: 숫자(천단위)</option>
              <option value="date_ymd_dash">표시: 날짜(YYYY-MM-DD)</option>
            </select>
          </div>
          <div
            ref={rowsContainerRef}
            onScroll={handleRowsContainerScroll}
            className="min-h-0 flex-1 overflow-auto"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                시트 불러오는 중...
              </div>
            ) : (
              <>
                <table className="min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-700">
                    <tr>
                      <th
                        onClick={() => {
                          if (!isAllSelected && externallyLockedRowIds.length > 0) {
                            toast.error('다른 사용자가 점유 중인 행이 있어 전체 선택할 수 없습니다.')
                            return
                          }
                          setActiveCell(null)
                          setActiveColumnIndex(null)
                          setSelectedRowIndex(null)
                          setIsAllSelected((prev) => !prev)
                        }}
                        className={`w-16 border border-zinc-300 px-2 py-1.5 text-center cursor-pointer select-none ${
                          isAllSelected ? 'bg-sky-200 text-sky-900' : ''
                        }`}
                      />
                      {columns.map((column, colIndex) => {
                        const widthPx = getColumnWidthPx(column)
                        return (
                          <th
                            key={column}
                            onContextMenu={(event) => openContextMenu(event, 'column', { colIndex })}
                            onClick={() => {
                              setActiveCell(null)
                              setActiveColumnIndex(colIndex)
                              clearSelection()
                            }}
                            title={column}
                            style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                            className={`relative border border-zinc-300 px-2 py-1.5 text-center font-semibold cursor-pointer select-none ${
                              activeColumnIndex === colIndex
                                  ? 'bg-sky-100 text-sky-800'
                                  : ''
                            }`}
                          >
                            {getColumnLabel(colIndex)}
                            <button
                              type="button"
                              onMouseDown={(event) => handleColumnResizeStart(event, colIndex)}
                              onDoubleClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                void handleColumnAutoFit(colIndex)
                              }}
                              className="absolute right-[-3px] top-0 h-full w-1.5 cursor-col-resize bg-transparent"
                              aria-label={`${column} 열 너비 조절`}
                            />
                          </th>
                        )
                      })}
                      <th className="border border-zinc-300 px-2 py-1.5 text-center font-semibold text-zinc-400">
                        {getColumnLabel(columns.length)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.length > 0 ? (
                      <tr className="bg-zinc-50">
                        <td
                          onClick={() => {
                            setActiveCell(null)
                            setSelectedRowIndex(0)
                            setIsAllSelected(false)
                          }}
                          className={`sticky left-0 z-[1] border border-zinc-300 px-2 py-1.5 text-center font-medium cursor-pointer select-none ${
                            isAllSelected || selectedRowIndex === 0
                              ? 'bg-sky-200 text-sky-900'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          1
                        </td>
                        {columns.map((column, colIndex) => {
                          const widthPx = getColumnWidthPx(column)
                          return (
                            <td
                              key={`header-row-${column}`}
                              style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                              className={`border border-zinc-200 px-0 py-0 ${
                                isCellInSelection(0)
                                  ? 'bg-sky-100'
                                  : activeColumnIndex === colIndex
                                    ? 'bg-sky-50'
                                    : ''
                              }`}
                            >
                              <input
                                value={columnHeaderDrafts[colIndex] ?? column}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setColumnHeaderDrafts((prev) => prev.map((name, idx) => (idx === colIndex ? nextValue : name)))
                                }}
                                onFocus={() => {
                                  setActiveColumnIndex(colIndex)
                                  clearSelection()
                                }}
                                onBlur={() => void handleInlineHeaderRename(colIndex)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    ;(event.currentTarget as HTMLInputElement).blur()
                                    return
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    setColumnHeaderDrafts((prev) => prev.map((name, idx) => (idx === colIndex ? column : name)))
                                    ;(event.currentTarget as HTMLInputElement).blur()
                                  }
                                }}
                                readOnly={readOnlyMode || actionLoading}
                                className="h-8 w-full border-0 bg-transparent px-2 text-xs font-medium text-zinc-700 outline-none focus:bg-sky-100 read-only:bg-zinc-100 read-only:text-zinc-500"
                              />
                            </td>
                          )
                        })}
                        <td className="border border-zinc-200 px-0 py-0">
                          <div className="h-8 w-full bg-zinc-50/70" />
                        </td>
                      </tr>
                    ) : null}
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-zinc-500">
                          표시할 데이터가 없습니다. 행 추가로 시작하세요.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, rowIndex) => (
                        <tr key={row.id} className="bg-white">
                          <td
                            onContextMenu={(event) => openContextMenu(event, 'row', { rowId: row.id })}
                            onClick={() => {
                              setActiveCell(null)
                              setSelectedRowIndex(rowIndex + 1)
                              setIsAllSelected(false)
                            }}
                            className={`sticky left-0 z-[1] border border-zinc-300 px-2 py-1.5 text-center font-medium cursor-pointer select-none ${
                              isAllSelected || selectedRowIndex === rowIndex + 1
                                ? 'bg-sky-200 text-sky-900'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {rowIndex + 2}
                          </td>
                          {columns.map((column, colIndex) => {
                            const value = draftValues[row.id]?.[column] ?? getRenderedCellText(row, column)
                            const inlineStyle = toInlineCellStyle(getCellStyleByLocation(row.id, column))
                            const widthPx = getColumnWidthPx(column)
                            const isActive =
                              activeCell?.rowId === row.id && activeCell?.colIndex === colIndex
                            const isExternallyLockedRow =
                              externallyLockedRowIds.includes(row.id) && rowLock?.rowId !== row.id
                            return (
                              <td
                                key={`${row.id}-${column}`}
                                style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                                className={`border border-zinc-200 px-0 py-0 ${
                                  isActive
                                    ? 'ring-2 ring-inset ring-sky-500'
                                    : isCellInSelection(rowIndex + 1)
                                      ? 'bg-sky-100'
                                      : isExternallyLockedRow
                                        ? 'bg-rose-50'
                                      : ''
                                }`}
                              >
                                <input
                                  ref={(node) => {
                                    cellInputRefs.current[`${row.id}:${colIndex}`] = node
                                  }}
                                  value={value}
                                  onChange={(event) => handleCellChange(row.id, column, event.target.value)}
                                  onBlur={() => void flushPendingChanges()}
                                  onMouseDown={(event) => {
                                    if (event.button !== 0) return
                                    event.preventDefault()
                                    if (readOnlyMode) return
                                    void (async () => {
                                      const token = await ensureRowLock(row.id)
                                      if (!token) return
                                      setActiveCell({ rowId: row.id, colIndex })
                                      setActiveColumnIndex(colIndex)
                                      clearSelection()
                                      window.requestAnimationFrame(() => {
                                        const input = cellInputRefs.current[`${row.id}:${colIndex}`]
                                        input?.focus()
                                        input?.select()
                                      })
                                    })()
                                  }}
                                  onFocus={(event) => {
                                    if (readOnlyMode) return
                                    const target = event.currentTarget
                                    void (async () => {
                                      const token = await ensureRowLock(row.id, { silent: true })
                                      if (!token) {
                                        target.blur()
                                        return
                                      }
                                      setActiveCell({ rowId: row.id, colIndex })
                                      setActiveColumnIndex(colIndex)
                                      clearSelection()
                                    })()
                                  }}
                                  onContextMenu={(event) =>
                                    openContextMenu(event, 'cell', { rowId: row.id, colIndex })
                                  }
                                  onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                                  readOnly={readOnlyMode || rowLock?.rowId !== row.id}
                                  style={inlineStyle}
                                  className={`h-8 w-full border-0 bg-transparent px-2 text-xs outline-none focus:bg-sky-50 read-only:bg-zinc-50 read-only:text-zinc-500 ${
                                    isActive ? 'bg-sky-50' : ''
                                  }`}
                                />
                              </td>
                            )
                          })}
                          <td className="border border-zinc-200 px-0 py-0">
                            <input
                              value={autoColumnDrafts[row.id] ?? ''}
                              onChange={(event) =>
                                setAutoColumnDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))
                              }
                              onBlur={(event) => void handleAutoColumnBlur(row.id, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  ;(event.currentTarget as HTMLInputElement).blur()
                                }
                              }}
                              readOnly={readOnlyMode || actionLoading}
                              placeholder="+ 열"
                              className="h-8 w-full border-0 bg-zinc-50/70 px-2 text-xs text-zinc-500 outline-none focus:bg-sky-50 read-only:bg-zinc-100"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                    {columns.length > 0 ? (
                      <tr className="bg-white">
                        <td className="sticky left-0 z-[1] border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-center font-medium text-zinc-600">
                          {rows.length + 2}
                        </td>
                        {columns.map((column) => {
                          const widthPx = getColumnWidthPx(column)
                          return (
                            <td
                              key={`auto-row-${column}`}
                              style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                              className="border border-zinc-200 px-0 py-0"
                            >
                              <input
                                value={autoRowDraft[column] ?? ''}
                                onChange={(event) =>
                                  setAutoRowDraft((prev) => ({ ...prev, [column]: event.target.value }))
                                }
                                onBlur={(event) => void handleAutoRowBlur(column, event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    ;(event.currentTarget as HTMLInputElement).blur()
                                  }
                                }}
                                readOnly={readOnlyMode || actionLoading}
                                placeholder="+ 행"
                                className="h-8 w-full border-0 bg-zinc-50/70 px-2 text-xs text-zinc-500 outline-none focus:bg-sky-50 read-only:bg-zinc-100"
                              />
                            </td>
                          )
                        })}
                        <td className="border border-zinc-200 px-0 py-0">
                          <div className="h-8 w-full bg-zinc-50/70" />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {rowsLoading && rows.length > 0 ? (
                  <div className="px-3 py-2 text-center text-[11px] text-zinc-500">행 추가 로딩 중...</div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>
      {contextMenu?.open ? (
        <div
          className="fixed z-[120] min-w-[160px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {(contextMenu.targetType === 'row' || contextMenu.targetType === 'cell') ? (
            <>
              <button
                type="button"
                onClick={() => void runContextAction('add_row')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={() => void runContextAction('delete_row')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                행 삭제
              </button>
            </>
          ) : null}
          {(contextMenu.targetType === 'column' || contextMenu.targetType === 'cell') ? (
            <>
              <button
                type="button"
                onClick={() => void runContextAction('add_col')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                열 추가
              </button>
              <button
                type="button"
                onClick={() => void runContextAction('rename_col')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                열 이름 변경
              </button>
              <button
                type="button"
                onClick={() => void runContextAction('move_col_left')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                열 왼쪽 이동
              </button>
              <button
                type="button"
                onClick={() => void runContextAction('move_col_right')}
                className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
              >
                열 오른쪽 이동
              </button>
              <button
                type="button"
                onClick={() => void runContextAction('delete_col')}
                className="block w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-zinc-100"
              >
                열 삭제
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
