'use client';

import { useEffect, useState } from 'react';
import { getDepartments } from '@/services/departmentService';
import { getTeams } from '@/services/teamService';
import { getRoles } from '@/services/roleService';
import type { DepartmentOut } from '@/types/department';
import type { TeamOut } from '@/types/team';
import type { RoleOut } from '@/types/role';

export default function OrgChart() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [roles, setRoles] = useState<RoleOut[]>([]);

  useEffect(() => {
    getDepartments().then(setDepartments);
    getTeams().then(setTeams);
    getRoles().then(setRoles);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">조직도</h2>
      <div className="flex flex-col gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="border p-4 rounded shadow">
            <div className="font-bold text-lg mb-2">{dept.name}</div>
            <div className="ml-4">
              {teams.filter((t) => t.department_id === dept.id).map((team) => (
                <div key={team.id} className="ml-4">
                  └─ {team.name}
                  <div className="ml-4 text-sm text-gray-600">
                    {roles
                      .filter((r) => r.client_id === team.client_id)
                      .map((role) => (
                        <div key={role.id}>└─ {role.name}</div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}