'use client';

import { useEffect, useState } from 'react';
import { getTeams } from '@/services/admin/teamService';
import type { TeamOut } from '@/types/team';
import TeamDeleteButton from './TeamDeleteButton';

export default function TeamList() {
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getTeams();
      setTeams(data);
    } catch (error) {
      console.error('팀 목록 조회 실패', error);
      setErrorMessage('팀 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  if (errorMessage) {
    return <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-600">
          <tr>
            <th className="px-3 py-3 text-right">ID</th>
            <th className="px-3 py-3 text-left">이름</th>
            <th className="px-3 py-3 text-left">설명</th>
            <th className="px-3 py-3 text-left">부서</th>
            <th className="px-3 py-3 text-center">삭제</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">팀 목록을 불러오는 중입니다...</td>
            </tr>
          ) : teams.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">등록된 팀이 없습니다.</td>
            </tr>
          ) : (
            teams.map((team) => (
              <tr key={team.id}>
                <td className="px-3 py-3 text-right">{team.id}</td>
                <td className="px-3 py-3 text-left">{team.name}</td>
                <td className="px-3 py-3 text-left">{team.description || '-'}</td>
                <td className="px-3 py-3 text-left">{team.department?.name ?? '-'}</td>
                <td className="px-3 py-3 text-center">
                  <TeamDeleteButton teamId={team.id} onSuccess={fetchTeams} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
