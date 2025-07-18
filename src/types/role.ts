// types/role.ts
export interface RoleCreate {
  name: string;
  level: number;
  description?: string;
}

export interface RoleOut {
  id: number;
  client_id: number;
  name: string;
  level: number;
  description?: string;
  created_at: string; // ISO datetime string
  updated_at: string;
}