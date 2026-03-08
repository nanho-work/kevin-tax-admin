// types/department.ts
export interface DepartmentCreate {
  name: string
  description?: string
}

export interface DepartmentUpdate {
  name?: string
  description?: string
}

export interface DepartmentOut {
  id: number
  client_id: number
  name: string
  description?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DepartmentSortUpdateItem {
  department_id: number
  sort_order: number
}

export interface DepartmentSortUpdateRequest {
  items: DepartmentSortUpdateItem[]
}
