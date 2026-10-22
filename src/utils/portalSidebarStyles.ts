// Shared sizing for the staff and company-administrator navigation shells.
export function sidebarShellClass(collapsed: boolean): string {
  return `relative z-30 h-full shrink-0 overflow-hidden ${collapsed ? 'w-14' : 'w-auto'}`
}

export function sidebarAsideClass(collapsed: boolean): string {
  return `flex h-full border-r border-neutral-200 bg-white ${collapsed ? 'w-14' : 'w-max'}`
}

export function sidebarPanelClass(mail: boolean): string {
  return `min-h-0 shrink-0 overflow-y-auto px-2 py-3 ${mail ? 'w-48' : 'w-max min-w-[128px] max-w-[208px]'}`
}
