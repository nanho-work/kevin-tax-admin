import { clientHttp } from '@/services/http'
import type { TeamCreate, TeamOut } from '@/types/team'

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/client/teams`

export async function getTeams(): Promise<TeamOut[]> {
  const res = await clientHttp.get(`${BASE}/`)
  return res.data
}

export async function createTeam(data: TeamCreate): Promise<TeamOut> {
  const res = await clientHttp.post(`${BASE}/`, data)
  return res.data
}

export async function deleteTeam(teamId: number): Promise<{ detail: string }> {
  const res = await clientHttp.delete(`${BASE}/${teamId}`)
  return res.data
}
