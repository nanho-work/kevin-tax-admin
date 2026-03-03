// services/teamService.ts
import http, { getAccessToken } from '@/services/http';
import type { TeamCreate, TeamOut } from "@/types/team";

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/teams`

// 공통 인증 헤더 함수
function authHeader() {
  const token = getAccessToken()
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}


export async function getTeams(): Promise<TeamOut[]> {
  const res = await http.get(`${BASE}/`, authHeader());
  return res.data;
}



export async function createTeam(data: TeamCreate): Promise<TeamOut> {
  const res = await http.post(`${BASE}/`, data, authHeader());
  return res.data;
}

export async function deleteTeam(teamId: number): Promise<{ detail: string }> {
  const res = await http.delete(`${BASE}/${teamId}`, authHeader());
  return res.data;
}
