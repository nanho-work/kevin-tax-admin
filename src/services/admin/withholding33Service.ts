import { adminHttp } from '@/services/http'
import type {
  AdminWithholding33Item,
  AdminWithholding33ListParams,
  AdminWithholding33ListResponse,
  AdminWithholding33ReviewPayload,
  AdminWithholding33ReviewResponse,
} from '@/types/admin_withholding33'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/withholding33`

export async function getAdminWithholding33List(
  params: AdminWithholding33ListParams
): Promise<AdminWithholding33ListResponse> {
  const res = await adminHttp.get<AdminWithholding33ListResponse>(BASE, { params })
  return res.data
}

export async function getAdminWithholding33Detail(paymentId: number): Promise<AdminWithholding33Item> {
  const res = await adminHttp.get<AdminWithholding33Item>(`${BASE}/${paymentId}`)
  return res.data
}

export async function reviewAdminWithholding33(
  paymentId: number,
  payload: AdminWithholding33ReviewPayload
): Promise<AdminWithholding33ReviewResponse> {
  const res = await adminHttp.patch<AdminWithholding33ReviewResponse>(`${BASE}/${paymentId}/review`, payload)
  return res.data
}

