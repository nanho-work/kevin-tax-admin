// types/team.ts
import type { DepartmentOut } from "./department";

export interface TeamCreate {
  department_id?: number;
  name: string;
  description?: string;
}

export interface TeamOut {
  id: number;
  client_id: number;
  name: string;
  description?: string;
  department_id?: number;
  department?: DepartmentOut | null;
  created_at: string;  // ISO date string
  updated_at: string;
}