import { adminHttp } from '@/services/http'
import type {
  DashboardDeviceType,
  DashboardLayoutPresetListResponse,
  DashboardUserLayoutActionResponse,
  DashboardUserLayoutResetRequest,
  DashboardUserLayoutResponse,
  DashboardUserLayoutSaveRequest,
  DashboardWidgetCatalogResponse,
} from '@/types/dashboardWidget'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/dashboard/widgets`

export async function getAdminDashboardWidgetCatalog(): Promise<DashboardWidgetCatalogResponse> {
  const res = await adminHttp.get<DashboardWidgetCatalogResponse>(`${BASE}/catalog`)
  return res.data
}

export async function getAdminDashboardWidgetPresets(
  deviceType: DashboardDeviceType
): Promise<DashboardLayoutPresetListResponse> {
  const res = await adminHttp.get<DashboardLayoutPresetListResponse>(`${BASE}/presets`, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function getAdminDashboardWidgetLayout(
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutResponse> {
  const res = await adminHttp.get<DashboardUserLayoutResponse>(`${BASE}/layout`, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function saveAdminDashboardWidgetLayout(
  payload: DashboardUserLayoutSaveRequest,
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutActionResponse> {
  const res = await adminHttp.put<DashboardUserLayoutActionResponse>(`${BASE}/layout`, payload, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function resetAdminDashboardWidgetLayout(
  payload: DashboardUserLayoutResetRequest,
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutActionResponse> {
  const res = await adminHttp.post<DashboardUserLayoutActionResponse>(`${BASE}/layout/reset`, payload, {
    params: { device_type: deviceType },
  })
  return res.data
}
