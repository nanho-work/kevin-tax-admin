'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  File,
  FileArchive,
  FileAudio,
  FileBadge,
  FileBarChart2,
  FileChartColumnIncreasing,
  FileCode,
  FileImage,
  FileJson,
  FileLock,
  FilePieChart,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  FileWarning,
  Folder,
  FolderOpen,
  Grid2X2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import Pagination from '@/components/common/Pagination'
import UiSearchInput from '@/components/common/UiSearchInput'
import DocsContextMenu, { type DocsContextMenuItem } from '@/components/admin/docs/DocsContextMenu'
import {
  completeAdminDocsEntryUpload,
  createAdminDocsFolder,
  deleteAdminDocsEntry,
  deleteAdminDocsFolder,
  downloadAdminDocsEntriesBulk,
  fetchAdminDocsEntryDownloadUrl,
  fetchAdminDocsEntryPreviewUrl,
  fetchAdminDocsFolderEntries,
  fetchAdminDocsFolderTree,
  fetchAdminDocsStorageUsage,
  fetchAdminDocsTrashCount,
  fetchAdminDocsTrashEntries,
  getAdminDocsErrorDetail,
  getAdminDocsErrorCode,
  getAdminDocsErrorMessage,
  issueAdminDocsEntryUploadUrl,
  moveAdminDocsEntriesBulk,
  moveAdminDocsEntry,
  purgeAdminDocsTrashEntry,
  purgeAdminDocsTrashEntriesBulk,
  renameAdminDocsEntry,
  renameAdminDocsFolder,
  restoreAdminDocsTrashEntry,
  restoreAdminDocsTrashEntriesBulk,
  uploadAdminDocsEntryMultipart,
  uploadFileToPresignedUrl,
} from '@/services/admin/adminDocsService'
import type {
  DocsEntryListItem,
  DocsFolderItem,
  DocsStorageUsageResponse,
  DocsSortBy,
  DocsSortOrder,
  DocsTrashEntryItem,
  DocsViewMode,
} from '@/types/adminDocs'

type ListSortKey = DocsSortBy
type SortDirection = DocsSortOrder

type MarqueeState = {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

type DocEntry = {
  id: string
  type: 'folder' | 'file'
  name: string
  updatedAt: string
  createdAt: string
  deletedAt?: string
  sourceFolderName?: string
  size?: string
  sizeBytes?: number | null
  folderId?: number | null
  entryId?: number | null
  extension?: string | null
  contentType?: string | null
  hasThumbnail?: boolean
  thumbnailUrl?: string | null
  iconKey?:
    | 'file'
    | 'text'
    | 'type'
    | 'spreadsheet'
    | 'archive'
    | 'image'
    | 'video'
    | 'audio'
    | 'code'
    | 'json'
    | 'search'
    | 'warning'
    | 'lock'
    | 'badge'
    | 'chart'
    | 'bar'
}

const DOCS_ERROR_CODE_MAP: Record<string, string> = {
  DOCS_FOLDER_NOT_FOUND: '폴더를 찾을 수 없습니다.',
  DOCS_FOLDER_FORBIDDEN: '해당 폴더 접근 권한이 없습니다.',
  DOCS_FOLDER_DUPLICATE: '동일 이름 폴더가 이미 존재합니다.',
  DOCS_SYSTEM_FOLDER_PROTECTED: '기본 시스템 폴더는 변경할 수 없습니다.',
  DOCS_FOLDER_NOT_EMPTY: '폴더가 비어있지 않아 삭제할 수 없습니다.',
  DOCS_ENTRY_NOT_FOUND: '파일을 찾을 수 없습니다.',
  DOCS_ENTRY_DUPLICATE: '동일 이름 파일이 이미 존재합니다.',
  DOCS_FILE_NAME_REQUIRED: '파일명을 확인해 주세요.',
  DOCS_EMPTY_FILE: '빈 파일은 업로드할 수 없습니다.',
  DOCS_INVALID_FILE: '파일 검증에 실패했습니다. 확장자와 실제 파일 형식을 확인해 주세요.',
  DOCS_STORAGE_KEY_FORBIDDEN: '허용되지 않는 업로드 경로입니다.',
  DOCS_S3_DELETE_FAILED: '저장소 파일 삭제에 실패했습니다.',
  DOCS_BULK_EMPTY: '선택된 파일이 없습니다.',
  DOCS_BULK_LIMIT_EXCEEDED: '한 번에 처리 가능한 개수를 초과했습니다.',
  DOCS_STORAGE_KEY_MISSING: '파일 키가 누락된 항목이 있습니다.',
  DOCS_S3_OBJECT_NOT_FOUND: '저장소 파일을 찾을 수 없습니다.',
  DOCS_BULK_SIZE_EXCEEDED: '묶음 다운로드 용량 제한을 초과했습니다.',
  DOCS_QUOTA_EXCEEDED: '문서함 용량 한도를 초과하여 업로드할 수 없습니다.',
}

function resolveDocsErrorMessage(error: unknown): string {
  const code = getAdminDocsErrorCode(error)
  const detail = getAdminDocsErrorDetail(error)
  if (code === 'DOCS_QUOTA_EXCEEDED') {
    const availableBytes = Number(detail?.available_bytes || 0)
    const incomingBytes = Number(detail?.incoming_size_bytes || 0)
    return `문서함 용량이 부족합니다. 남은 용량 ${formatStorageSize(availableBytes)} / 업로드 파일 ${formatStorageSize(incomingBytes)}`
  }
  if (code && DOCS_ERROR_CODE_MAP[code]) return DOCS_ERROR_CODE_MAP[code]
  return getAdminDocsErrorMessage(error)
}

function formatDateTime(value: string): string {
  if (!value) return '-'
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)}KB`
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)}MB`
  return `${(bytes / (1024 ** 3)).toFixed(1)}GB`
}

function formatStorageSize(bytes?: number | null): string {
  const safe = Number(bytes || 0)
  if (safe <= 0) return '0B'
  if (safe < 1024) return `${Math.floor(safe)}B`
  if (safe < 1024 ** 2) return `${(safe / 1024).toFixed(1)}KB`
  if (safe < 1024 ** 3) return `${(safe / (1024 ** 2)).toFixed(1)}MB`
  return `${(safe / (1024 ** 3)).toFixed(1)}GB`
}

function toUsagePercent(value?: number | null): number {
  const safe = Number(value || 0)
  if (!Number.isFinite(safe) || safe <= 0) return 0
  const percent = safe <= 1 ? safe * 100 : safe
  return Math.min(100, Math.max(0, percent))
}

function resolveIconKey(item: DocsEntryListItem): DocEntry['iconKey'] {
  const ext = (item.extension || '').replace('.', '').toLowerCase()
  const contentType = (item.content_type || '').toLowerCase()
  const imageExt = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
  const videoExt = new Set(['mp4', 'mov', 'avi', 'mkv', 'wmv', 'webm'])
  const audioExt = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'])
  const spreadsheetExt = new Set(['xls', 'xlsx', 'csv'])
  const archiveExt = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'])
  const codeExt = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cc', 'cpp', 'h', 'hpp',
    'go', 'rb', 'php', 'sh', 'zsh', 'sql', 'css', 'scss', 'html', 'xml',
  ])

  if (ext === 'json') return 'json'
  if (spreadsheetExt.has(ext)) return 'spreadsheet'
  if (archiveExt.has(ext)) return 'archive'
  if (imageExt.has(ext) || contentType.startsWith('image/')) return 'image'
  if (videoExt.has(ext) || contentType.startsWith('video/')) return 'video'
  if (audioExt.has(ext) || contentType.startsWith('audio/')) return 'audio'
  if (ext === 'txt' || ext === 'md') return 'text'
  if (codeExt.has(ext)) return 'code'
  if (ext === 'ppt' || ext === 'pptx' || ext === 'doc' || ext === 'docx' || ext === 'hwp' || ext === 'hwpx') {
    return 'type'
  }
  if (ext === 'pdf') return 'search'
  return 'file'
}

function mapEntryItemToUi(item: DocsEntryListItem): DocEntry {
  if (item.item_type === 'folder') {
    return {
      id: item.item_id,
      type: 'folder',
      name: item.name,
      updatedAt: formatDateTime(item.updated_at),
      createdAt: formatDateTime(item.created_at),
      folderId: item.folder_id,
      entryId: null,
      size: '-',
      sizeBytes: null,
    }
  }
  return {
    id: item.item_id,
    type: 'file',
    name: item.name,
    updatedAt: formatDateTime(item.updated_at),
    createdAt: formatDateTime(item.created_at),
    folderId: null,
    entryId: item.entry_id,
    extension: item.extension,
    contentType: item.content_type,
    sizeBytes: item.size_bytes,
    hasThumbnail: Boolean(item.has_thumbnail),
    thumbnailUrl: item.thumbnail_url || null,
    size: formatSize(item.size_bytes),
    iconKey: resolveIconKey(item),
  }
}

function mapTrashEntryItemToUi(item: DocsTrashEntryItem): DocEntry {
  return {
    id: `trash-file-${item.entry_id}`,
    type: 'file',
    name: item.name,
    updatedAt: formatDateTime(item.updated_at),
    createdAt: formatDateTime(item.updated_at),
    deletedAt: formatDateTime(item.deleted_at),
    sourceFolderName: item.folder_name,
    folderId: item.folder_id,
    entryId: item.entry_id,
    extension: item.extension,
    contentType: item.content_type,
    sizeBytes: item.size_bytes,
    size: formatSize(item.size_bytes),
    iconKey: resolveIconKey({
      item_id: `trash-file-${item.entry_id}`,
      item_type: 'file',
      folder_id: item.folder_id,
      entry_id: item.entry_id,
      name: item.name,
      extension: item.extension,
      content_type: item.content_type,
      size_bytes: item.size_bytes,
      updated_at: item.updated_at,
      created_at: item.updated_at,
    }),
  }
}

function isExcelEditableEntry(entry: DocEntry): boolean {
  if (entry.type !== 'file') return false
  const extension = String(entry.extension || '')
    .replace('.', '')
    .trim()
    .toLowerCase()
  const contentType = String(entry.contentType || '').trim().toLowerCase()

  // 백엔드 1~2차 기준: from-doc-entry는 .xlsx/.xlsm만 지원
  const editableExtensions = new Set(['xlsx', 'xlsm'])
  if (editableExtensions.has(extension)) return true

  const editableContentTypes = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
  ])
  return editableContentTypes.has(contentType)
}

function isPreviewableEntry(entry: DocEntry): boolean {
  if (entry.type !== 'file') return false
  const extension = String(entry.extension || '')
    .replace('.', '')
    .trim()
    .toLowerCase()
  const contentType = String(entry.contentType || '').trim().toLowerCase()
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
  if (imageExtensions.has(extension)) return true
  if (contentType.startsWith('image/')) return true
  if (extension === 'pdf') return true
  return contentType === 'application/pdf'
}

function saveBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function renderDocIcon(entry: DocEntry) {
  if (entry.type === 'folder') return renderFolderGradientIcon(false)
  return renderDocFileVisual(entry, false)
}

function renderDocIconSmall(entry: DocEntry) {
  if (entry.type === 'folder') return renderFolderGradientIcon(true)
  return renderDocFileVisual(entry, true)
}

function renderDocFileVisual(entry: DocEntry, small: boolean) {
  const icon = renderDocFileIcon(entry, small)
  const iconWithBadge = wrapDocBadge(entry, icon, small)
  const canRenderThumbnail = Boolean(entry.hasThumbnail && entry.thumbnailUrl)

  if (!canRenderThumbnail) return iconWithBadge

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden border border-zinc-200 bg-white ${
        small ? 'h-4 w-4 rounded-[3px]' : 'h-10 w-10 rounded-md'
      }`}
    >
      <span className="absolute inset-0 flex items-center justify-center">{iconWithBadge}</span>
      <img
        src={entry.thumbnailUrl || undefined}
        alt=""
        loading="lazy"
        draggable={false}
        className="relative z-10 h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    </span>
  )
}

function renderDocFileIcon(entry: DocEntry, small: boolean) {
  const isHangulDoc = entry.type === 'file' && /\.hwpx?$/i.test(entry.name || '')
  if (isHangulDoc) return renderHangulFileIcon(small)

  const isTxtDoc = entry.type === 'file' && /\.txt$/i.test(entry.name || '')
  if (isTxtDoc) return renderTxtFileIcon(small)

  const size = small ? 'h-4 w-4' : 'h-10 w-10'
  switch (entry.iconKey) {
    case 'spreadsheet':
      return <FileSpreadsheet className={`${size} text-emerald-600`} />
    case 'archive':
      return <FileArchive className={`${size} text-orange-600`} />
    case 'image':
      return <FileImage className={`${size} text-fuchsia-600`} />
    case 'video':
      return <FileVideo className={`${size} text-indigo-600`} />
    case 'audio':
      return <FileAudio className={`${size} text-violet-600`} />
    case 'code':
      return <FileCode className={`${size} text-slate-600`} />
    case 'json':
      return <FileJson className={`${size} text-cyan-700`} />
    case 'search':
      return <FileSearch className={`${size} text-blue-700`} />
    case 'warning':
      return <FileWarning className={`${size} text-amber-700`} />
    case 'lock':
      return <FileLock className={`${size} text-rose-700`} />
    case 'badge':
      return <FileBadge className={`${size} text-lime-700`} />
    case 'chart':
      return <FilePieChart className={`${size} text-teal-700`} />
    case 'bar':
      return small ? (
        <FileChartColumnIncreasing className={`${size} text-emerald-700`} />
      ) : (
        <FileBarChart2 className={`${size} text-emerald-700`} />
      )
    case 'type':
      return <FileType2 className={`${size} text-sky-600`} />
    case 'text':
      return <FileText className={`${size} text-zinc-500`} />
    default:
      return <File className={`${size} text-sky-600`} />
  }
}

function renderHangulFileIcon(small: boolean) {
  const sizeClass = small ? 'h-4 w-4' : 'h-10 w-10'
  const fontSize = small ? '6.5' : '14'

  return (
    <svg viewBox="0 0 24 24" className={sizeClass} aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z" fill="#0284C7" />
      <path d="M14 2v5h5" fill="#38BDF8" />
      <text
        x="12"
        y={small ? '19' : '18.5'}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="Noto Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif"
      >
        ㅎ
      </text>
    </svg>
  )
}

function renderTxtFileIcon(small: boolean) {
  const sizeClass = small ? 'h-4 w-4' : 'h-10 w-10'
  return (
    <svg viewBox="0 0 24 24" className={sizeClass} aria-hidden="true">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z" fill="#52525B" />
      <path d="M14 2v5h5" fill="#71717A" />
      <text
        x="12"
        y={small ? '20.2' : '19.6'}
        textAnchor="middle"
        fontSize={small ? '4.1' : '6.3'}
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="Inter, Segoe UI, Arial, sans-serif"
        letterSpacing="0.3"
      >
        txt
      </text>
    </svg>
  )
}

function renderFolderGradientIcon(small: boolean) {
  return (
    <svg viewBox="0 0 24 24" className={small ? 'h-4 w-4' : 'h-10 w-10'} aria-hidden="true">
      <defs>
        <linearGradient id="docsFolderGradientLg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M3 7.75A1.75 1.75 0 0 1 4.75 6h4.02c.46 0 .9.18 1.22.5l.78.78c.33.33.77.52 1.24.52h7.24A1.75 1.75 0 0 1 21 9.55v8.7A1.75 1.75 0 0 1 19.25 20h-14.5A1.75 1.75 0 0 1 3 18.25v-10.5Z"
        fill="url(#docsFolderGradientLg)"
      />
      <path
        d="M3 10.1c0-.97.78-1.75 1.75-1.75h14.5c.97 0 1.75.78 1.75 1.75v8.15A1.75 1.75 0 0 1 19.25 20h-14.5A1.75 1.75 0 0 1 3 18.25V10.1Z"
        fill="url(#docsFolderGradientLg)"
      />
      <path
        d="M3 7.75A1.75 1.75 0 0 1 4.75 6h4.02c.46 0 .9.18 1.22.5l.78.78c.33.33.77.52 1.24.52h7.24A1.75 1.75 0 0 1 21 9.55"
        fill="none"
        stroke="#D97706"
        strokeWidth={small ? '1.4' : '1'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 10.1c0-.97.78-1.75 1.75-1.75h14.5c.97 0 1.75.78 1.75 1.75v8.15A1.75 1.75 0 0 1 19.25 20h-14.5A1.75 1.75 0 0 1 3 18.25V10.1Z"
        fill="none"
        stroke="#D97706"
        strokeWidth={small ? '1.4' : '1'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function wrapDocBadge(entry: DocEntry, icon: React.ReactNode, small: boolean) {
  const isExcelSample = entry.type === 'file' && /\.xlsx?$/i.test(entry.name || '')
  const isZipFile = entry.type === 'file' && entry.iconKey === 'archive'
  const isPowerPointFile = entry.type === 'file' && /\.pptx?$/i.test(entry.name || '')
  if (!isExcelSample && !isZipFile && !isPowerPointFile) return icon

  return (
    <span className="relative inline-flex">
      {icon}
      {isExcelSample ? (
        <span
          className={`absolute right-[2px] top-[2px] inline-flex items-center justify-center rounded-md bg-emerald-600 text-white ${
            small ? 'h-3 min-w-3 px-0.5 text-[7px]' : 'h-4 min-w-4 px-1 text-[8px]'
          }`}
        >
          X
        </span>
      ) : null}
      {isZipFile ? (
        <span
          className={`absolute right-[2px] top-[2px] inline-flex items-center justify-center rounded-md bg-orange-600 text-white ${
            small ? 'h-3 min-w-3 px-0.5 text-[7px]' : 'h-4 min-w-4 px-1 text-[8px]'
          }`}
        >
          ZIP
        </span>
      ) : null}
      {isPowerPointFile ? (
        <span
          className={`absolute right-[2px] top-[2px] inline-flex items-center justify-center rounded-md bg-sky-600 text-white ${
            small ? 'h-3 min-w-3 px-0.5 text-[7px]' : 'h-4 min-w-4 px-1 text-[8px]'
          }`}
        >
          PP
        </span>
      ) : null}
    </span>
  )
}

function reasonToMessage(reason: string | null | undefined): string {
  if (!reason) return '처리 완료'
  if (reason === 'SAME_FOLDER') return '같은 폴더라 건너뜀'
  if (reason === 'NOT_FOUND') return '파일 없음'
  if (reason === 'FORBIDDEN') return '권한 없음'
  if (reason === 'DUPLICATE') return '대상 폴더에 같은 이름 파일이 있어 건너뜀'
  return reason
}

function summarizeBulkMoveReasons(
  results: Array<{ status: 'moved' | 'skipped' | 'failed'; reason: string | null }>
): string {
  const map: Record<string, number> = {}
  results.forEach((row) => {
    const key = row.reason || row.status
    map[key] = (map[key] || 0) + 1
  })
  return Object.entries(map)
    .map(([reason, count]) => `${reasonToMessage(reason)} ${count}건`)
    .join(' · ')
}

export default function AdminDocsPage() {
  const router = useRouter()
  const iconGridRef = useRef<HTMLDivElement | null>(null)
  const iconCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const hasInitializedCollapsedTreeRef = useRef(false)

  const [folders, setFolders] = useState<DocsFolderItem[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [activePanel, setActivePanel] = useState<'folders' | 'trash'>('folders')
  const [entries, setEntries] = useState<DocEntry[]>([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [trashCount, setTrashCount] = useState(0)
  const [trashPage, setTrashPage] = useState(1)
  const [trashSize] = useState(50)
  const [trashKeywordInput, setTrashKeywordInput] = useState('')
  const [trashKeywordApplied, setTrashKeywordApplied] = useState('')
  const [storageUsage, setStorageUsage] = useState<DocsStorageUsageResponse | null>(null)
  const [inlineCreateParentId, setInlineCreateParentId] = useState<number | null>(null)
  const [inlineCreateName, setInlineCreateName] = useState('')
  const [inlineCreateLoading, setInlineCreateLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [viewMode, setViewMode] = useState<DocsViewMode>('icon')
  const [listSortKey, setListSortKey] = useState<ListSortKey>('updated_at')
  const [listSortDirection, setListSortDirection] = useState<SortDirection>('desc')
  const [selectedIconEntryId, setSelectedIconEntryId] = useState<string | null>(null)
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([])
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<number>>(new Set())
  const [marquee, setMarquee] = useState<MarqueeState>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })
  const [dragging, setDragging] = useState<{
    itemId: string
    entryId: number
    sourceFolderId: number
  } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const [menuState, setMenuState] = useState<{
    open: boolean
    x: number
    y: number
    itemId: string | null
  }>({ open: false, x: 0, y: 0, itemId: null })

  const rootFolders = useMemo(() => folders.filter((row) => row.parent_id === null), [folders])

  const selectedFolder = useMemo(
    () => folders.find((row) => row.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  )

  const sharedProjectRootId = useMemo(
    () => folders.find((row) => row.system_key === 'shared_project_docs')?.id ?? null,
    [folders]
  )

  const childrenByParent = useMemo(() => {
    const map: Record<number, DocsFolderItem[]> = {}
    folders.forEach((row) => {
      if (row.parent_id == null) return
      map[row.parent_id] = map[row.parent_id] || []
      map[row.parent_id].push(row)
    })
    Object.keys(map).forEach((key) => {
      map[Number(key)].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
    })
    return map
  }, [folders])

  const projectCollaborativeFolderIds = useMemo(() => {
    const set = new Set<number>()
    if (!sharedProjectRootId) return set
    const queue: number[] = [sharedProjectRootId]
    while (queue.length > 0) {
      const current = queue.shift() as number
      if (set.has(current)) continue
      set.add(current)
      const children = childrenByParent[current] || []
      children.forEach((child) => queue.push(child.id))
    }
    return set
  }, [childrenByParent, sharedProjectRootId])

  const folderById = useMemo(() => {
    const map = new Map<number, DocsFolderItem>()
    folders.forEach((row) => map.set(row.id, row))
    return map
  }, [folders])

  const breadcrumbFolders = useMemo(() => {
    if (!selectedFolderId || activePanel === 'trash') return [] as DocsFolderItem[]
    const chain: DocsFolderItem[] = []
    let current = folderById.get(selectedFolderId) || null
    while (current) {
      chain.unshift(current)
      current = current.parent_id ? folderById.get(current.parent_id) || null : null
    }
    return chain
  }, [activePanel, folderById, selectedFolderId])

  const displayedEntries = entries

  const selectedFileEntryIds = useMemo(() => {
    return displayedEntries
      .filter((entry) => entry.type === 'file' && selectedEntryIds.includes(entry.id) && entry.entryId)
      .map((entry) => Number(entry.entryId))
      .filter((id) => Number.isFinite(id) && id > 0)
  }, [displayedEntries, selectedEntryIds])

  const selectedFileCount = selectedFileEntryIds.length
  const trashHasItems = trashCount > 0
  const selectedMenuEntry = useMemo(
    () => displayedEntries.find((entry) => entry.id === menuState.itemId) ?? null,
    [displayedEntries, menuState.itemId]
  )

  const loadFolderTree = useCallback(
    async (preferredFolderId?: number | null) => {
      setTreeLoading(true)
      try {
        const res = await fetchAdminDocsFolderTree()
        if (!hasInitializedCollapsedTreeRef.current) {
          const parentIds = new Set<number>()
          ;(res.items || []).forEach((row) => {
            if (
              row.parent_id !== null &&
              (res.items || []).some((candidate) => candidate.parent_id === row.id)
            ) {
              parentIds.add(row.id)
            }
          })
          setCollapsedFolderIds(parentIds)
          hasInitializedCollapsedTreeRef.current = true
        }
        setFolders(res.items || [])
        setSelectedFolderId((prev) => {
          const candidateIds = new Set((res.items || []).map((row) => row.id))
          if (preferredFolderId && candidateIds.has(preferredFolderId)) return preferredFolderId
          if (prev && candidateIds.has(prev)) return prev
          const personalRoot = (res.items || []).find((row) => row.system_key === 'personal_root')
          if (personalRoot) return personalRoot.id
          const personalMyDocs = (res.items || []).find((row) => row.system_key === 'personal_my_docs')
          if (personalMyDocs) return personalMyDocs.id
          const sharedProjectDocs = (res.items || []).find((row) => row.system_key === 'shared_project_docs')
          if (sharedProjectDocs) return sharedProjectDocs.id
          return (res.items || [])[0]?.id ?? null
        })
      } catch (error) {
        toast.error(resolveDocsErrorMessage(error))
      } finally {
        setTreeLoading(false)
      }
    },
    []
  )

  const loadFolderEntries = useCallback(async () => {
    if (activePanel === 'trash') {
      setEntriesLoading(true)
      try {
        const res = await fetchAdminDocsTrashEntries({
          page: trashPage,
          size: trashSize,
          q: trashKeywordApplied || undefined,
        })
        const mapped = (res.items || []).map(mapTrashEntryItemToUi)
        setEntries(mapped)
        setEntriesTotal(res.total ?? mapped.length)
        setTrashCount(res.total ?? 0)
      } catch (error) {
        setEntries([])
        setEntriesTotal(0)
        toast.error(resolveDocsErrorMessage(error))
      } finally {
        setEntriesLoading(false)
      }
      return
    }
    if (!selectedFolderId) {
      setEntries([])
      setEntriesTotal(0)
      return
    }
    setEntriesLoading(true)
    try {
      const sortBy = viewMode === 'list' ? listSortKey : undefined
      const order = viewMode === 'list' ? listSortDirection : undefined
      const res = await fetchAdminDocsFolderEntries({
        folderId: selectedFolderId,
        view: viewMode,
        sortBy,
        order,
      })
      const mapped = (res.items || []).map(mapEntryItemToUi)
      setEntries(mapped)
      setEntriesTotal(res.total ?? mapped.length)
    } catch (error) {
      setEntries([])
      setEntriesTotal(0)
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setEntriesLoading(false)
    }
  }, [activePanel, listSortDirection, listSortKey, selectedFolderId, viewMode, trashKeywordApplied, trashPage, trashSize])

  const refreshTrashCount = useCallback(async () => {
    try {
      const res = await fetchAdminDocsTrashCount()
      setTrashCount(res.count ?? 0)
    } catch {
      // ignore icon count refresh failure
    }
  }, [])

  const refreshStorageUsage = useCallback(async () => {
    try {
      const res = await fetchAdminDocsStorageUsage()
      setStorageUsage(res)
    } catch {
      // ignore storage usage refresh failure
    }
  }, [])

  useEffect(() => {
    void loadFolderTree()
  }, [loadFolderTree])

  useEffect(() => {
    void loadFolderEntries()
  }, [loadFolderEntries])

  useEffect(() => {
    void refreshTrashCount()
  }, [refreshTrashCount])

  useEffect(() => {
    void refreshStorageUsage()
  }, [refreshStorageUsage, entriesTotal, trashCount])

  useEffect(() => {
    setSelectedIconEntryId(null)
    setSelectedEntryIds([])
  }, [activePanel, selectedFolderId, viewMode])

  useEffect(() => {
    if (activePanel !== 'trash') return
    setTrashPage(1)
  }, [activePanel, trashKeywordApplied])

  const openContextMenu = (itemId: string, x: number, y: number) => {
    setMenuState({ open: true, x, y, itemId })
  }

  const isSelectableCard = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('[data-doc-card="true"]'))
  }

  const getMarqueeBox = () => {
    const container = iconGridRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const left = Math.min(marquee.startX, marquee.currentX) - rect.left
    const top = Math.min(marquee.startY, marquee.currentY) - rect.top
    const width = Math.abs(marquee.currentX - marquee.startX)
    const height = Math.abs(marquee.currentY - marquee.startY)
    return { left, top, width, height }
  }

  const updateMarqueeSelection = (box: { left: number; top: number; width: number; height: number }) => {
    const selectedIds = displayedEntries
      .filter((entry) => {
        const node = iconCardRefs.current[entry.id]
        const container = iconGridRef.current
        if (!node || !container) return false
        const containerRect = container.getBoundingClientRect()
        const nodeRect = node.getBoundingClientRect()
        const nodeLeft = nodeRect.left - containerRect.left
        const nodeTop = nodeRect.top - containerRect.top
        const nodeRight = nodeLeft + nodeRect.width
        const nodeBottom = nodeTop + nodeRect.height
        const boxRight = box.left + box.width
        const boxBottom = box.top + box.height
        return !(nodeRight < box.left || nodeLeft > boxRight || nodeBottom < box.top || nodeTop > boxBottom)
      })
      .map((entry) => entry.id)
    setSelectedEntryIds(selectedIds)
    setSelectedIconEntryId(selectedIds[0] || null)
  }

  useEffect(() => {
    if (!marquee.active) return
    const handleMouseMove = (event: MouseEvent) => {
      setMarquee((prev) => ({ ...prev, currentX: event.clientX, currentY: event.clientY }))
    }
    const handleMouseUp = () => {
      setMarquee((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [marquee.active])

  useEffect(() => {
    if (!marquee.active || viewMode !== 'icon') return
    const box = getMarqueeBox()
    if (!box) return
    updateMarqueeSelection(box)
  }, [displayedEntries, marquee.active, marquee.currentX, marquee.currentY, viewMode])

  const handleDragStart = (event: React.DragEvent, entry: DocEntry) => {
    if (activePanel === 'trash') return
    if (entry.type !== 'file' || !entry.entryId || !selectedFolderId) return
    event.dataTransfer.effectAllowed = 'move'
    setDragging({
      itemId: entry.id,
      entryId: entry.entryId,
      sourceFolderId: selectedFolderId,
    })
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOverFolderId(null)
  }

  const handleDropToFolder = async (targetFolderId: number) => {
    if (!dragging || actionLoading) return
    if (dragging.sourceFolderId === targetFolderId) {
      handleDragEnd()
      return
    }

    try {
      setActionLoading(true)
      const isMultiMove = selectedFileEntryIds.length > 1 && selectedEntryIds.includes(dragging.itemId)
      if (isMultiMove) {
        const moved = await moveAdminDocsEntriesBulk({
          entry_ids: selectedFileEntryIds,
          target_folder_id: targetFolderId,
        })
        const summary = `이동 ${moved.moved_count}건 · 건너뜀 ${moved.skipped_count}건 · 실패 ${moved.failed_count}건`
        if (moved.failed_count > 0 || moved.skipped_count > 0) {
          const reasonSummary = summarizeBulkMoveReasons(moved.results)
          toast(`${summary}${reasonSummary ? ` (${reasonSummary})` : ''}`)
        } else {
          toast.success(summary)
        }
      } else {
        await moveAdminDocsEntry(dragging.entryId, { target_folder_id: targetFolderId })
        toast.success('파일이 이동되었습니다.')
      }
      setSelectedEntryIds([])
      setSelectedIconEntryId(null)
      await loadFolderEntries()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
      handleDragEnd()
    }
  }

  const handleListSort = (key: ListSortKey) => {
    if (listSortKey === key) {
      setListSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setListSortKey(key)
    setListSortDirection(key === 'updated_at' ? 'desc' : 'asc')
  }

  const renderSortArrow = (key: ListSortKey) => {
    if (listSortKey !== key) return <span className="text-[10px] text-zinc-400">▾</span>
    return <span className="text-[10px] text-zinc-600">{listSortDirection === 'asc' ? '▴' : '▾'}</span>
  }

  const handleIconCardClick = (entryId: string, withToggle: boolean) => {
    if (withToggle) {
      setSelectedEntryIds((prev) => (prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]))
      setSelectedIconEntryId(entryId)
      return
    }
    setSelectedEntryIds([entryId])
    setSelectedIconEntryId(entryId)
  }

  const handleOpenEntry = async (entry: DocEntry) => {
    if (activePanel === 'trash') {
      if (entry.type === 'file') {
        toast('휴지통 파일은 우클릭 메뉴에서 복구/영구삭제를 진행해 주세요.')
        return
      }
    }
    if (entry.type === 'folder' && entry.folderId) {
      setActivePanel('folders')
      setSelectedFolderId(entry.folderId)
      return
    }
    if (entry.type === 'file' && entry.entryId) {
      if (isExcelEditableEntry(entry)) {
        const params = new URLSearchParams()
        params.set('name', entry.name)
        router.push(`/admin/docs/editor/${entry.entryId}?${params.toString()}`)
        return
      }
      if (isPreviewableEntry(entry)) {
        await handlePreviewFile(entry.entryId)
        return
      }
      await handleDownloadFile(entry.entryId)
      return
    }
    toast('상세 화면 준비중입니다.')
  }

  const startInlineCreateFolder = (parentId: number) => {
    if (actionLoading || inlineCreateLoading) return
    setInlineCreateParentId(parentId)
    setInlineCreateName('')
  }

  const cancelInlineCreateFolder = () => {
    if (inlineCreateLoading) return
    setInlineCreateParentId(null)
    setInlineCreateName('')
  }

  const submitInlineCreateFolder = async () => {
    if (!inlineCreateParentId || inlineCreateLoading || actionLoading) return
    const name = inlineCreateName.trim()
    if (!name) {
      cancelInlineCreateFolder()
      return
    }
    try {
      setInlineCreateLoading(true)
      await createAdminDocsFolder({
        parent_id: inlineCreateParentId,
        name,
      })
      setActivePanel('folders')
      setSelectedFolderId(inlineCreateParentId)
      setInlineCreateParentId(null)
      setInlineCreateName('')
      await loadFolderTree(inlineCreateParentId)
      await loadFolderEntries()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setInlineCreateLoading(false)
    }
  }

  const handleRenameSelectedFolder = async (folderId: number, currentName: string) => {
    if (actionLoading) return
    const nextName = window.prompt('폴더 이름을 입력해 주세요.', currentName)
    if (!nextName || !nextName.trim()) return
    try {
      setActionLoading(true)
      await renameAdminDocsFolder(folderId, { name: nextName.trim() })
      toast.success('폴더 이름이 변경되었습니다.')
      await loadFolderTree(selectedFolderId)
      await loadFolderEntries()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteSelectedFolder = async (folderId: number, folderName: string) => {
    if (actionLoading) return
    if (!window.confirm(`"${folderName}" 폴더를 삭제할까요?`)) return
    try {
      setActionLoading(true)
      await deleteAdminDocsFolder(folderId)
      toast.success('폴더가 삭제되었습니다.')
      const fallbackFolderId = selectedFolderId
      await loadFolderTree(fallbackFolderId)
      await loadFolderEntries()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadBulk = async () => {
    if (selectedFileEntryIds.length < 2 || actionLoading) return
    try {
      setActionLoading(true)
      const downloaded = await downloadAdminDocsEntriesBulk({ entry_ids: selectedFileEntryIds })
      saveBlobAsFile(downloaded.blob, downloaded.filename)
      toast.success(`묶음파일 다운로드를 시작했습니다. (${selectedFileEntryIds.length}개)`)
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleUploadFiles = async (targetFolderId: number, files: File[]) => {
    if (!targetFolderId || !files.length || actionLoading) return
    try {
      setActionLoading(true)
      let success = 0
      let failed = 0

      for (const file of files) {
        try {
          try {
            const uploadInfo = await issueAdminDocsEntryUploadUrl({
              folder_id: targetFolderId,
              file_name: file.name,
              content_type: file.type || 'application/octet-stream',
            })
            try {
              await uploadFileToPresignedUrl(uploadInfo.upload_url, file, file.type || 'application/octet-stream', 30000)
              await completeAdminDocsEntryUpload({
                folder_id: targetFolderId,
                file_name: file.name,
                storage_key: uploadInfo.storage_key,
                content_type: file.type || 'application/octet-stream',
              })
            } catch (uploadError) {
              const code = getAdminDocsErrorCode(uploadError)
              if (code) {
                throw uploadError
              }
              // presigned 경로 네트워크 실패 시에만 multipart 업로드로 폴백
              await uploadAdminDocsEntryMultipart({
                folder_id: targetFolderId,
                file,
              })
            }
          } catch (presignedError) {
            const code = getAdminDocsErrorCode(presignedError)
            if (code) {
              throw presignedError
            }
            // presigned-url 발급 실패가 네트워크성 오류면 multipart 폴백
            await uploadAdminDocsEntryMultipart({
              folder_id: targetFolderId,
              file,
            })
          }
          success += 1
        } catch (error) {
          failed += 1
          toast.error(`${file.name}: ${resolveDocsErrorMessage(error)}`)
        }
      }

      if (success > 0 && failed === 0) toast.success(`${success}개 파일 업로드 완료`)
      else if (success > 0) toast(`${success}개 성공 · ${failed}개 실패`)

      await loadFolderEntries()
      await refreshTrashCount()
    } finally {
      setActionLoading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  const handleDownloadFile = async (entryId: number) => {
    if (!entryId || actionLoading) return
    try {
      setActionLoading(true)
      const res = await fetchAdminDocsEntryDownloadUrl(entryId, 600)
      window.open(res.download_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handlePreviewFile = async (entryId: number) => {
    if (!entryId || actionLoading) return
    try {
      setActionLoading(true)
      const res = await fetchAdminDocsEntryPreviewUrl(entryId, 600)
      window.open(res.preview_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRenameFile = async (entryId: number, currentName: string) => {
    if (!entryId || actionLoading) return
    const nextName = window.prompt('파일 이름을 입력해 주세요.', currentName)
    if (!nextName || !nextName.trim()) return
    try {
      setActionLoading(true)
      await renameAdminDocsEntry(entryId, { name: nextName.trim() })
      toast.success('파일 이름이 변경되었습니다.')
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteFile = async (entryId: number, name: string) => {
    if (!entryId || actionLoading) return
    if (!window.confirm(`"${name}" 파일을 휴지통으로 이동할까요?`)) return
    try {
      setActionLoading(true)
      await deleteAdminDocsEntry(entryId)
      toast.success('파일이 휴지통으로 이동되었습니다.')
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestoreTrashFile = async (entryId: number) => {
    if (!entryId || actionLoading) return
    try {
      setActionLoading(true)
      await restoreAdminDocsTrashEntry(entryId)
      toast.success('파일이 복구되었습니다.')
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handlePurgeTrashFile = async (entryId: number, name: string) => {
    if (!entryId || actionLoading) return
    if (!window.confirm(`"${name}" 파일을 영구 삭제할까요?`)) return
    try {
      setActionLoading(true)
      await purgeAdminDocsTrashEntry(entryId)
      toast.success('파일이 영구 삭제되었습니다.')
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRestoreTrashFilesBulk = async () => {
    if (activePanel !== 'trash' || selectedFileEntryIds.length === 0 || actionLoading) return
    try {
      setActionLoading(true)
      const res = await restoreAdminDocsTrashEntriesBulk({ entry_ids: selectedFileEntryIds })
      toast.success(`복구 ${res.restored_count}건 · 실패 ${res.failed_count}건`)
      setSelectedEntryIds([])
      setSelectedIconEntryId(null)
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const handlePurgeTrashFilesBulk = async () => {
    if (activePanel !== 'trash' || selectedFileEntryIds.length === 0 || actionLoading) return
    if (!window.confirm(`선택된 ${selectedFileEntryIds.length}개 파일을 영구 삭제할까요?`)) return
    try {
      setActionLoading(true)
      const res = await purgeAdminDocsTrashEntriesBulk({ entry_ids: selectedFileEntryIds })
      toast.success(`영구삭제 ${res.deleted_count}건 · 실패 ${res.failed_count}건`)
      setSelectedEntryIds([])
      setSelectedIconEntryId(null)
      await loadFolderEntries()
      await refreshTrashCount()
    } catch (error) {
      toast.error(resolveDocsErrorMessage(error))
    } finally {
      setActionLoading(false)
    }
  }

  const contextMenuItems = useMemo<DocsContextMenuItem[]>(() => {
    if (!selectedMenuEntry) {
      return [
        { key: 'rename', label: '이름 변경', disabled: true },
        { key: 'move', label: '이동', disabled: true },
        { key: 'delete', label: '삭제', disabled: true },
      ]
    }

    if (activePanel === 'trash' && selectedMenuEntry.type === 'file' && selectedMenuEntry.entryId) {
      return [
        {
          key: 'restore',
          label: '복구',
          onClick: () => {
            void handleRestoreTrashFile(selectedMenuEntry.entryId as number)
          },
        },
        {
          key: 'delete-permanent',
          label: '영구 삭제',
          onClick: () => {
            void handlePurgeTrashFile(selectedMenuEntry.entryId as number, selectedMenuEntry.name)
          },
        },
      ]
    }

    if (selectedMenuEntry.type === 'folder' && selectedMenuEntry.folderId) {
      return [
        {
          key: 'rename',
          label: '이름 변경',
          onClick: () => {
            void handleRenameSelectedFolder(selectedMenuEntry.folderId as number, selectedMenuEntry.name)
          },
        },
        {
          key: 'move',
          label: '이동',
          onClick: () => toast('폴더 이동은 준비중입니다.'),
        },
        {
          key: 'delete',
          label: '삭제',
          onClick: () => {
            void handleDeleteSelectedFolder(selectedMenuEntry.folderId as number, selectedMenuEntry.name)
          },
        },
      ]
    }

    if (selectedMenuEntry.type === 'file' && selectedMenuEntry.entryId) {
      return [
        {
          key: 'preview',
          label: '미리보기',
          onClick: () => {
            void handlePreviewFile(selectedMenuEntry.entryId as number)
          },
        },
        {
          key: 'download',
          label: '다운로드',
          onClick: () => {
            void handleDownloadFile(selectedMenuEntry.entryId as number)
          },
        },
        {
          key: 'rename',
          label: '이름 변경',
          onClick: () => {
            void handleRenameFile(selectedMenuEntry.entryId as number, selectedMenuEntry.name)
          },
        },
        { key: 'move', label: '이동', onClick: () => toast('파일은 드래그로 이동해 주세요.') },
        {
          key: 'delete',
          label: '삭제',
          onClick: () => {
            void handleDeleteFile(selectedMenuEntry.entryId as number, selectedMenuEntry.name)
          },
        },
      ]
    }

    return [
      { key: 'rename', label: '이름 변경', disabled: true },
      { key: 'move', label: '이동', onClick: () => toast('파일은 드래그로 이동해 주세요.') },
      { key: 'delete', label: '삭제', disabled: true },
    ]
  }, [activePanel, selectedMenuEntry, selectedFolderId, actionLoading])

  const applyTrashSearch = () => {
    setTrashKeywordApplied(trashKeywordInput.trim())
    setTrashPage(1)
  }

  const clearTrashSearch = () => {
    setTrashKeywordInput('')
    setTrashKeywordApplied('')
    setTrashPage(1)
  }

  const marqueeBox = marquee.active ? getMarqueeBox() : null

  const renderFolderTree = (folder: DocsFolderItem, depth = 0) => {
    const isActive = selectedFolderId === folder.id
    const children = childrenByParent[folder.id] || []
    const hasChildren = children.length > 0
    const isExpanded = !collapsedFolderIds.has(folder.id)
    const isInlineCreateTarget = inlineCreateParentId === folder.id
    const isSystemFolder = Boolean(folder.system_key)
    const canManageFolder = folder.scope === 'personal' || projectCollaborativeFolderIds.has(folder.id)
    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-1 rounded-md ${
            isActive && activePanel === 'folders' ? 'bg-sky-100 text-sky-800' : ''
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setCollapsedFolderIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(folder.id)) next.delete(folder.id)
                  else next.add(folder.id)
                  return next
                })
              }}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100"
              aria-label={isExpanded ? '하위 폴더 접기' : '하위 폴더 펼치기'}
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="inline-flex h-5 w-5 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => {
              setActivePanel('folders')
              setSelectedFolderId(folder.id)
            }}
            onDragOver={(event) => {
              const hasExternalFiles = event.dataTransfer?.types?.includes('Files')
              if (!dragging && !hasExternalFiles) return
              event.preventDefault()
              setDragOverFolderId(folder.id)
            }}
            onDragLeave={() => {
              if (dragOverFolderId === folder.id) setDragOverFolderId(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              const externalFiles = Array.from(event.dataTransfer?.files || [])
              if (externalFiles.length > 0) {
                void handleUploadFiles(folder.id, externalFiles)
                setDragOverFolderId(null)
                return
              }
              void handleDropToFolder(folder.id)
            }}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition ${
              isActive && activePanel === 'folders' ? 'text-sky-800' : 'text-zinc-700 hover:bg-zinc-100'
            } ${dragOverFolderId === folder.id ? 'ring-1 ring-sky-300 bg-sky-50 text-sky-800' : ''}`}
          >
            {isActive ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
            <span className="truncate">{folder.name}</span>
          </button>
          {canManageFolder ? (
            <div className={`mr-1 inline-flex items-center gap-0.5 transition ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  startInlineCreateFolder(folder.id)
                }}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900"
                aria-label={`${folder.name} 하위 폴더 생성`}
                title="하위 폴더 만들기"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (isSystemFolder) return
                  void handleRenameSelectedFolder(folder.id, folder.name)
                }}
                disabled={isSystemFolder || actionLoading}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${folder.name} 이름 변경`}
                title={isSystemFolder ? '시스템 폴더는 이름 변경 불가' : '이름 변경'}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (isSystemFolder) return
                  void handleDeleteSelectedFolder(folder.id, folder.name)
                }}
                disabled={isSystemFolder || actionLoading}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${folder.name} 삭제`}
                title={isSystemFolder ? '시스템 폴더는 삭제 불가' : '폴더 삭제'}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : null}
        </div>
        {isInlineCreateTarget ? (
          <div className="mt-1" style={{ paddingLeft: `${22 + depth * 14}px` }}>
            <input
              type="text"
              value={inlineCreateName}
              autoFocus
              disabled={inlineCreateLoading}
              placeholder="새 폴더 이름"
              onChange={(event) => setInlineCreateName(event.target.value)}
              onBlur={() => {
                cancelInlineCreateFolder()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submitInlineCreateFolder()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelInlineCreateFolder()
                }
              }}
              className="h-7 w-[160px] rounded border border-zinc-300 px-2 text-xs text-zinc-800 outline-none focus:border-sky-500"
            />
          </div>
        ) : null}
        {hasChildren && isExpanded ? children.map((child) => renderFolderTree(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-64px)] flex-col bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            disabled={!selectedFolderId || actionLoading || activePanel === 'trash'}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            파일 업로드
          </UiButton>
          <input
            ref={uploadInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files || [])
              if (!files.length || !selectedFolderId || activePanel === 'trash') return
              void handleUploadFiles(selectedFolderId, files)
            }}
          />
          <UiButton variant="primary" size="sm" onClick={() => toast('문서 만들기 기능은 다음 단계에서 연동합니다.')}>
            <FileText className="mr-1 h-4 w-4" />
            문서 만들기
          </UiButton>
          <div className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-zinc-500">
            <button
              type="button"
              className="rounded px-1 py-0.5 text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                const fallback = sharedProjectRootId || breadcrumbFolders[0]?.id || rootFolders[0]?.id || null
                setActivePanel('folders')
                if (fallback) setSelectedFolderId(fallback)
              }}
            >
              문서함
            </button>
            {breadcrumbFolders.map((folder) => (
              <span key={folder.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                <button
                  type="button"
                  className={`rounded px-1 py-0.5 ${folder.id === selectedFolderId ? 'text-zinc-900' : 'hover:bg-zinc-100'}`}
                  onClick={() => {
                    setActivePanel('folders')
                    setSelectedFolderId(folder.id)
                  }}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="inline-flex items-center rounded-md border border-zinc-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('icon')}
            title="아이콘형 보기"
            className={`inline-flex h-7 items-center gap-1 rounded text-xs ${
              viewMode === 'icon' ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
            } ${viewMode === 'icon' ? 'px-2' : 'px-1.5'}`}
          >
            <Grid2X2 className="h-3.5 w-3.5" />
            {viewMode === 'icon' ? '아이콘형' : null}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="리스트형 보기"
            className={`inline-flex h-7 items-center gap-1 rounded text-xs ${
              viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
            } ${viewMode === 'list' ? 'px-2' : 'px-1.5'}`}
          >
            <List className="h-3.5 w-3.5" />
            {viewMode === 'list' ? '리스트형' : null}
          </button>
        </div>
      </div>

      {storageUsage ? (
        <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-zinc-700">
                저장공간 {formatStorageSize(storageUsage.used_total_bytes)} / {formatStorageSize(storageUsage.quota_bytes)}
              </p>
              {(storageUsage.plan_name || storageUsage.plan_code) ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                  {(storageUsage.plan_name || storageUsage.plan_code || '').toString().toUpperCase()}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <p
                className={`font-medium ${
                  storageUsage.hard_warn_95
                    ? 'text-rose-600'
                    : storageUsage.soft_warn_80
                      ? 'text-amber-600'
                      : 'text-zinc-600'
                }`}
              >
                남은 용량 {formatStorageSize(storageUsage.available_bytes)}
              </p>
              <span className="shrink-0 text-zinc-500">{toUsagePercent(storageUsage.usage_rate).toFixed(1)}%</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-200">
            <div
              className={`h-full transition-all ${
                storageUsage.hard_warn_95
                  ? 'bg-rose-500'
                  : storageUsage.soft_warn_80
                    ? 'bg-amber-500'
                    : 'bg-sky-500'
              }`}
              style={{ width: `${toUsagePercent(storageUsage.usage_rate)}%` }}
            />
          </div>
          {storageUsage.hard_warn_95 ? (
            <p className="mt-1 text-[11px] text-rose-600">저장공간 사용량이 95%를 초과했습니다. 정리가 필요합니다.</p>
          ) : null}
          {!storageUsage.hard_warn_95 && storageUsage.soft_warn_80 ? (
            <p className="mt-1 text-[11px] text-amber-700">저장공간 사용량이 80%를 초과했습니다.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid h-[calc(100vh-180px)] min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-zinc-200 lg:grid-cols-[280px_1fr]">
        <aside className="overflow-y-auto border-r border-zinc-200 bg-zinc-50/70 p-3">
          {treeLoading ? (
            <div className="px-2 py-4 text-xs text-zinc-500">폴더를 불러오는 중입니다...</div>
          ) : (
            <div className="space-y-0.5">
              {rootFolders.map((folder) => renderFolderTree(folder))}
              <div className="mt-2 border-t border-zinc-200 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('trash')}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition ${
                    activePanel === 'trash' ? 'bg-sky-100 text-sky-800' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <span className="relative inline-flex h-4 w-4 items-center justify-center">
                    {trashHasItems ? (
                      <Trash className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-zinc-500" />
                    )}
                    {trashHasItems ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-semibold leading-4 text-white">
                        {trashCount > 99 ? '99+' : trashCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">휴지통</span>
                </button>
              </div>
            </div>
          )}
        </aside>

        <section
          className="min-h-0 overflow-y-auto bg-white p-4"
          onDragOver={(event) => {
            const hasExternalFiles = event.dataTransfer?.types?.includes('Files')
            if ((!dragging && !hasExternalFiles) || !selectedFolderId || activePanel === 'trash') return
            event.preventDefault()
            setDragOverFolderId(selectedFolderId)
          }}
          onDragLeave={() => {
            if (dragOverFolderId === selectedFolderId) setDragOverFolderId(null)
          }}
          onDrop={(event) => {
            if (!selectedFolderId || activePanel === 'trash') return
            event.preventDefault()
            const externalFiles = Array.from(event.dataTransfer?.files || [])
            if (externalFiles.length > 0) {
              void handleUploadFiles(selectedFolderId, externalFiles)
              setDragOverFolderId(null)
              return
            }
            void handleDropToFolder(selectedFolderId)
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">
              {activePanel === 'trash' ? '휴지통' : selectedFolder?.name || '문서 목록'}
            </h2>
            <div className="flex items-center gap-2">
              {selectedEntryIds.length > 0 ? (
                <>
                  <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">선택 {selectedEntryIds.length}개</span>
                  <UiButton
                    variant="secondary"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => {
                      setSelectedEntryIds([])
                      setSelectedIconEntryId(null)
                    }}
                  >
                    선택 해제
                  </UiButton>
                  {activePanel === 'trash' ? (
                    <>
                      <UiButton
                        variant="secondary"
                        size="sm"
                        disabled={actionLoading || selectedFileCount === 0}
                        onClick={() => void handleRestoreTrashFilesBulk()}
                      >
                        일괄 복구
                      </UiButton>
                      <UiButton
                        variant="danger"
                        size="sm"
                        disabled={actionLoading || selectedFileCount === 0}
                        onClick={() => void handlePurgeTrashFilesBulk()}
                      >
                        일괄 영구삭제
                      </UiButton>
                    </>
                  ) : selectedFileCount >= 2 ? (
                    <UiButton
                      variant="primary"
                      size="sm"
                      disabled={actionLoading}
                      onClick={() => void handleDownloadBulk()}
                    >
                      묶음파일 다운로드
                    </UiButton>
                  ) : null}
                </>
              ) : null}
              <span className="text-xs text-zinc-500">총 {entriesTotal}건</span>
            </div>
          </div>

          {activePanel === 'trash' ? (
            <div className="mb-3 flex items-center gap-2">
              <UiSearchInput
                value={trashKeywordInput}
                onChange={setTrashKeywordInput}
                onSubmit={applyTrashSearch}
                onClear={clearTrashSearch}
                placeholder="휴지통 파일명 검색"
                wrapperClassName="h-9 w-full max-w-sm"
                inputClassName="text-sm"
              />
              <UiButton size="sm" variant="secondary" onClick={applyTrashSearch} disabled={actionLoading}>
                검색
              </UiButton>
            </div>
          ) : null}

          {entriesLoading ? (
            <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
              문서를 불러오는 중입니다...
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center">
              {activePanel === 'trash' ? <Trash2 className="h-10 w-10 text-zinc-300" /> : <FolderOpen className="h-10 w-10 text-zinc-300" />}
              <p className="mt-3 text-sm font-medium text-zinc-600">
                {activePanel === 'trash' ? '휴지통이 비어 있습니다.' : '문서가 없습니다.'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {activePanel === 'trash' ? '삭제된 문서는 우클릭 메뉴에서 복구/영구삭제할 수 있습니다.' : '새 문서를 만들어보세요.'}
              </p>
            </div>
          ) : viewMode === 'icon' ? (
            <div
              ref={iconGridRef}
              className={`relative flex min-h-[420px] flex-wrap content-start items-start gap-1 ${marquee.active ? 'select-none' : ''}`}
              onMouseDown={(event) => {
                if (event.button !== 0) return
                if (isSelectableCard(event.target)) return
                setSelectedEntryIds([])
                setSelectedIconEntryId(null)
                setMarquee({
                  active: true,
                  startX: event.clientX,
                  startY: event.clientY,
                  currentX: event.clientX,
                  currentY: event.clientY,
                })
              }}
            >
              {displayedEntries.map((entry) => {
                const isSelected = selectedEntryIds.includes(entry.id)
                const isPrimarySelected = selectedIconEntryId === entry.id
                const dropFolderId = entry.type === 'folder' ? entry.folderId || null : null
                const cardBaseClass = `rounded-lg p-1 text-center transition ${
                  isSelected ? 'bg-sky-200/20 shadow-sm' : 'bg-transparent hover:shadow-sm'
                } ${dropFolderId && dragOverFolderId === dropFolderId ? 'ring-1 ring-sky-300 bg-sky-50' : ''}`
                const cardLabelClass = `text-xs leading-tight text-zinc-800 ${isPrimarySelected ? 'whitespace-normal break-words' : 'truncate'}`

                return (
                  <div
                    key={entry.id}
                    className="relative min-h-[52px] w-[72px] overflow-visible"
                    ref={(node) => {
                      iconCardRefs.current[entry.id] = node
                    }}
                  >
                    <div
                      data-doc-card="true"
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setSelectedIconEntryId(entry.id)
                        openContextMenu(entry.id, event.clientX, event.clientY)
                      }}
                      onClick={(event) => handleIconCardClick(entry.id, event.metaKey || event.ctrlKey)}
                      onDoubleClick={() => void handleOpenEntry(entry)}
                      draggable={activePanel !== 'trash' && entry.type === 'file'}
                      onDragStart={(event) => handleDragStart(event, entry)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(event) => {
                        if (!dragging || !dropFolderId) return
                        event.preventDefault()
                        setDragOverFolderId(dropFolderId)
                      }}
                      onDragLeave={() => {
                        if (dropFolderId && dragOverFolderId === dropFolderId) setDragOverFolderId(null)
                      }}
                      onDrop={(event) => {
                        if (!dropFolderId) return
                        event.preventDefault()
                        void handleDropToFolder(dropFolderId)
                      }}
                      className={`${cardBaseClass} ${isPrimarySelected ? 'absolute left-0 right-0 top-0 z-30' : 'relative z-10'}`}
                    >
                      <div className="mb-0.5 flex justify-center">
                        <span className="inline-flex min-w-0 items-center justify-center">{renderDocIcon(entry)}</span>
                      </div>
                      <p className={cardLabelClass} title={entry.name}>
                        {entry.name}
                      </p>
                    </div>
                  </div>
                )
              })}

              {marqueeBox ? (
                <div
                  className="pointer-events-none absolute z-40 border-2 border-dashed border-sky-500 bg-sky-200/20"
                  style={{
                    left: marqueeBox.left,
                    top: marqueeBox.top,
                    width: marqueeBox.width,
                    height: marqueeBox.height,
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-zinc-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-zinc-900"
                        onClick={() => handleListSort('name')}
                      >
                        이름
                        {renderSortArrow('name')}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-zinc-900"
                        onClick={() => handleListSort('updated_at')}
                      >
                        {activePanel === 'trash' ? '삭제일' : '수정일'}
                        {renderSortArrow('updated_at')}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 hover:text-zinc-900"
                        onClick={() => handleListSort('size')}
                      >
                        크기
                        {renderSortArrow('size')}
                      </button>
                    </th>
                    <th className="w-12 px-2 py-2 text-center font-medium">메뉴</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        openContextMenu(entry.id, event.clientX, event.clientY)
                      }}
                      onDoubleClick={() => void handleOpenEntry(entry)}
                      draggable={activePanel !== 'trash' && entry.type === 'file'}
                      onDragStart={(event) => handleDragStart(event, entry)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(event) => {
                        if (!dragging || entry.type !== 'folder' || !entry.folderId) return
                        event.preventDefault()
                        setDragOverFolderId(entry.folderId)
                      }}
                      onDragLeave={() => {
                        if (entry.type === 'folder' && entry.folderId && dragOverFolderId === entry.folderId) {
                          setDragOverFolderId(null)
                        }
                      }}
                      onDrop={(event) => {
                        if (entry.type !== 'folder' || !entry.folderId) return
                        event.preventDefault()
                        void handleDropToFolder(entry.folderId)
                      }}
                      className={`cursor-pointer border-t border-zinc-200 hover:bg-zinc-50 ${
                        entry.type === 'folder' && entry.folderId && dragOverFolderId === entry.folderId ? 'bg-sky-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-800">
                        <div className="min-w-0">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-4 w-4 items-center justify-center">{renderDocIconSmall(entry)}</span>
                            <span className="truncate">{entry.name}</span>
                          </span>
                          {activePanel === 'trash' && entry.sourceFolderName ? (
                            <p className="mt-0.5 truncate pl-6 text-[11px] text-zinc-500">원본 폴더: {entry.sourceFolderName}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{activePanel === 'trash' ? entry.deletedAt || '-' : entry.updatedAt}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">{entry.size || '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect()
                            openContextMenu(entry.id, rect.right - 160, rect.bottom + 4)
                          }}
                          aria-label="더보기"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activePanel === 'trash' && entriesTotal > 0 ? (
            <Pagination
              page={trashPage}
              total={entriesTotal}
              limit={trashSize}
              onPageChange={(nextPage) => setTrashPage(nextPage)}
            />
          ) : null}
        </section>
      </div>

      <DocsContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={contextMenuItems}
        onClose={() => setMenuState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
