// types/department.ts
export interface DepartmentCreate {
  name: string;
  description?: string;
}

export interface DepartmentOut {
  id: number;
  client_id: number;
  name: string;
  description?: string;
  created_at: string; // ISO datetime string
}