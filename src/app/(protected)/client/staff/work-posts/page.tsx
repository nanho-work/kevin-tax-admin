'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import axios from 'axios'
import { useRouter, useSearchParams } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { toast } from 'react-hot-toast'
import FileDropzone from '@/components/common/FileDropzone'
import Pagination from '@/components/common/Pagination'
import UiButton from '@/components/common/UiButton'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  createClientWorkPost,
  deleteClientWorkPost,
  deleteClientWorkPostAttachment,
  fetchClientWorkPostDetail,
  fetchClientWorkPostReceipts,
  fetchClientWorkPosts,
  getClientWorkPostErrorMessage,
  updateClientWorkPost,
  uploadClientWorkPostAttachment,
} from '@/services/client/clientWorkPostService'
import { listClientAccounts } from '@/services/client/clientManagementService'
import { fetchClientCompanyTaxList } from '@/services/client/company'
import { getTeams } from '@/services/client/teamService'
import { useClientSessionContext } from '@/contexts/ClientSessionContext'
import type { AdminOut } from '@/types/admin'
import type { CompanyTaxDetail } from '@/types/admin_campany'
import type { ClientAccountOut } from '@/types/clientAccount'
import type { TeamOut } from '@/types/team'
import type {
  WorkPostAttachment,
  WorkPostCreatePayload,
  WorkPostDetail,
  WorkPostPriority,
  WorkPostReceipt,
  WorkPostStatus,
  WorkPostTargetIn,
  WorkPostTargetOut,
  WorkPostTargetType,
  WorkPostType,
  WorkPostUpdatePayload,
} from '@/types/workPost'
import { getClientRoleRank } from '@/utils/roleRank'
import { formatKSTDateTimeAssumeUTC } from '@/utils/dateTime'

const inputClass =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200'

type TargetDraftRow = {
  rowId: string
  target_type: WorkPostTargetType
  target_id: string
}

type EditorMode = 'create' | 'edit'
type BoardTabKey = 'notice' | 'library' | 'qna' | 'workflow' | 'forms' | 'free'

const postTypeOptions: Array<{ value: WorkPostType | ''; label: string }> = [
  { value: '', label: '전체 유형' },
  { value: 'notice', label: '공지' },
  { value: 'task', label: '업무지시' },
]

const postStatusOptions: Array<{ value: WorkPostStatus | ''; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'published', label: '게시' },
  { value: 'draft', label: '임시저장' },
  { value: 'archived', label: '보관' },
]

const editorStatusOptions: Array<{ value: WorkPostStatus; label: string }> = [
  { value: 'published', label: '게시' },
  { value: 'draft', label: '임시저장' },
  { value: 'archived', label: '보관' },
]

const priorityOptions: Array<{ value: WorkPostPriority; label: string }> = [
  { value: 'low', label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'critical', label: '긴급' },
]

const targetTypeOptions: Array<{ value: WorkPostTargetType; label: string }> = [
  { value: 'all_admin', label: '전체 직원' },
  { value: 'team', label: '팀' },
  { value: 'admin', label: '직원' },
  { value: 'all_company', label: '전체 고객사' },
  { value: 'company', label: '고객사' },
  { value: 'client_account', label: '클라이언트 계정' },
]

const statusBadgeClassMap: Record<WorkPostStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

const priorityLabelMap: Record<WorkPostPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  critical: '긴급',
}

const postTypeLabelMap: Record<WorkPostType, string> = {
  notice: '공지',
  task: '업무지시',
}

const boardTabs: Array<{ key: BoardTabKey; label: string }> = [
  { key: 'notice', label: '공지사항' },
  { key: 'library', label: '자료실' },
  { key: 'qna', label: 'QnA' },
  { key: 'workflow', label: '업무방식' },
  { key: 'forms', label: '서류양식' },
  { key: 'free', label: '자유게시판' },
]

function makeTargetRow(partial?: Partial<TargetDraftRow>): TargetDraftRow {
  return {
    rowId: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    target_type: partial?.target_type || 'all_admin',
    target_id: partial?.target_id || '',
  }
}

function requiresTargetId(type: WorkPostTargetType) {
  return type === 'team' || type === 'admin' || type === 'company' || type === 'client_account'
}

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatDateTime(value?: string | null): string {
  return formatKSTDateTimeAssumeUTC(value)
}

function formatBoardDate(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const now = new Date()
  const dayKey = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const isToday = dayKey.format(date) === dayKey.format(now)
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    ...(isToday
      ? { hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' }),
  })
    .format(date)
    .replace(/\.\s?$/, '')
}

function getErrorStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  return typeof error.response?.status === 'number' ? error.response.status : null
}

function getErrorDetail(error: unknown): string {
  if (!axios.isAxiosError(error)) return ''
  const detail = (error.response?.data as any)?.detail
  return typeof detail === 'string' ? detail : ''
}

export default function ClientWorkPostsPage() {
  const { session } = useClientSessionContext()
  const router = useRouter()
  const searchParams = useSearchParams()

  const sourceType = (searchParams.get('source_type') || '').toLowerCase()
  const sourceId = Number(searchParams.get('source_id') || searchParams.get('post_id') || '')
  const queryPostType = (searchParams.get('post_type') || '').toLowerCase()
  const isWorkPostSource =
    !sourceType ||
    sourceType === 'work_post' ||
    sourceType === 'work-post' ||
    sourceType === 'work_posts' ||
    sourceType === 'work-posts'
  const sourcePostId = Number.isFinite(sourceId) && sourceId > 0 && isWorkPostSource ? sourceId : null

  const [postType, setPostType] = useState<WorkPostType | ''>('notice')
  const [postStatus, setPostStatus] = useState<WorkPostStatus | ''>('')
  const [page, setPage] = useState(1)
  const [size] = useState(12)

  const [posts, setPosts] = useState<WorkPostDetail[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [selectedPost, setSelectedPost] = useState<WorkPostDetail | null>(null)
  const [selectedReceipts, setSelectedReceipts] = useState<WorkPostReceipt[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [form, setForm] = useState<{
    post_type: WorkPostType
    title: string
    body_html: string
    status: WorkPostStatus
    priority: WorkPostPriority
    due_at: string
  }>({
    post_type: 'notice',
    title: '',
    body_html: '',
    status: 'published',
    priority: 'normal',
    due_at: '',
  })
  const [targets, setTargets] = useState<TargetDraftRow[]>([makeTargetRow()])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const pendingFileInputId = useId()
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null)
  const [boardTab, setBoardTab] = useState<BoardTabKey>('notice')

  const [teams, setTeams] = useState<TeamOut[]>([])
  const [staffs, setStaffs] = useState<AdminOut[]>([])
  const [companies, setCompanies] = useState<CompanyTaxDetail[]>([])
  const [clientAccounts, setClientAccounts] = useState<ClientAccountOut[]>([])

  const totalPages = Math.max(1, Math.ceil(total / size))
  const isClientSuper = getClientRoleRank(session) === 0
  const isTaskView = postType === 'task'
  const isNoticeBoardTab = boardTab === 'notice'
  const showInlineDetail = false

  const receiptSummary = useMemo(() => {
    return selectedReceipts.reduce<Record<string, number>>((acc, receipt) => {
      acc[receipt.status] = (acc[receipt.status] || 0) + 1
      return acc
    }, {})
  }, [selectedReceipts])

  const teamOptionMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team.name]))
  }, [teams])

  const staffOptionMap = useMemo(() => {
    return new Map(staffs.map((staff) => [staff.id, `${staff.name} (${staff.login_id || staff.email})`]))
  }, [staffs])

  const companyOptionMap = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company.company_name]))
  }, [companies])

  const clientAccountOptionMap = useMemo(() => {
    return new Map(clientAccounts.map((account) => [account.id, `${account.name} (${account.login_id})`]))
  }, [clientAccounts])

  const canManagePost = useCallback(
    (post?: WorkPostDetail | null) => {
      if (!post) return false
      if (isClientSuper) return true
      if (post.created_by_type !== 'client_account') return false
      const writerId = Number(post.created_by_id || 0)
      const myAccountId = Number(session?.account_id || 0)
      return writerId > 0 && myAccountId > 0 && writerId === myAccountId
    },
    [isClientSuper, session?.account_id]
  )

  const canManageSelectedPost = useMemo(
    () => canManagePost(selectedPost),
    [canManagePost, selectedPost]
  )

  const canUploadAttachmentsInEditor = editorMode === 'create' || canManageSelectedPost

  const resetEditorForCreate = useCallback(() => {
    setEditorMode('create')
    setForm({
      post_type: 'notice',
      title: '',
      body_html: '',
      status: 'published',
      priority: 'normal',
      due_at: '',
    })
    setTargets([makeTargetRow()])
    setPendingFiles([])
  }, [])

  const openCreateEditor = useCallback(() => {
    resetEditorForCreate()
    setIsEditorOpen(true)
  }, [resetEditorForCreate])

  const applyEditorFromDetail = useCallback((detail: WorkPostDetail) => {
    setEditorMode('edit')
    setForm({
      post_type: detail.post_type,
      title: detail.title,
      body_html: detail.body_html,
      status: detail.status,
      priority: detail.priority,
      due_at: toLocalDateTimeInput(detail.due_at),
    })
    setTargets(
      detail.targets.length > 0
        ? detail.targets.map((target) =>
            makeTargetRow({
              target_type: target.target_type,
              target_id: target.target_id ? String(target.target_id) : '',
            })
          )
        : [makeTargetRow()]
    )
    setPendingFiles([])
  }, [])

  const openEditEditor = useCallback(() => {
    if (!selectedPost) {
      toast.error('수정할 게시글을 먼저 선택해 주세요.')
      return
    }
    if (!canManageSelectedPost) {
      toast.error('수정/삭제 권한이 없습니다.')
      return
    }
    applyEditorFromDetail(selectedPost)
    setIsEditorOpen(true)
  }, [applyEditorFromDetail, canManageSelectedPost, selectedPost])

  const loadReferences = useCallback(async () => {
    try {
      const [teamList, staffList, companyList, accountList] = await Promise.all([
        getTeams(),
        getClientStaffs(1, 200),
        fetchClientCompanyTaxList({ page: 1, limit: 100 }),
        listClientAccounts({ is_active: true }),
      ])

      setTeams(teamList || [])
      setStaffs((staffList.items || []).filter((staff) => staff.is_active))
      setCompanies(companyList.items || [])
      setClientAccounts((accountList || []).filter((account) => account.is_active))
    } catch {
      toast.error('참조 데이터를 불러오지 못했습니다. 일부 대상 선택이 제한될 수 있습니다.')
    }
  }, [])

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchClientWorkPosts({
        page,
        size,
        post_type: postType,
        status: postStatus,
      })
      setPosts(res.items as WorkPostDetail[])
      setTotal(res.total || 0)
    } catch (error) {
      toast.error(getClientWorkPostErrorMessage(error))
      setPosts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, size, postStatus, postType])

  const loadSelectedPost = useCallback(async (postId: number) => {
    try {
      setDetailLoading(true)
      const [detail, receipts] = await Promise.all([
        fetchClientWorkPostDetail(postId),
        fetchClientWorkPostReceipts(postId, { page: 1, size: 100 }),
      ])
      setSelectedPost(detail)
      setSelectedReceipts(receipts.items || [])
    } catch (error) {
      toast.error(getClientWorkPostErrorMessage(error))
      setSelectedPost(null)
      setSelectedReceipts([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReferences()
  }, [loadReferences])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  useEffect(() => {
    setPage(1)
  }, [postStatus, postType])

  useEffect(() => {
    if (queryPostType === 'notice' || queryPostType === 'task') {
      setPostType(queryPostType)
    }
  }, [queryPostType])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    if (!sourcePostId) return
    if (!posts.some((post) => post.id === sourcePostId)) return
    setSelectedPostId(sourcePostId)
  }, [posts, sourcePostId])

  useEffect(() => {
    if (!selectedPostId) {
      setSelectedPost(null)
      setSelectedReceipts([])
      return
    }
    void loadSelectedPost(selectedPostId)
  }, [selectedPostId, loadSelectedPost])

  useEffect(() => {
    if (!isEditorOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEditorOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEditorOpen])

  const updateTargetRow = (rowId: string, patch: Partial<TargetDraftRow>) => {
    setTargets((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row
        const nextTargetType = patch.target_type || row.target_type
        return {
          ...row,
          ...patch,
          target_id: requiresTargetId(nextTargetType) ? patch.target_id ?? row.target_id : '',
        }
      })
    )
  }

  const removeTargetRow = (rowId: string) => {
    setTargets((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.rowId !== rowId)
    })
  }

  const appendPendingFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    setPendingFiles((prev) => {
      const next = [...prev]
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (existing.has(key)) continue
        existing.add(key)
        next.push(file)
      }
      return next
    })
  }, [])

  const buildTargetsPayload = (): WorkPostTargetIn[] | null => {
    const normalized: WorkPostTargetIn[] = []
    const dedupe = new Set<string>()
    const activeStaffIdSet = new Set(staffs.filter((staff) => staff.is_active).map((staff) => Number(staff.id)))

    for (const row of targets) {
      if (!row.target_type) continue
      if (requiresTargetId(row.target_type)) {
        const parsed = Number(row.target_id)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          toast.error('대상 ID가 필요한 항목은 값을 선택해 주세요.')
          return null
        }
        if (row.target_type === 'admin' && !activeStaffIdSet.has(parsed)) {
          toast.error('비활성(퇴사) 직원은 수신 대상으로 선택할 수 없습니다.')
          return null
        }
        const key = `${row.target_type}:${parsed}`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        normalized.push({ target_type: row.target_type, target_id: parsed })
      } else {
        const key = `${row.target_type}:null`
        if (dedupe.has(key)) continue
        dedupe.add(key)
        normalized.push({ target_type: row.target_type })
      }
    }

    return normalized
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    const body = form.body_html.trim()
    if (!title) {
      toast.error('제목을 입력해 주세요.')
      return
    }
    if (!body) {
      toast.error('본문을 입력해 주세요.')
      return
    }

    const targetsPayload = buildTargetsPayload()
    if (targetsPayload === null) return

    const dueAt = form.due_at.trim() || null
    const basePayload = {
      post_type: form.post_type,
      title,
      body_html: body,
      status: form.status,
      priority: form.priority,
      due_at: dueAt,
      targets: targetsPayload,
    }
    let uploadPhase = false

    try {
      setSubmitting(true)
      if (editorMode === 'edit' && !canManageSelectedPost) {
        toast.error('수정/삭제 권한이 없습니다.')
        return
      }

      let saved: WorkPostDetail
      if (editorMode === 'create') {
        saved = await createClientWorkPost(basePayload as WorkPostCreatePayload)
      } else {
        if (!selectedPostId) {
          toast.error('수정할 게시글을 먼저 선택해 주세요.')
          return
        }
        saved = await updateClientWorkPost(selectedPostId, basePayload as WorkPostUpdatePayload)
      }

      if (pendingFiles.length > 0) {
        if (!canUploadAttachmentsInEditor) {
          toast.error('수정/삭제 권한이 없습니다.')
          return
        }
        uploadPhase = true
        for (const file of pendingFiles) {
          await uploadClientWorkPostAttachment(saved.id, file)
        }
      }

      toast.success(editorMode === 'create' ? '게시글이 등록되었습니다.' : '게시글이 수정되었습니다.')
      setPendingFiles([])
      await loadPosts()
      setIsEditorOpen(false)
      const q = new URLSearchParams()
      if (form.post_type) q.set('post_type', form.post_type)
      router.push(`/client/staff/work-posts/${saved.id}${q.toString() ? `?${q.toString()}` : ''}`)
    } catch (error) {
      const status = getErrorStatus(error)
      if (status === 403 && (editorMode === 'edit' || uploadPhase)) {
        toast.error('수정/삭제 권한이 없습니다.')
        return
      }
      if (uploadPhase && status === 400) {
        toast.error(getErrorDetail(error) || '파일 정책 위반으로 업로드할 수 없습니다.')
        return
      }
      if (uploadPhase && status === 409) {
        toast.error('동시 업로드 충돌, 다시 시도해 주세요.')
        return
      }
      toast.error(getClientWorkPostErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async () => {
    if (!selectedPostId) return
    if (!canManageSelectedPost) {
      toast.error('수정/삭제 권한이 없습니다.')
      return
    }
    if (!window.confirm('선택한 게시글을 삭제하시겠습니까?')) return

    try {
      setDeleting(true)
      await deleteClientWorkPost(selectedPostId)
      toast.success('게시글이 삭제되었습니다.')
      setSelectedPostId(null)
      setSelectedPost(null)
      setSelectedReceipts([])
      resetEditorForCreate()
      setIsEditorOpen(false)
      await loadPosts()
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        toast.error('수정/삭제 권한이 없습니다.')
        return
      }
      toast.error(getClientWorkPostErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!selectedPostId) return
    if (!canManageSelectedPost) {
      toast.error('수정/삭제 권한이 없습니다.')
      return
    }
    if (!window.confirm('첨부파일을 삭제하시겠습니까?')) return

    try {
      setDeletingAttachmentId(attachmentId)
      await deleteClientWorkPostAttachment(selectedPostId, attachmentId)
      toast.success('첨부파일이 삭제되었습니다.')
      await loadSelectedPost(selectedPostId)
    } catch (error) {
      const status = getErrorStatus(error)
      if (status === 403) {
        toast.error('수정/삭제 권한이 없습니다.')
        return
      }
      toast.error(getClientWorkPostErrorMessage(error))
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const getTargetLabel = (target: WorkPostTargetOut) => {
    if (target.target_type === 'all_admin') return '전체 직원'
    if (target.target_type === 'all_company') return '전체 고객사'
    if (target.target_type === 'team') return teamOptionMap.get(target.target_id || 0) || `팀 #${target.target_id}`
    if (target.target_type === 'admin') return staffOptionMap.get(target.target_id || 0) || `직원 #${target.target_id}`
    if (target.target_type === 'company') return companyOptionMap.get(target.target_id || 0) || `고객사 #${target.target_id}`
    if (target.target_type === 'client_account') {
      return clientAccountOptionMap.get(target.target_id || 0) || `클라이언트계정 #${target.target_id}`
    }
    return target.target_type
  }

  const openAttachment = (attachment: WorkPostAttachment, action: 'preview' | 'download') => {
    const url = action === 'preview' ? attachment.preview_url : attachment.download_url
    if (!url) {
      toast.error('첨부 URL이 없습니다.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="space-y-2">
      <div className="px-1 py-1">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">게시판</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {isTaskView ? '업무지시를 관리하고 수신 현황을 확인합니다.' : '공지사항 게시판입니다.'}
            </p>
          </div>
        </div>
      </div>

      {!isTaskView ? (
        <div className="border-b border-neutral-200 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {boardTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setBoardTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  boardTab === tab.key
                    ? 'bg-sky-600 font-medium text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!isTaskView && !isNoticeBoardTab ? (
        <div className="border border-dashed border-neutral-300 bg-transparent p-10 text-center">
          <p className="text-sm text-zinc-500">준비중인 메뉴입니다.</p>
        </div>
      ) : null}

      {isTaskView || isNoticeBoardTab ? (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={showInlineDetail ? 'xl:col-span-4' : 'xl:col-span-12'}>
          <div className="bg-transparent px-0 py-2">
            <div>
              {loading ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">불러오는 중...</div>
              ) : posts.length === 0 ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  표시할 게시글이 없습니다.
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-zinc-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-xs">
                      <thead className="bg-white text-zinc-600">
                        <tr className="border-b border-zinc-200">
                          <th className="w-12 px-2 py-2 text-center font-medium">번호</th>
                          <th className="px-2 py-2 text-left font-medium">제목</th>
                          <th className="w-16 px-2 py-2 text-center font-medium">첨부</th>
                          <th className="w-24 px-2 py-2 text-center font-medium">작성자</th>
                          <th className="w-28 px-2 py-2 text-center font-medium">작성일</th>
                          <th className="w-16 px-2 py-2 text-center font-medium">조회수</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {posts.map((post, index) => {
                          const rowNumber = Math.max(1, total - (page - 1) * size - index)
                          const writerLabel =
                            post.created_by_type === 'client_account'
                              ? clientAccounts.find((account) => account.id === Number(post.created_by_id || 0))?.name ||
                                `클라이언트#${post.created_by_id || ''}`.replace(/#$/, '')
                              : post.created_by_type === 'admin'
                                ? '직원'
                                : '시스템'
                          return (
                            <tr
                              key={post.id}
                              onClick={() => {
                                const q = new URLSearchParams()
                                if (postType) q.set('post_type', postType)
                                router.push(`/client/staff/work-posts/${post.id}${q.toString() ? `?${q.toString()}` : ''}`)
                              }}
                              className={`cursor-pointer border-t border-zinc-100 bg-white transition first:border-t-0 ${
                                'hover:bg-zinc-50'
                              }`}
                            >
                              <td className="px-2 py-2 text-center text-zinc-600">{rowNumber}</td>
                              <td className="px-2 py-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">
                                    {postTypeLabelMap[post.post_type]}
                                  </span>
                                  <span className="truncate text-sm font-medium text-zinc-900">{post.title}</span>
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClassMap[post.status]}`}>
                                    {post.status === 'draft' ? '임시저장' : post.status === 'published' ? '게시' : '보관'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center text-zinc-600">
                                {post.attachment_count > 0 ? (
                                  <span className="inline-flex items-center justify-center" title={`${post.attachment_count}개`}>
                                    <Paperclip className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-zinc-600">{writerLabel}</td>
                              <td className="px-2 py-2 text-center text-zinc-600">{formatBoardDate(post.created_at)}</td>
                              <td className="px-2 py-2 text-center text-zinc-500">-</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-zinc-200 pt-2">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <div>
                  <UiButton
                    size="sm"
                    variant={editorMode === 'create' && isEditorOpen ? 'primary' : 'secondary'}
                    onClick={openCreateEditor}
                  >
                    새 글 작성
                  </UiButton>
                </div>
                <div className="text-xs text-zinc-500">
                  <Pagination className="justify-center" page={page} total={total} limit={size} onPageChange={setPage} />
                </div>
                <div className="text-right text-xs text-zinc-500">총 {total}건</div>
              </div>
            </div>
          </div>
        </div>

        {showInlineDetail ? <div className="xl:col-span-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-base font-semibold text-zinc-900">선택 게시글 상세</h2>
            {!selectedPostId ? (
              <p className="mt-2 text-sm text-zinc-500">왼쪽 목록에서 게시글을 선택해 주세요.</p>
            ) : detailLoading ? (
              <p className="mt-2 text-sm text-zinc-500">상세 정보를 불러오는 중...</p>
            ) : !selectedPost ? (
              <p className="mt-2 text-sm text-zinc-500">게시글 상세를 불러오지 못했습니다.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <p className="text-zinc-600">
                    유형: <span className="font-medium text-zinc-900">{postTypeLabelMap[selectedPost.post_type]}</span>
                  </p>
                  <p className="text-zinc-600">
                    우선순위: <span className="font-medium text-zinc-900">{priorityLabelMap[selectedPost.priority]}</span>
                  </p>
                  <p className="text-zinc-600">
                    상태: <span className="font-medium text-zinc-900">{selectedPost.status}</span>
                  </p>
                  <p className="text-zinc-600">
                    작성일: <span className="font-medium text-zinc-900">{formatDateTime(selectedPost.created_at)}</span>
                  </p>
                  <p className="text-zinc-600">
                    게시일: <span className="font-medium text-zinc-900">{formatDateTime(selectedPost.published_at)}</span>
                  </p>
                  <p className="text-zinc-600">
                    마감일: <span className="font-medium text-zinc-900">{formatDateTime(selectedPost.due_at)}</span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">제목</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{selectedPost.title}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">대상</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedPost.targets.length === 0 ? (
                      <span className="text-sm text-zinc-500">설정된 대상이 없습니다.</span>
                    ) : (
                      selectedPost.targets.map((target) => (
                        <span key={target.id} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                          {getTargetLabel(target)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">본문</p>
                  <div
                    className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800"
                    dangerouslySetInnerHTML={{ __html: selectedPost.body_html }}
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">첨부파일</p>
                  <div className="mt-2 space-y-2">
                    {selectedPost.attachments.length === 0 ? (
                      <p className="text-sm text-zinc-500">첨부파일이 없습니다.</p>
                    ) : (
                      selectedPost.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-800">{attachment.file_name}</p>
                            <p className="text-xs text-zinc-500">
                              버전 {attachment.version_no} · {formatDateTime(attachment.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <UiButton size="xs" onClick={() => openAttachment(attachment, 'preview')}>
                              미리보기
                            </UiButton>
                            <UiButton size="xs" onClick={() => openAttachment(attachment, 'download')}>
                              다운로드
                            </UiButton>
                            <UiButton
                              size="xs"
                              variant="danger"
                              disabled={deletingAttachmentId === attachment.id || !canManageSelectedPost}
                              onClick={() => void handleDeleteAttachment(attachment.id)}
                            >
                              삭제
                            </UiButton>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">수신 현황</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-700">
                    <span className="rounded-full bg-zinc-100 px-2 py-1">전체 {selectedReceipts.length}</span>
                    <span className="rounded-full bg-sky-100 px-2 py-1">안읽음 {receiptSummary.unread || 0}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1">읽음 {receiptSummary.read || 0}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1">확인 {receiptSummary.ack || 0}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1">진행중 {receiptSummary.in_progress || 0}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-1">완료 {receiptSummary.done || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div> : null}
      </div>
      ) : null}

      {isEditorOpen ? <button type="button" aria-label="작성 패널 닫기" className="fixed inset-0 z-40 bg-black/30" onClick={() => setIsEditorOpen(false)} /> : null}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-2xl border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-200 ${
          isEditorOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {editorMode === 'create' ? '새 게시글 작성' : '게시글 수정'}
            </h2>
            <UiButton size="xs" variant="secondary" onClick={() => setIsEditorOpen(false)}>
              닫기
            </UiButton>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">유형</label>
                <select
                  className={inputClass}
                  value={form.post_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, post_type: e.target.value as WorkPostType }))}
                >
                  <option value="notice">공지</option>
                  <option value="task">업무지시</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">상태</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as WorkPostStatus }))}
                >
                  {editorStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">우선순위</label>
                <select
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as WorkPostPriority }))}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600">마감일(선택)</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.due_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">제목</label>
              <input
                type="text"
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="제목을 입력해 주세요."
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">본문</label>
              <RichTextEditor value={form.body_html} onChange={(value) => setForm((prev) => ({ ...prev, body_html: value }))} preset="workPost" />
            </div>

            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-900">대상 설정</p>
                <UiButton size="xs" onClick={() => setTargets((prev) => [...prev, makeTargetRow()])}>
                  대상 추가
                </UiButton>
              </div>
              <div className="space-y-2">
                {targets.map((row) => (
                  <div key={row.rowId} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <select
                        className={inputClass}
                        value={row.target_type}
                        onChange={(e) =>
                          updateTargetRow(row.rowId, {
                            target_type: e.target.value as WorkPostTargetType,
                            target_id: '',
                          })
                        }
                      >
                        {targetTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      {row.target_type === 'team' ? (
                        <select
                          className={inputClass}
                          value={row.target_id}
                          onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                        >
                          <option value="">팀 선택</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      ) : row.target_type === 'admin' ? (
                        <select
                          className={inputClass}
                          value={row.target_id}
                          onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                        >
                          <option value="">직원 선택</option>
                          {staffs
                            .filter((staff) => staff.is_active)
                            .map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name} ({staff.login_id || staff.email})
                              </option>
                            ))}
                        </select>
                      ) : row.target_type === 'company' ? (
                        <select
                          className={inputClass}
                          value={row.target_id}
                          onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                        >
                          <option value="">고객사 선택</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.company_name}
                            </option>
                          ))}
                        </select>
                      ) : row.target_type === 'client_account' ? (
                        <select
                          className={inputClass}
                          value={row.target_id}
                          onChange={(e) => updateTargetRow(row.rowId, { target_id: e.target.value })}
                        >
                          <option value="">클라이언트 계정 선택</option>
                          {clientAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.login_id})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" className={inputClass} value="대상 ID 없음" disabled />
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <UiButton
                        className="w-full"
                        size="md"
                        variant="danger"
                        disabled={targets.length <= 1}
                        onClick={() => removeTargetRow(row.rowId)}
                      >
                        삭제
                      </UiButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">첨부파일</label>
              <input id={pendingFileInputId} type="file" multiple className="hidden" onChange={(e) => {
                if (!canUploadAttachmentsInEditor) return
                appendPendingFiles(e.target.files)
                e.currentTarget.value = ''
              }} />
              <div className="flex flex-wrap items-stretch gap-2">
                <FileDropzone
                  onFilesDrop={appendPendingFiles}
                  disabled={!canUploadAttachmentsInEditor}
                  className="flex min-h-10 min-w-[240px] flex-1 items-center rounded-md border border-dashed px-3 text-xs transition"
                  idleClassName="border-zinc-300 bg-white text-zinc-500"
                  activeClassName="border-zinc-500 bg-zinc-50 text-zinc-800"
                >
                  파일을 드래그해서 첨부
                </FileDropzone>
                <label
                  htmlFor={pendingFileInputId}
                  className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition ${
                    canUploadAttachmentsInEditor
                      ? 'cursor-pointer border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                      : 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                  }`}
                >
                  파일 선택
                </label>
              </div>
              {pendingFiles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendingFiles.map((file, index) => (
                    <button
                      key={`${file.name}-${file.size}-${index}`}
                      type="button"
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      {file.name} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4">
            <UiButton variant="secondary" onClick={resetEditorForCreate}>
              초기화
            </UiButton>
            <UiButton
              variant="primary"
              disabled={submitting || (editorMode === 'edit' && !canManageSelectedPost)}
              onClick={() => void handleSubmit()}
            >
              {submitting ? '저장 중...' : editorMode === 'create' ? '등록' : '수정'}
            </UiButton>
          </div>
        </div>
      </aside>
    </section>
  )
}
