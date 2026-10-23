import type { DashboardUserLayoutItem, DashboardUserLayoutResponse, DashboardWidgetCatalogItem } from '@/types/dashboardWidget'

export function dashboardStorageKey(layout: DashboardUserLayoutResponse): string {
  return `dashboard-layout-v2:${layout.client_id}:${layout.user_type}:${layout.user_id}:${layout.device_type}`
}

export function readLocalDashboardItems(key: string): DashboardUserLayoutItem[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is DashboardUserLayoutItem =>
      item && typeof item.widget_key === 'string' && typeof item.visible === 'boolean' &&
      ['grid_x', 'grid_y', 'sort_order'].every(k => Number.isInteger(item[k]) && item[k] >= 0) &&
      ['grid_w', 'grid_h'].every(k => Number.isInteger(item[k]) && item[k] > 0 && item[k] <= 12)
    )
  } catch { return [] }
}

export function restoreDashboardItems(
  layout: DashboardUserLayoutResponse,
  catalog: DashboardWidgetCatalogItem[],
  localItems: DashboardUserLayoutItem[],
  defaultFallbackKeys: string[],
): DashboardUserLayoutItem[] {
  const items = [...layout.items]
  for (const meta of catalog) {
    // Server-owned widgets must never be replaced by local fallback IDs or preferences.
    if (items.some(item => item.widget_key === meta.widget_key)) continue
    const local = meta.widget_id < 0 ? localItems.find(item => item.widget_key === meta.widget_key) : undefined
    items.push({
      ...meta,
      grid_x: local?.grid_x ?? 0,
      grid_y: local?.grid_y ?? items.reduce((bottom, item) => Math.max(bottom, item.grid_y + item.grid_h), 0),
      grid_w: Math.min(meta.max_w, Math.max(meta.min_w, local?.grid_w ?? meta.default_w)),
      grid_h: Math.min(meta.max_h, Math.max(meta.min_h, local?.grid_h ?? meta.default_h)),
      visible: local?.visible ?? (meta.widget_id < 0 && defaultFallbackKeys.includes(meta.widget_key)),
      sort_order: local?.sort_order ?? items.length,
      config_json: local?.config_json ?? null,
    })
  }
  return items
}

// Keep hidden records, including their configuration and geometry, for the next save/reload.
export function mergeDashboardVisibility(previous: DashboardUserLayoutItem[], shown: DashboardUserLayoutItem[]): DashboardUserLayoutItem[] {
  const next = new Map(shown.map(item => [item.widget_key, { ...item, config_json: item.config_json ?? previous.find(old => old.widget_key === item.widget_key)?.config_json ?? null, visible: true }]))
  return [
    ...previous.map(item => next.get(item.widget_key) ?? { ...item, visible: false }),
    ...shown.filter(item => !previous.some(old => old.widget_key === item.widget_key)),
  ]
}

export function writeLocalDashboardItems(key: string, items: DashboardUserLayoutItem[]): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(items.filter(item => item.widget_id < 0)))
    return true
  } catch { return false }
}
