type WithClientRank = {
  role_level?: number | null
  rank_order?: number | null
}

type WithRoleRank = {
  rank_order?: number | null
}

type WithAdminRank = {
  role_level?: number | null
  rank_order?: number | null
  role?: WithRoleRank | null
}

export function getClientRoleRank(target?: WithClientRank | null, fallback = 999): number {
  if (!target) return fallback
  if (typeof target.rank_order === 'number') return target.rank_order
  if (typeof target.role_level === 'number') return target.role_level
  return fallback
}

export function getRoleRank(target?: WithRoleRank | null, fallback = 999): number {
  if (!target) return fallback
  if (typeof target.rank_order === 'number') return target.rank_order
  return fallback
}

export function getAdminRoleRank(target?: WithAdminRank | null, fallback = 999): number {
  if (!target) return fallback
  if (typeof target.rank_order === 'number') return target.rank_order
  if (typeof target.role_level === 'number') return target.role_level
  return getRoleRank(target.role, fallback)
}
