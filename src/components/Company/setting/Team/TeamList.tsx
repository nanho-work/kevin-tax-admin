'use client';

import { useEffect, useState } from 'react';
import { getTeams } from '@/services/teamService';
import type { TeamOut } from '@/types/team';
import TeamDeleteButton from './TeamDeleteButton';


export default function TeamList() {
  const [teams, setTeams] = useState<TeamOut[]>([]);

  const fetchTeams = async () => {
    const data = await getTeams();
    setTeams(data);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <table className="w-full border mt-4">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">ID</th>
          <th className="p-2 border">이름</th>
          <th className="p-2 border">설명</th>
          <th className="p-2 border">부서</th>
          <th className="p-2 border">삭제</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team) => (
          <tr key={team.id}>
            <td className="p-2 border">{team.id}</td>
            <td className="p-2 border">{team.name}</td>
            <td className="p-2 border">{team.description}</td>
            <td className="p-2 border">{team.department?.name ?? '-'}</td>
            <td className="p-2 border">
              <TeamDeleteButton teamId={team.id} onSuccess={fetchTeams} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}