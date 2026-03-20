'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Plus,
  Upload,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import DocsContextMenu, { type DocsContextMenuItem } from '@/components/admin/docs/DocsContextMenu'

type FolderNode = {
  id: string
  label: string
  parentId: string | null
}

type DocEntry = {
  id: string
  type: 'folder' | 'file'
  name: string
  updatedAt: string
  size?: string
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

type ListSortKey = 'name' | 'updatedAt' | 'size'
type SortDirection = 'asc' | 'desc'
type MarqueeState = {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

const FOLDERS: FolderNode[] = [
  { id: 'personal-root', label: '개인 폴더함', parentId: null },
  { id: 'personal-my', label: '내 문서', parentId: 'personal-root' },
  { id: 'personal-project', label: '프로젝트 문서', parentId: 'personal-root' },
  { id: 'shared-root', label: '공용 자료실', parentId: null },
  { id: 'shared-forms', label: '양식 보관함', parentId: 'shared-root' },
]

const ENTRIES_BY_FOLDER: Record<string, DocEntry[]> = {
  'personal-root': [],
  'personal-my': [
    { id: 'doc-101', type: 'file', name: '샘플_기본파일.file', updatedAt: '2026-03-20 09:20', size: '12KB', iconKey: 'file' },
    { id: 'doc-102', type: 'file', name: '샘플_텍스트.txt', updatedAt: '2026-03-20 09:18', size: '14KB', iconKey: 'text' },
    { id: 'doc-103', type: 'file', name: '샘플_문서타입.docx', updatedAt: '2026-03-20 09:16', size: '11KB', iconKey: 'type' },
    { id: 'doc-104', type: 'file', name: '샘플_엑셀.xlsx', updatedAt: '2026-03-20 09:14', size: '13KB', iconKey: 'spreadsheet' },
    { id: 'doc-105', type: 'file', name: '샘플_압축.zip', updatedAt: '2026-03-20 09:12', size: '10KB', iconKey: 'archive' },
    { id: 'doc-106', type: 'file', name: '샘플_이미지.png', updatedAt: '2026-03-20 09:10', size: '9KB', iconKey: 'image' },
    { id: 'doc-107', type: 'file', name: '샘플_동영상.mp4', updatedAt: '2026-03-20 09:08', size: '16KB', iconKey: 'video' },
    { id: 'doc-108', type: 'file', name: '샘플_오디오.mp3', updatedAt: '2026-03-20 09:06', size: '8KB', iconKey: 'audio' },
    { id: 'doc-109', type: 'file', name: '샘플_코드.ts', updatedAt: '2026-03-20 09:04', size: '15KB', iconKey: 'code' },
    { id: 'doc-110', type: 'file', name: '샘플_JSON.json', updatedAt: '2026-03-20 09:02', size: '17KB', iconKey: 'json' },
    { id: 'doc-111', type: 'file', name: '샘플_검색.search', updatedAt: '2026-03-20 09:00', size: '18KB', iconKey: 'search' },
    { id: 'doc-112', type: 'file', name: '샘플_경고.warning', updatedAt: '2026-03-20 08:58', size: '19KB', iconKey: 'warning' },
    { id: 'doc-113', type: 'file', name: '샘플_잠금.lock', updatedAt: '2026-03-20 08:56', size: '20KB', iconKey: 'lock' },
    { id: 'doc-114', type: 'file', name: '샘플_배지.badge', updatedAt: '2026-03-20 08:54', size: '22KB', iconKey: 'badge' },
    { id: 'doc-115', type: 'file', name: '샘플_원형차트.chart', updatedAt: '2026-03-20 08:52', size: '21KB', iconKey: 'chart' },
    { id: 'doc-116', type: 'file', name: '샘플_막대차트.bar', updatedAt: '2026-03-20 08:50', size: '23KB', iconKey: 'bar' },
    { id: 'doc-117', type: 'file', name: '워드_결재문서_샘플.doc', updatedAt: '2026-03-20 08:48', size: '24KB', iconKey: 'type' },
    { id: 'doc-118', type: 'file', name: '파워포인트_보고서_샘플.pptx', updatedAt: '2026-03-20 08:46', size: '25KB', iconKey: 'type' },
    { id: 'doc-119', type: 'file', name: '한글문서_회의록_샘플.hwp', updatedAt: '2026-03-20 08:44', size: '26KB', iconKey: 'text' },
    { id: 'doc-120', type: 'folder', name: '참고자료', updatedAt: '2026-03-19 18:10' },
  ],
  'personal-project': [
    { id: 'doc-201', type: 'file', name: '프로젝트_초안.docx', updatedAt: '2026-03-18 14:31', size: '148KB' },
  ],
  'shared-root': [
    { id: 'doc-301', type: 'folder', name: '양식 보관함', updatedAt: '2026-03-15 11:03' },
    { id: 'doc-302', type: 'file', name: '공지_업무지침.pdf', updatedAt: '2026-03-13 16:07', size: '2.1MB' },
  ],
  'shared-forms': [],
}

function renderDocIcon(entry: DocEntry) {
  const icon = entry.type === 'folder' ? (
    renderFolderGradientIcon(false)
  ) : (
    renderDocFileIcon(entry, false)
  )
  return wrapDocBadge(entry, icon, false)
}

function renderDocIconSmall(entry: DocEntry) {
  const icon = entry.type === 'folder' ? (
    renderFolderGradientIcon(true)
  ) : (
    renderDocFileIcon(entry, true)
  )
  return wrapDocBadge(entry, icon, true)
}

function renderDocFileIcon(entry: DocEntry, small: boolean) {
  const isHangulDoc = entry.type === 'file' && /\.hwpx?$/i.test(entry.name || '')
  if (isHangulDoc) {
    return renderHangulFileIcon(small)
  }
  const isTxtDoc = entry.type === 'file' && /\.txt$/i.test(entry.name || '')
  if (isTxtDoc) {
    return renderTxtFileIcon(small)
  }

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
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        fill="#0284C7"
      />
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

function renderTxtFileIcon(small: boolean) {
  const sizeClass = small ? 'h-4 w-4' : 'h-10 w-10'
  return (
    <svg viewBox="0 0 24 24" className={sizeClass} aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        fill="#52525B"
      />
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

function wrapDocBadge(entry: DocEntry, icon: React.ReactNode, small: boolean) {
  const isExcelSample = entry.id === 'doc-104'
  const isZipFile = entry.type === 'file' && entry.iconKey === 'archive'
  const isPowerPointFile =
    entry.type === 'file' && /\.pptx?$/i.test(entry.name || '')
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

export default function AdminDocsPage() {
  const router = useRouter()
  const iconGridRef = useRef<HTMLDivElement | null>(null)
  const iconCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [selectedFolderId, setSelectedFolderId] = useState<string>('personal-root')
  const [viewMode, setViewMode] = useState<'icon' | 'list'>('icon')
  const [selectedIconEntryId, setSelectedIconEntryId] = useState<string | null>(null)
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([])
  const [marquee, setMarquee] = useState<MarqueeState>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })
  const [entriesByFolder, setEntriesByFolder] = useState<Record<string, DocEntry[]>>(() =>
    Object.fromEntries(Object.entries(ENTRIES_BY_FOLDER).map(([key, value]) => [key, [...value]]))
  )
  const [dragging, setDragging] = useState<{ entryId: string; sourceFolderId: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [listSortKey, setListSortKey] = useState<ListSortKey>('updatedAt')
  const [listSortDirection, setListSortDirection] = useState<SortDirection>('desc')
  const [menuState, setMenuState] = useState<{
    open: boolean
    x: number
    y: number
    entryId: string | null
  }>({ open: false, x: 0, y: 0, entryId: null })

  const rootFolders = useMemo(
    () => FOLDERS.filter((row) => row.parentId === null),
    []
  )
  const selectedFolder = useMemo(
    () => FOLDERS.find((row) => row.id === selectedFolderId) ?? null,
    [selectedFolderId]
  )
  const selectedEntries = entriesByFolder[selectedFolderId] || []
  const displayedEntries = useMemo(() => {
    if (viewMode === 'icon') {
      return [...selectedEntries].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        return a.name.localeCompare(b.name, 'ko-KR')
      })
    }

    const parseDateTime = (value: string) => {
      const normalized = value.replace(' ', 'T')
      const ts = Date.parse(normalized)
      return Number.isNaN(ts) ? 0 : ts
    }
    const parseSizeBytes = (size?: string) => {
      if (!size) return null
      const cleaned = size.trim().toUpperCase()
      const match = cleaned.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/)
      if (!match) return null
      const value = Number(match[1])
      const unit = match[2]
      const unitMap: Record<string, number> = {
        B: 1,
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4,
      }
      return Math.round(value * (unitMap[unit] || 1))
    }
    const compareNullableNumber = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0
      if (a == null) return 1
      if (b == null) return -1
      return a - b
    }

    const sorted = [...selectedEntries].sort((a, b) => {
      let compared = 0
      if (listSortKey === 'name') {
        compared = a.name.localeCompare(b.name, 'ko-KR')
      } else if (listSortKey === 'updatedAt') {
        compared = parseDateTime(a.updatedAt) - parseDateTime(b.updatedAt)
      } else if (listSortKey === 'size') {
        compared = compareNullableNumber(parseSizeBytes(a.size), parseSizeBytes(b.size))
      }
      return listSortDirection === 'asc' ? compared : -compared
    })

    return sorted
  }, [selectedEntries, viewMode, listSortDirection, listSortKey])

  useEffect(() => {
    setSelectedIconEntryId(null)
    setSelectedEntryIds([])
  }, [selectedFolderId, viewMode])

  const childrenByParent = useMemo(() => {
    const map: Record<string, FolderNode[]> = {}
    FOLDERS.forEach((row) => {
      if (!row.parentId) return
      map[row.parentId] = map[row.parentId] || []
      map[row.parentId].push(row)
    })
    return map
  }, [])

  const folderById = useMemo(() => {
    const map = new Map<string, FolderNode>()
    FOLDERS.forEach((row) => map.set(row.id, row))
    return map
  }, [])

  const breadcrumbFolders = useMemo(() => {
    const chain: FolderNode[] = []
    let current = folderById.get(selectedFolderId) || null
    while (current) {
      chain.unshift(current)
      current = current.parentId ? folderById.get(current.parentId) || null : null
    }
    return chain
  }, [folderById, selectedFolderId])

  const contextMenuItems = useMemo<DocsContextMenuItem[]>(
    () => [
      {
        key: 'rename',
        label: '이름 변경',
        onClick: () => toast('이름 변경 기능은 준비중입니다.'),
      },
      {
        key: 'move',
        label: '이동',
        onClick: () => toast('이동 기능은 준비중입니다.'),
      },
      {
        key: 'delete',
        label: '삭제',
        onClick: () => toast('삭제 기능은 준비중입니다.'),
      },
    ],
    []
  )

  const handleOpenEntry = (entryId: string) => {
    if (!entryId) {
      toast('상세 화면 준비중입니다.')
      return
    }
    router.push(`/admin/docs/${entryId}`)
  }

  const openContextMenu = (entryId: string, x: number, y: number) => {
    setMenuState({ open: true, x, y, entryId })
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
  }, [marquee.currentX, marquee.currentY, marquee.active, viewMode, displayedEntries])

  const moveEntryToFolder = (entryId: string, sourceFolderId: string, targetFolderId: string) => {
    if (!entryId || !sourceFolderId || !targetFolderId || sourceFolderId === targetFolderId) return
    setEntriesByFolder((prev) => {
      const sourceList = prev[sourceFolderId] || []
      const movedEntry = sourceList.find((entry) => entry.id === entryId)
      if (!movedEntry) return prev
      const nextSource = sourceList.filter((entry) => entry.id !== entryId)
      const targetList = prev[targetFolderId] || []
      if (targetList.some((entry) => entry.id === entryId)) return prev
      return {
        ...prev,
        [sourceFolderId]: nextSource,
        [targetFolderId]: [...targetList, movedEntry],
      }
    })
    toast.success('파일이 이동되었습니다.')
  }

  const handleDragStart = (entry: DocEntry) => {
    if (entry.type !== 'file') return
    setDragging({ entryId: entry.id, sourceFolderId: selectedFolderId })
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOverFolderId(null)
  }

  const handleDropToFolder = (targetFolderId: string) => {
    if (!dragging) return
    moveEntryToFolder(dragging.entryId, dragging.sourceFolderId, targetFolderId)
    handleDragEnd()
  }

  const handleListSort = (key: ListSortKey) => {
    if (listSortKey === key) {
      setListSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setListSortKey(key)
    setListSortDirection(key === 'updatedAt' ? 'desc' : 'asc')
  }

  const renderSortArrow = (key: ListSortKey) => {
    if (listSortKey !== key) {
      return <span className="text-[10px] text-zinc-400">▾</span>
    }
    return <span className="text-[10px] text-zinc-600">{listSortDirection === 'asc' ? '▴' : '▾'}</span>
  }

  const handleIconCardClick = (entryId: string, withToggle: boolean) => {
    if (withToggle) {
      setSelectedEntryIds((prev) =>
        prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
      )
      setSelectedIconEntryId(entryId)
      return
    }
    setSelectedEntryIds([entryId])
    setSelectedIconEntryId(entryId)
  }

  const selectedFileCount = useMemo(
    () =>
      displayedEntries.filter((entry) => entry.type === 'file' && selectedEntryIds.includes(entry.id)).length,
    [displayedEntries, selectedEntryIds]
  )

  const marqueeBox = marquee.active ? getMarqueeBox() : null

  const renderFolderTree = (folder: FolderNode, depth = 0) => {
    const isActive = selectedFolderId === folder.id
    const children = childrenByParent[folder.id] || []
    return (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => setSelectedFolderId(folder.id)}
          onDragOver={(event) => {
            if (!dragging) return
            event.preventDefault()
            setDragOverFolderId(folder.id)
          }}
          onDragLeave={() => {
            if (dragOverFolderId === folder.id) setDragOverFolderId(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            handleDropToFolder(folder.id)
          }}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
            isActive ? 'bg-sky-100 text-sky-800' : 'text-zinc-700 hover:bg-zinc-100'
          } ${dragOverFolderId === folder.id ? 'ring-1 ring-sky-300 bg-sky-50 text-sky-800' : ''}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {isActive ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
          <span className="truncate">{folder.label}</span>
        </button>
        {children.length > 0 ? children.map((child) => renderFolderTree(child, depth + 1)) : null}
      </div>
    )
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6">
      <div className="mb-4 flex items-end gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">문서함</h1>
        <p className="text-sm text-zinc-500">개인 문서와 공용 자료를 관리합니다.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UiButton variant="secondary" size="sm">
            <Plus className="mr-1 h-4 w-4" />
            새 폴더
          </UiButton>
          <UiButton variant="secondary" size="sm">
            <Upload className="mr-1 h-4 w-4" />
            파일 업로드
          </UiButton>
          <UiButton variant="primary" size="sm">
            <FileText className="mr-1 h-4 w-4" />
            문서 만들기
          </UiButton>
          <div className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm text-zinc-500">
            <button
              type="button"
              className="rounded px-1 py-0.5 text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                const fallback = breadcrumbFolders[0]?.id || 'personal-root'
                setSelectedFolderId(fallback)
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
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  {folder.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="inline-flex items-center rounded-md border border-zinc-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('icon')}
            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
              viewMode === 'icon' ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Grid2X2 className="h-3.5 w-3.5" />
            아이콘형
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs ${
              viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            리스트형
          </button>
        </div>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-zinc-200 lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-zinc-200 bg-zinc-50/70 p-3">
          <div className="space-y-1">
            {rootFolders.map((folder) => renderFolderTree(folder))}
          </div>
        </aside>

        <section
          className="bg-white p-4"
          onDragOver={(event) => {
            if (!dragging) return
            event.preventDefault()
            setDragOverFolderId(selectedFolderId)
          }}
          onDragLeave={() => {
            if (dragOverFolderId === selectedFolderId) setDragOverFolderId(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            handleDropToFolder(selectedFolderId)
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">{selectedFolder?.label || '문서 목록'}</h2>
            <div className="flex items-center gap-2">
              {selectedEntryIds.length > 0 ? (
                <>
                  <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                    선택 {selectedEntryIds.length}개
                  </span>
                  <UiButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedEntryIds([])
                      setSelectedIconEntryId(null)
                    }}
                  >
                    선택 해제
                  </UiButton>
                  {selectedFileCount >= 2 ? (
                    <UiButton
                      variant="primary"
                      size="sm"
                      onClick={() => toast('묶음파일 다운로드 기능은 백엔드 연동 후 활성화됩니다.')}
                    >
                      묶음파일 다운로드
                    </UiButton>
                  ) : null}
                </>
              ) : null}
              <span className="text-xs text-zinc-500">총 {selectedEntries.length}건</span>
            </div>
          </div>

          {displayedEntries.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center">
              <FolderOpen className="h-10 w-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-600">문서가 없습니다.</p>
              <p className="mt-1 text-xs text-zinc-500">새 문서를 만들어보세요.</p>
            </div>
          ) : viewMode === 'icon' ? (
            <div
              ref={iconGridRef}
              className={`relative flex flex-wrap items-start gap-3 ${marquee.active ? 'select-none' : ''}`}
              onMouseDown={(event) => {
                if (event.button !== 0 || isSelectableCard(event.target)) return
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
                return (
                  <div
                    key={entry.id}
                    className="relative h-[92px] w-[72px] overflow-visible"
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
                      onClick={(event) => {
                        handleIconCardClick(entry.id, event.metaKey || event.ctrlKey)
                      }}
                      onDoubleClick={() => handleOpenEntry(entry.id)}
                      draggable={entry.type === 'file'}
                      onDragStart={() => handleDragStart(entry)}
                      onDragEnd={handleDragEnd}
                      className={`absolute left-0 right-0 top-0 rounded-lg p-2 text-left transition ${
                        isPrimarySelected
                          ? 'z-30 h-auto min-h-full bg-sky-200/20 shadow-sm'
                          : isSelected
                            ? 'z-20 h-full bg-sky-200/20 shadow-sm'
                          : 'h-full bg-transparent hover:shadow-sm'
                      }`}
                    >
                      <div className="mb-2 flex justify-center">
                        <span className="inline-flex min-w-0 items-center justify-center">
                          {renderDocIcon(entry)}
                        </span>
                      </div>
                      <p
                        className={`text-xs text-zinc-800 ${
                          isPrimarySelected ? 'whitespace-normal break-words' : 'truncate'
                        }`}
                        title={entry.name}
                      >
                        {entry.name}
                      </p>
                    </div>
                  </div>
                )
              })}
              {marqueeBox ? (
                <div
                  className="pointer-events-none absolute border border-sky-400 bg-sky-200/20"
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
                        onClick={() => handleListSort('updatedAt')}
                      >
                        수정일
                        {renderSortArrow('updatedAt')}
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
                      onDoubleClick={() => handleOpenEntry(entry.id)}
                      draggable={entry.type === 'file'}
                      onDragStart={() => handleDragStart(entry)}
                      onDragEnd={handleDragEnd}
                      className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-50"
                    >
                      <td className="px-3 py-2 text-zinc-800">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-4 w-4 items-center justify-center">{renderDocIconSmall(entry)}</span>
                          <span className="truncate">{entry.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{entry.updatedAt}</td>
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
