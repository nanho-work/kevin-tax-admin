'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock, PackagePlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import { getClientStaffs } from '@/services/client/clientStaffService'
import {
  fetchClientDocsStorageUsage,
  getClientSubscriptionErrorMessage,
  type ClientDocsStorageUsageResponse,
} from '@/services/client/clientSubscriptionService'

type PlanCode = 'FREE' | 'STARTER' | 'STANDARD' | 'PRO'

type PlanPolicy = {
  code: PlanCode
  name: string
  monthlyPrice: number
  maxUsers: number
  storageBytes: number
  maxUploadBytes: number
  supportText: string
  featureSummary: string
}

const PLAN_ORDER: PlanCode[] = ['FREE', 'STARTER', 'STANDARD', 'PRO']

const PLAN_POLICIES: Record<PlanCode, PlanPolicy> = {
  FREE: {
    code: 'FREE',
    name: 'FREE',
    monthlyPrice: 0,
    maxUsers: 3,
    storageBytes: 2 * 1024 ** 3,
    maxUploadBytes: 100 * 1024 ** 2,
    supportText: '우선지원 없음',
    featureSummary: '채팅, 고객관리, 기본 문서함, 기본 공지/업무지시 조회',
  },
  STARTER: {
    code: 'STARTER',
    name: 'STARTER',
    monthlyPrice: 29000,
    maxUsers: 10,
    storageBytes: 10 * 1024 ** 3,
    maxUploadBytes: 300 * 1024 ** 2,
    supportText: '일반 문의 지원',
    featureSummary: 'FREE + 문서함 고급(대량 작업/휴지통 복구), 기본 통계',
  },
  STANDARD: {
    code: 'STANDARD',
    name: 'STANDARD',
    monthlyPrice: 59000,
    maxUsers: 30,
    storageBytes: 100 * 1024 ** 3,
    maxUploadBytes: 1024 ** 3,
    supportText: '우선 지원',
    featureSummary: 'STARTER + 고급 권한정책, 감사로그, 자동화/연동 확장',
  },
  PRO: {
    code: 'PRO',
    name: 'PRO',
    monthlyPrice: 129000,
    maxUsers: 100,
    storageBytes: 500 * 1024 ** 3,
    maxUploadBytes: 2 * 1024 ** 3,
    supportText: '최우선 지원',
    featureSummary: 'STANDARD + 고급 운영 옵션(정책 커스텀, 확장 API)',
  },
}

function normalizePlanCode(raw?: string | null): PlanCode {
  const upper = (raw || '').toUpperCase()
  if (upper === 'FREE' || upper === 'STARTER' || upper === 'STANDARD' || upper === 'PRO') return upper
  return 'STANDARD'
}

function formatStorageSize(bytes?: number | null): string {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return '0B'
  if (value < 1024) return `${Math.floor(value)}B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)}KB`
  if (value < 1024 ** 3) return `${(value / (1024 ** 2)).toFixed(1)}MB`
  return `${(value / (1024 ** 3)).toFixed(1)}GB`
}

function toUsagePercent(usageRate?: number | null): number {
  const safe = Number(usageRate || 0)
  if (!Number.isFinite(safe) || safe <= 0) return 0
  const percent = safe <= 1 ? safe * 100 : safe
  return Math.min(100, Math.max(0, percent))
}

function formatPrice(price: number): string {
  if (price <= 0) return '무료'
  return `₩${price.toLocaleString('ko-KR')}/월`
}

export default function ClientSettingSubscriptionPage() {
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<ClientDocsStorageUsageResponse | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const [usageRes, staffRes] = await Promise.allSettled([
        fetchClientDocsStorageUsage(),
        getClientStaffs(1, 1),
      ])

      if (!mounted) return

      if (usageRes.status === 'fulfilled') {
        setUsage(usageRes.value)
        setUsageError(null)
      } else {
        setUsage(null)
        setUsageError(getClientSubscriptionErrorMessage(usageRes.reason))
      }

      if (staffRes.status === 'fulfilled') {
        setStaffCount(staffRes.value.total ?? 0)
      } else {
        setStaffCount(null)
      }

      setLoading(false)
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const planCode = useMemo(() => normalizePlanCode(usage?.plan_code), [usage?.plan_code])
  const currentPlan = PLAN_POLICIES[planCode]
  const storageQuotaBytes = usage?.quota_bytes ?? currentPlan.storageBytes
  const usedTotalBytes = usage?.used_total_bytes ?? 0
  const availableBytes = usage?.available_bytes ?? Math.max(storageQuotaBytes - usedTotalBytes, 0)
  const usagePercent = toUsagePercent(usage?.usage_rate ?? (storageQuotaBytes ? (usedTotalBytes / storageQuotaBytes) * 100 : 0))
  const softWarn80 = usage?.soft_warn_80 ?? usagePercent >= 80
  const hardWarn95 = usage?.hard_warn_95 ?? usagePercent >= 95

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">현재 요금제</h2>
            <p className="mt-1 text-xs text-zinc-500">결제 연동 전 단계이며, 플랜 변경은 요청 접수 방식으로만 제공합니다.</p>
          </div>
          <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            {(usage?.plan_name || currentPlan.name).toUpperCase()}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">사용자 사용량</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {staffCount === null ? '-' : staffCount} / {currentPlan.maxUsers}명
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">직원 계정 기준</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">저장공간 사용량</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {formatStorageSize(usedTotalBytes)} / {formatStorageSize(storageQuotaBytes)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">남은 용량 {formatStorageSize(availableBytes)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">파일 1개 업로드 제한</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{formatStorageSize(currentPlan.maxUploadBytes)}</p>
            <p className="mt-1 text-[11px] text-zinc-500">플랜 기준 제한</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">지원 정책</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{currentPlan.supportText}</p>
            <p className="mt-1 text-[11px] text-zinc-500">문의 채널 기준</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-xs text-zinc-500">월 요금</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{formatPrice(currentPlan.monthlyPrice)}</p>
            <p className="mt-1 text-[11px] text-zinc-500">결제 연동 전 표기용</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <p className="text-zinc-600">문서함 사용률</p>
            <p className="font-medium text-zinc-700">{usagePercent.toFixed(1)}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded bg-zinc-200">
            <div
              className={`h-full transition-all ${
                hardWarn95 ? 'bg-rose-500' : softWarn80 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {hardWarn95 ? (
            <p className="mt-1 text-[11px] text-rose-600">저장공간 사용량이 95%를 초과했습니다. 정리가 필요합니다.</p>
          ) : null}
          {!hardWarn95 && softWarn80 ? (
            <p className="mt-1 text-[11px] text-amber-700">저장공간 사용량이 80%를 초과했습니다.</p>
          ) : null}
          {usageError ? (
            <p className="mt-1 text-[11px] text-zinc-500">실시간 사용량 연동 대기중: {usageError}</p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <UiButton
            variant="primary"
            size="md"
            onClick={() => toast('플랜 변경 요청 기능은 결제 연동 후 오픈됩니다.')}
            disabled={loading}
          >
            플랜 변경 요청
          </UiButton>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900">플랜 비교</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-600">항목</th>
                {PLAN_ORDER.map((code) => (
                  <th key={code} className="bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-600">
                    {PLAN_POLICIES[code].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">월 요금</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`price-${code}`} className="border-t border-zinc-200 px-3 py-2 text-zinc-800">
                    {formatPrice(PLAN_POLICIES[code].monthlyPrice)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">최대 사용자</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`users-${code}`} className="border-t border-zinc-200 px-3 py-2 text-zinc-800">
                    {PLAN_POLICIES[code].maxUsers}명
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">문서함 용량</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`storage-${code}`} className="border-t border-zinc-200 px-3 py-2 text-zinc-800">
                    {formatStorageSize(PLAN_POLICIES[code].storageBytes)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">파일 1개 제한</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`upload-${code}`} className="border-t border-zinc-200 px-3 py-2 text-zinc-800">
                    {formatStorageSize(PLAN_POLICIES[code].maxUploadBytes)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">지원 정책</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`support-${code}`} className="border-t border-zinc-200 px-3 py-2 text-zinc-800">
                    {PLAN_POLICIES[code].supportText}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-y border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500">기능 요약</td>
                {PLAN_ORDER.map((code) => (
                  <td key={`feature-${code}`} className="border-y border-zinc-200 px-3 py-2 text-xs text-zinc-700">
                    {PLAN_POLICIES[code].featureSummary}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900">애드온</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <div className="flex items-center gap-2 text-zinc-800">
              <PackagePlus className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-medium">저장공간 +100GB 단위</p>
            </div>
            <p className="mt-1 text-xs text-zinc-500">결제 연동 이후 활성화됩니다.</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <div className="flex items-center gap-2 text-zinc-800">
              <Lock className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-medium">사용자 +10명 단위</p>
            </div>
            <p className="mt-1 text-xs text-zinc-500">결제 연동 이후 활성화됩니다.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
