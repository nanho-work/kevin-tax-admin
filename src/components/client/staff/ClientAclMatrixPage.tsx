'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  getPermissionCodes,
  getStaffPermissions,
  updateStaffPermissions,
} from '@/services/client/clientPermissionService'
import type { AdminOut } from '@/types/admin'
import type { PermissionCodeOut } from '@/types/clientPermission'

type StaffPermissionRow = {
  staff: AdminOut
  values: Record<string, boolean>
  baseline: Record<string, boolean>
  loading: boolean
  saving: boolean
}

function buildCodeMap(codes: PermissionCodeOut[], source?: { code: string; is_allowed: boolean }[]) {
  const map: Record<string, boolean> = {}
  const allowed = new Map((source || []).map((item) => [item.code, item.is_allowed]))
  codes.forEach((code) => {
    map[code.code] = Boolean(allowed.get(code.code))
  })
  return map
}

function hasChanges(row: StaffPermissionRow, codes: PermissionCodeOut[]) {
  return codes.some((code) => row.values[code.code] !== row.baseline[code.code])
}

export default function ClientAclMatrixPage() {
  const [codes, setCodes] = useState<PermissionCodeOut[]>([])
  const [rows, setRows] = useState<StaffPermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const groupedCodes = useMemo(() => {
    const grouped = new Map<string, PermissionCodeOut[]>()
    codes.forEach((code) => {
      const prev = grouped.get(code.group_name) || []
      prev.push(code)
      grouped.set(code.group_name, prev)
    })
    return [...grouped.entries()]
  }, [codes])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [codeRes, staffRes] = await Promise.all([
          getPermissionCodes(true),
          getClientStaffs(1, 50),
        ])
        const codeItems = codeRes.items || []
        const staffItems = (staffRes.items || []).filter((staff) => staff.is_active)

        const permissionResponses = await Promise.all(
          staffItems.map(async (staff) => {
            try {
              const res = await getStaffPermissions(staff.id)
              return { staff, items: res.items, error: null as any }
            } catch (e: any) {
              return { staff, items: [], error: e }
            }
          })
        )

        const forbidden = permissionResponses.find((item) => item.error?.response?.status === 403)
        if (forbidden) {
          setError('권한 없음')
          setCodes(codeItems)
          setRows([])
          return
        }

        const nextRows: StaffPermissionRow[] = permissionResponses.map(({ staff, items }) => {
          const baseline = buildCodeMap(codeItems, items)
          return {
            staff,
            values: { ...baseline },
            baseline,
            loading: false,
            saving: false,
          }
        })

        setCodes(codeItems)
        setRows(nextRows)
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 403) {
          setError('권한 없음')
        } else {
          setError('권한 정보를 불러오지 못했습니다.')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const handleToggle = (staffId: number, code: string, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.staff.id === staffId
          ? {
              ...row,
              values: { ...row.values, [code]: checked },
            }
          : row
      )
    )
  }

  const handleToggleAll = (staffId: number, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.staff.id !== staffId) return row
        const nextValues: Record<string, boolean> = {}
        codes.forEach((code) => {
          nextValues[code.code] = checked
        })
        return { ...row, values: nextValues }
      })
    )
  }

  const handleSave = async (staffId: number) => {
    const row = rows.find((item) => item.staff.id === staffId)
    if (!row) return

    const changedItems = codes
      .filter((code) => row.values[code.code] !== row.baseline[code.code])
      .map((code) => ({ code: code.code, is_allowed: row.values[code.code] }))

    if (changedItems.length === 0) {
      toast('변경된 권한이 없습니다.')
      return
    }

    try {
      setRows((prev) => prev.map((item) => (item.staff.id === staffId ? { ...item, saving: true } : item)))
      const res = await updateStaffPermissions(staffId, { items: changedItems })
      toast.success(res.message || '권한이 저장되었습니다.')
      setRows((prev) =>
        prev.map((item) =>
          item.staff.id === staffId
            ? {
                ...item,
                saving: false,
                baseline: { ...item.values },
              }
            : item
        )
      )
    } catch (e: any) {
      setRows((prev) => prev.map((item) => (item.staff.id === staffId ? { ...item, saving: false } : item)))
      const status = e?.response?.status
      if (status === 403) {
        toast.error('권한 없음')
      } else {
        toast.error(e?.response?.data?.detail || '권한 저장 중 오류가 발생했습니다.')
      }
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        ACL 권한 정보를 불러오는 중...
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
        {error}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">ACL 권한 관리</h2>
        <p className="mt-1 text-xs text-zinc-500">직원별 권한 매트릭스(행=직원, 열=권한)에서 전체/개별 체크 후 저장합니다.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1100px] w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 text-zinc-700">
              <th className="border border-zinc-200 px-3 py-2 text-left" rowSpan={2}>
                직원
              </th>
              <th className="border border-zinc-200 px-3 py-2 text-center" rowSpan={2}>
                전체
              </th>
              {groupedCodes.map(([group, groupCodes]) => (
                <th key={group} className="border border-zinc-200 px-3 py-2 text-center" colSpan={groupCodes.length}>
                  {group}
                </th>
              ))}
              <th className="border border-zinc-200 px-3 py-2 text-center" rowSpan={2}>
                저장
              </th>
            </tr>
            <tr className="bg-zinc-50 text-zinc-500">
              {groupedCodes.flatMap(([_, groupCodes]) =>
                groupCodes.map((code) => (
                  <th key={code.code} className="border border-zinc-200 px-2 py-2 text-center whitespace-nowrap">
                    {code.action_name}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allChecked = codes.length > 0 && codes.every((code) => row.values[code.code])
              const changed = hasChanges(row, codes)
              return (
                <tr key={row.staff.id} className="even:bg-zinc-50/50">
                  <td className="border border-zinc-200 px-3 py-2 text-left text-zinc-800">
                    {row.staff.name}
                    <span className="ml-2 text-zinc-400">({row.staff.birth_date || '생일 미등록'})</span>
                  </td>
                  <td className="border border-zinc-200 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => handleToggleAll(row.staff.id, e.target.checked)}
                    />
                  </td>
                  {codes.map((code) => (
                    <td key={`${row.staff.id}-${code.code}`} className="border border-zinc-200 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.values[code.code])}
                        onChange={(e) => handleToggle(row.staff.id, code.code, e.target.checked)}
                      />
                    </td>
                  ))}
                  <td className="border border-zinc-200 px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={!changed || row.saving}
                      onClick={() => void handleSave(row.staff.id)}
                      className="inline-flex h-7 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {row.saving ? '저장중...' : '저장'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
