import { clientHttp } from '@/services/http'
import type {
  DashboardDeviceType,
  DashboardLayoutPresetListResponse,
  DashboardUserLayoutActionResponse,
  DashboardUserLayoutResetRequest,
  DashboardUserLayoutResponse,
  DashboardUserLayoutSaveRequest,
  DashboardWidgetCatalogResponse,
} from '@/types/dashboardWidget'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/dashboard/widgets`

export async function getClientDashboardWidgetCatalog(): Promise<DashboardWidgetCatalogResponse> {
  const res = await clientHttp.get<DashboardWidgetCatalogResponse>(`${BASE}/catalog`)
  return res.data
}

export async function getClientDashboardWidgetPresets(
  deviceType: DashboardDeviceType
): Promise<DashboardLayoutPresetListResponse> {
  const res = await clientHttp.get<DashboardLayoutPresetListResponse>(`${BASE}/presets`, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function getClientDashboardWidgetLayout(
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutResponse> {
  const res = await clientHttp.get<DashboardUserLayoutResponse>(`${BASE}/layout`, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function saveClientDashboardWidgetLayout(
  payload: DashboardUserLayoutSaveRequest,
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutActionResponse> {
  const res = await clientHttp.put<DashboardUserLayoutActionResponse>(`${BASE}/layout`, payload, {
    params: { device_type: deviceType },
  })
  return res.data
}

export async function resetClientDashboardWidgetLayout(
  payload: DashboardUserLayoutResetRequest,
  deviceType: DashboardDeviceType
): Promise<DashboardUserLayoutActionResponse> {
  const res = await clientHttp.post<DashboardUserLayoutActionResponse>(`${BASE}/layout/reset`, payload, {
    params: { device_type: deviceType },
  })
  return res.data
}
