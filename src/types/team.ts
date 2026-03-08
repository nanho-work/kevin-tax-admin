// types/team.ts
import type { DepartmentOut } from './department'

export interface TeamCreate {
  department_id?: number
  name: string
  description?: string
}

export interface TeamUpdate {
  department_id?: number
  name?: string
  description?: string
}

export interface TeamOut {
  id: number
  client_id: number
  name: string
  description?: string
  department_id?: number
  sort_order: number
  department?: DepartmentOut | null
  created_at: string
  updated_at: string
}

export interface TeamSortUpdateItem {
  team_id: number
  sort_order: number
  department_id?: number
}

export interface TeamSortUpdateRequest {
  items: TeamSortUpdateItem[]
}
