// types/pagination.ts

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}