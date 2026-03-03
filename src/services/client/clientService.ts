import { clientHttp } from '@/services/http'
import type { ClientListFilters, ClientOut } from '@/types/Client'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/clients`

export async function listClients(filters: ClientListFilters = {}): Promise<ClientOut[]> {
  const res = await clientHttp.get<ClientOut[]>(`${BASE}/`, { params: filters })
  return Array.isArray(res.data) ? res.data : []
}
