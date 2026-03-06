import type { AxiosError } from 'axios'
import { clientHttp } from '@/services/http'
import type {
  ClientBookkeepingBillingCreateRequest,
  ClientBookkeepingBillingListFilters,
  ClientBookkeepingBillingListResponse,
  ClientBookkeepingBillingOut,
  ClientBookkeepingBillingStatusPatchRequest,
  ClientBookkeepingBillingUpdateRequest,
  ClientBookkeepingContractCreateRequest,
  ClientBookkeepingGenerateBillingsRequest,
  ClientBookkeepingGenerateBillingsResponse,
  ClientBookkeepingContractBulkApplyResponse,
  ClientBookkeepingContractBulkPreviewResponse,
  ClientBookkeepingContractListFilters,
  ClientBookkeepingContractListResponse,
  ClientBookkeepingContractOut,
  ClientBookkeepingContractUpdateRequest,
  ClientBookkeepingSummaryResponse,
  ClientBookkeepingYearsSummaryResponse,
  ClientBillingSyncReceiptsResponse,
  ClientDebitReceiptListFilters,
  ClientDebitReceiptListResponse,
  ClientDebitReceiptSummaryResponse,
  MessageOut,
  ClientDebitUploadBatchListFilters,
  ClientDebitUploadBatchListResponse,
  ClientDebitUploadBatchOut,
  ClientDebitBatchRematchResponse,
  ClientDebitUploadItemLinkRequest,
  ClientDebitUploadItemListFilters,
  ClientDebitUploadItemListResponse,
  ClientDebitUploadItemOut,
} from '@/types/clientBookkeeping'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/bookkeeping`

type ApiErrorDetailItem = {
  msg?: string
}

type ApiErrorPayload = {
  detail?: string | ApiErrorDetailItem[] | null
}

function extractDetail(error: unknown): string | undefined {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const detail = axiosError?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const first = detail[0]?.msg
    if (typeof first === 'string' && first.trim()) return first
  }
  return undefined
}

export function getClientBookkeepingErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorPayload>
  const status = axiosError?.response?.status
  const detail = extractDetail(error)
  if (status === 400) return detail || '요청값이 올바르지 않습니다.'
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '권한이 없습니다.'
  if (status === 404) return detail || '요청한 데이터를 찾을 수 없습니다.'
  if (status === 409) return detail || '중복 데이터 또는 상태 충돌이 발생했습니다.'
  return detail || '서버 요청 처리 중 오류가 발생했습니다.'
}

export async function createBookkeepingContract(
  payload: ClientBookkeepingContractCreateRequest
): Promise<ClientBookkeepingContractOut> {
  const res = await clientHttp.post<ClientBookkeepingContractOut>(`${BASE}/contracts`, payload)
  return res.data
}

export async function listBookkeepingContracts(
  filters: ClientBookkeepingContractListFilters = {}
): Promise<ClientBookkeepingContractListResponse> {
  const res = await clientHttp.get<ClientBookkeepingContractListResponse>(`${BASE}/contracts`, { params: filters })
  return res.data
}

export async function updateBookkeepingContract(
  contractId: number,
  payload: ClientBookkeepingContractUpdateRequest
): Promise<ClientBookkeepingContractOut> {
  const res = await clientHttp.put<ClientBookkeepingContractOut>(`${BASE}/contracts/${contractId}`, payload)
  return res.data
}

export async function patchBookkeepingContractActive(
  contractId: number,
  isActive: boolean
): Promise<ClientBookkeepingContractOut> {
  const res = await clientHttp.patch<ClientBookkeepingContractOut>(`${BASE}/contracts/${contractId}/active`, null, {
    params: { is_active: isActive },
  })
  return res.data
}

export async function generateBookkeepingContractBillings(
  contractId: number,
  payload: ClientBookkeepingGenerateBillingsRequest = {}
): Promise<ClientBookkeepingGenerateBillingsResponse> {
  const res = await clientHttp.post<ClientBookkeepingGenerateBillingsResponse>(
    `${BASE}/contracts/${contractId}/generate-billings`,
    payload
  )
  return res.data
}

export async function previewBookkeepingContractBulkUpload(
  file: File
): Promise<ClientBookkeepingContractBulkPreviewResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await clientHttp.post<ClientBookkeepingContractBulkPreviewResponse>(`${BASE}/contracts/upload/preview`, form)
  return res.data
}

export async function applyBookkeepingContractBulkUpload(
  file: File
): Promise<ClientBookkeepingContractBulkApplyResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await clientHttp.post<ClientBookkeepingContractBulkApplyResponse>(`${BASE}/contracts/upload/apply`, form)
  return res.data
}

export async function createBookkeepingBilling(
  payload: ClientBookkeepingBillingCreateRequest
): Promise<ClientBookkeepingBillingOut> {
  const res = await clientHttp.post<ClientBookkeepingBillingOut>(`${BASE}/billings`, payload)
  return res.data
}

export async function listBookkeepingBillings(
  filters: ClientBookkeepingBillingListFilters = {}
): Promise<ClientBookkeepingBillingListResponse> {
  const res = await clientHttp.get<ClientBookkeepingBillingListResponse>(`${BASE}/billings`, { params: filters })
  return res.data
}

export async function updateBookkeepingBilling(
  billingId: number,
  payload: ClientBookkeepingBillingUpdateRequest
): Promise<ClientBookkeepingBillingOut> {
  const res = await clientHttp.put<ClientBookkeepingBillingOut>(`${BASE}/billings/${billingId}`, payload)
  return res.data
}

export async function patchBookkeepingBillingStatus(
  billingId: number,
  payload: ClientBookkeepingBillingStatusPatchRequest
): Promise<ClientBookkeepingBillingOut> {
  const res = await clientHttp.patch<ClientBookkeepingBillingOut>(`${BASE}/billings/${billingId}/status`, payload)
  return res.data
}

export async function deleteBookkeepingBilling(billingId: number): Promise<MessageOut> {
  const res = await clientHttp.delete<MessageOut>(`${BASE}/billings/${billingId}`)
  return res.data
}

export async function syncBookkeepingBillingReceipts(
  billingId: number
): Promise<ClientBillingSyncReceiptsResponse> {
  const res = await clientHttp.post<ClientBillingSyncReceiptsResponse>(`${BASE}/billings/${billingId}/sync-receipts`)
  return res.data
}

export async function getBookkeepingSummary(year: number): Promise<ClientBookkeepingSummaryResponse> {
  const res = await clientHttp.get<ClientBookkeepingSummaryResponse>(`${BASE}/summary`, {
    params: { year },
  })
  return res.data
}

export async function getBookkeepingSummaryYears(
  fromYear: number,
  toYear: number
): Promise<ClientBookkeepingYearsSummaryResponse> {
  const res = await clientHttp.get<ClientBookkeepingYearsSummaryResponse>(`${BASE}/summary/years`, {
    params: { from: fromYear, to: toYear },
  })
  return res.data
}

export async function listBookkeepingDebitReceipts(
  filters: ClientDebitReceiptListFilters = {}
): Promise<ClientDebitReceiptListResponse> {
  const res = await clientHttp.get<ClientDebitReceiptListResponse>(`${BASE}/debits/receipts`, { params: filters })
  return res.data
}

export async function getBookkeepingDebitSummary(year: number): Promise<ClientDebitReceiptSummaryResponse> {
  const res = await clientHttp.get<ClientDebitReceiptSummaryResponse>(`${BASE}/debits/summary`, {
    params: { year },
  })
  return res.data
}

export async function uploadBookkeepingDebits(params: {
  file: File
  source_name?: string
  memo?: string
}): Promise<ClientDebitUploadBatchOut> {
  const form = new FormData()
  form.append('file', params.file)
  if (params.source_name?.trim()) form.append('source_name', params.source_name.trim())
  if (params.memo?.trim()) form.append('memo', params.memo.trim())

  const res = await clientHttp.post<ClientDebitUploadBatchOut>(`${BASE}/debits/upload`, form, {
    // Let browser/axios set multipart boundary automatically.
    timeout: 120000,
  })
  return res.data
}

export async function listBookkeepingDebitBatches(
  filters: ClientDebitUploadBatchListFilters = {}
): Promise<ClientDebitUploadBatchListResponse> {
  const res = await clientHttp.get<ClientDebitUploadBatchListResponse>(`${BASE}/debits/batches`, { params: filters })
  return res.data
}

export async function listBookkeepingDebitBatchItems(
  batchId: number,
  filters: ClientDebitUploadItemListFilters = {}
): Promise<ClientDebitUploadItemListResponse> {
  const res = await clientHttp.get<ClientDebitUploadItemListResponse>(`${BASE}/debits/batches/${batchId}/items`, {
    params: filters,
  })
  return res.data
}

export async function patchBookkeepingDebitItemLink(
  itemId: number,
  payload: ClientDebitUploadItemLinkRequest
): Promise<ClientDebitUploadItemOut> {
  const res = await clientHttp.patch<ClientDebitUploadItemOut>(`${BASE}/debits/items/${itemId}/link`, payload)
  return res.data
}

export async function deleteBookkeepingDebitBatch(batchId: number): Promise<{ message: string }> {
  const res = await clientHttp.delete<{ message: string }>(`${BASE}/debits/batches/${batchId}`)
  return res.data
}

export async function rematchBookkeepingDebitBatch(batchId: number): Promise<ClientDebitBatchRematchResponse> {
  const res = await clientHttp.post<ClientDebitBatchRematchResponse>(`${BASE}/debits/batches/${batchId}/rematch`)
  return res.data
}

// Aliases for page-level domain naming consistency
export const listContracts = listBookkeepingContracts
export const createContract = createBookkeepingContract
export const updateContract = updateBookkeepingContract
export const patchContractActive = patchBookkeepingContractActive
export const generateContractBillings = generateBookkeepingContractBillings
export const previewContractBulkUpload = previewBookkeepingContractBulkUpload
export const applyContractBulkUpload = applyBookkeepingContractBulkUpload
export const listBillings = listBookkeepingBillings
export const createBilling = createBookkeepingBilling
export const updateBilling = updateBookkeepingBilling
export const deleteBilling = deleteBookkeepingBilling
export const syncBillingReceipts = syncBookkeepingBillingReceipts
export const patchBillingStatus = patchBookkeepingBillingStatus
export const updateBillingStatus = patchBookkeepingBillingStatus
export const getSummaryYears = getBookkeepingSummaryYears
export const listDebitReceipts = listBookkeepingDebitReceipts
export const getDebitSummary = getBookkeepingDebitSummary
