'use client';

import RoleCreateForm from './RoleCreateForm';
import RoleList from './RoleList';
import { useEffect, useState } from 'react';
import { checkAdminSession } from '@/services/admin/adminService';

function statusMessage(status?: number): string {
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '직급 관리 권한이 없습니다.';
  if (status === 404) return '관리자 정보를 찾을 수 없습니다.';
  if (status && status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '요청 처리 중 오류가 발생했습니다.';
}

export default function RoleTable() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [adminLevel, setAdminLevel] = useState<number | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const session = await checkAdminSession();
        const level = session.role_level ?? (session as any).role?.level;
        if (typeof level !== 'number') {
          setErrorMessage('직급 정보를 확인할 수 없습니다.');
          return;
        }
        setAdminLevel(level);
      } catch (err: any) {
        setErrorMessage(statusMessage(err?.response?.status));
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const handleSuccess = () => setRefreshKey((prev) => prev + 1);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        권한 정보를 확인하는 중입니다...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        {errorMessage}
      </div>
    );
  }

  if (adminLevel !== null && adminLevel >= 2) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        직급 관리 권한이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
        <h2 className="text-base font-semibold text-zinc-900">직급 관리</h2>
        <p className="mt-1 text-sm text-zinc-500">직급 정보를 등록하고 목록을 관리할 수 있습니다.</p>
      </div>
      <RoleCreateForm onSuccess={handleSuccess} adminLevel={adminLevel ?? 1} />
      <RoleList key={refreshKey} adminLevel={adminLevel ?? 1} />
    </div>
  );
}
