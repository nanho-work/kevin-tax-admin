// services/teamService.ts
import axios from "axios";
import type { TeamCreate, TeamOut } from "@/types/team";

const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/teams`

// 공통 인증 헤더 함수
function authHeader() {
  const token = localStorage.getItem('admin_access_token')
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}


export async function getTeams(): Promise<TeamOut[]> {
  const res = await axios.get(`${BASE}/`, authHeader());
  return res.data;
}



export async function createTeam(data: TeamCreate): Promise<TeamOut> {
  const res = await axios.post(`${BASE}/`, data);
  return res.data;
}

export async function deleteTeam(teamId: number): Promise<{ detail: string }> {
  const res = await axios.delete(`${BASE}/${teamId}`, authHeader());
  return res.data;
}