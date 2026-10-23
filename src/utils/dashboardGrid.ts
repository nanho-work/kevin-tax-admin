import type { DashboardUserLayoutItem, DashboardWidgetCatalogItem } from '@/types/dashboardWidget'

export const DASHBOARD_COLUMNS = 24
export const DASHBOARD_ROW_HEIGHT = 34
export const DASHBOARD_GAP = 16
const KEY = '_dashboard_grid_v2'

// Keep the existing API's coarse integer geometry for compatibility. Exact half-cell
// positions live in the item's existing config JSON and survive server size clamping.
export function encodeDashboardGrid(item: DashboardUserLayoutItem): DashboardUserLayoutItem {
  return { ...item,
    grid_x: Math.floor(item.grid_x / 2), grid_y: Math.floor(item.grid_y / 2),
    grid_w: Math.ceil(item.grid_w / 2), grid_h: Math.ceil(item.grid_h / 2),
    config_json: { ...item.config_json, [KEY]: { x: item.grid_x, y: item.grid_y, w: item.grid_w, h: item.grid_h } },
  }
}

export function decodeDashboardGrid(item: DashboardUserLayoutItem): DashboardUserLayoutItem {
  const saved = item.config_json?.[KEY] as { x: number; y: number; w: number; h: number } | undefined
  const valid = saved && [saved.x, saved.y, saved.w, saved.h].every(Number.isInteger) && saved.x >= 0 && saved.y >= 0 && saved.w > 0 && saved.w <= 24 && saved.h > 0 && saved.h <= 24 && saved.x + saved.w <= 24
  return { ...item,
    grid_x: valid ? saved.x : item.grid_x * 2, grid_y: valid ? saved.y : item.grid_y * 2,
    grid_w: valid ? saved.w : item.grid_w * 2, grid_h: valid ? saved.h : item.grid_h * 2,
    min_w: item.min_w * 2, max_w: item.max_w * 2, min_h: item.min_h * 2, max_h: item.max_h * 2,
  }
}

export function scaleDashboardCatalog(item: DashboardWidgetCatalogItem): DashboardWidgetCatalogItem {
  return { ...item, default_w: item.default_w * 2, default_h: item.default_h * 2,
    min_w: item.min_w * 2, max_w: item.max_w * 2, min_h: item.min_h * 2, max_h: item.max_h * 2 }
}
