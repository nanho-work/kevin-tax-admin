import type { DashboardScope, DashboardUserLayoutItem } from '@/types/dashboardWidget'

// Content-led display sizes on the 24-column dashboard. Shared by both portals.
export function applyDashboardWidgetSizes(items: DashboardUserLayoutItem[], scope: DashboardScope): DashboardUserLayoutItem[] {
  const sizes: Record<string, [number, number]> = {
    my_attendance: [3, 2],
    my_leave_balance: [4, 3],
    approval_pending: [2, 2],
    notification_unread: [2, 2],
    withholding_pending: [2, 2],
    staff_signup_pending: [2, 2],
    mail_unread: [6, 3],
    memo_widget: [5, 4],
    checklist_widget: [3, 3],
    staff_attendance_week: [4, 3],
    work_post_inbox: scope === 'admin' ? [4, 3] : [2, 2],
  }
  const resized = items.map(item => {
    if (item.widget_key === 'my_attendance') {
      return { ...item, grid_w: Math.max(3, Math.min(5, item.grid_w)), grid_h: Math.max(3, Math.min(5, item.grid_h)), min_w: 3, max_w: 5, min_h: 3, max_h: 5 }
    }
    const size = sizes[item.widget_key]
    if (!size) return { ...item, min_w: 3, min_h: 3, max_w: 24, max_h: 20 }
    const [oldWidth, oldHeight] = size
    const limits = item.widget_key === 'mail_unread' ? [6, 4, 24, 16]
      : item.widget_key === 'memo_widget' ? [4, 3, 24, 20]
      : item.widget_key === 'checklist_widget' ? [4, 4, 16, 20]
      : ['staff_attendance_week', 'my_leave_balance'].includes(item.widget_key) || (item.widget_key === 'work_post_inbox' && scope === 'admin') ? [5, 4, 24, 16]
      : [3, 3, 12, 10]
    const [min_w, min_h, max_w, max_h] = limits
    const custom = item.config_json?._dashboard_size_custom === true
    const width = Math.max(min_w, Math.min(max_w, custom ? item.grid_w : oldWidth * 2))
    const height = Math.max(min_h, Math.min(max_h, custom ? item.grid_h : oldHeight * 2))
    return { ...item, grid_w: width, grid_h: height, min_w, max_w, min_h, max_h }
  })
  // A size migration packs the existing widget order once, avoiding large holes
  // and downward cascades caused by old coordinates. Unchanged layouts retain user placement.
  if (!resized.some((item, index) => item.grid_w !== items[index].grid_w || item.grid_h !== items[index].grid_h)) return resized
  const placed: DashboardUserLayoutItem[] = []
  for (const item of resized) {
    let found = false
    const bottom = placed.reduce((max, row) => Math.max(max, row.grid_y + row.grid_h), 0)
    for (let y = 0; y <= bottom && !found; y++) {
      for (let x = 0; x <= 24 - item.grid_w; x++) {
        const overlaps = placed.some(row => x < row.grid_x + row.grid_w && x + item.grid_w > row.grid_x && y < row.grid_y + row.grid_h && y + item.grid_h > row.grid_y)
        if (!overlaps) {
          placed.push({ ...item, grid_x: x, grid_y: y })
          found = true
          break
        }
      }
    }
  }
  return placed
}
