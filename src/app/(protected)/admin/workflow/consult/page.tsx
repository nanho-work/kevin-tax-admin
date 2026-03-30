'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import UiButton from '@/components/common/UiButton'
import {
  getConsultToolCurrentIndustryRates,
  lookupConsultToolIndustryRate,
  type ConsultToolIndustryRateItem,
} from '@/services/consultToolService'
import { getApiErrorMessage } from '@/utils/apiError'

type ExpenseMode = 'AMOUNT' | 'PERCENT'
type ExpenseKey = 'businessPromotion' | 'commission' | 'supplies' | 'travel' | 'other'
type DeductionKey = 'pension' | 'norangUmbrella' | 'retirementPension' | 'user1' | 'user2'

type IndustryRateRow = {
  code: string
  industryName: string
  simpleRateGeneral: number
  simpleRateExcess: number
  standardRateGeneral: number
  middleCategory: string
  subCategory: string
  detailCategory: string
  applyCriteria: string
}

type AllocationInput = {
  mode: ExpenseMode
  value: string
}

type BusinessForm = {
  id: string
  industryCode: string
  grossIncomeInput: string
  expenseRateOverrideInput: string
  allocation: Partial<Record<ExpenseKey, AllocationInput>>
}

type DeductionForm = {
  totalInput: string
  prepaidTaxInput: string
  allocation: Partial<Record<DeductionKey, AllocationInput>>
}

type SummaryResult = {
  totalIncomeAmount: number
  incomeDeduction: number
  taxBase: number
  taxRate: number
  progressiveDeduction: number
  incomeTax: number
  localTax: number
  totalTax: number
  prepaidTax: number
  diffTax: number
}

const MAX_BUSINESSES = 4

const EXPENSE_LABELS: Record<ExpenseKey, string> = {
  businessPromotion: '업무추진비',
  commission: '지급수수료',
  supplies: '소모품비',
  travel: '여비교통비',
  other: '기타(자동 배정)',
}

const DEDUCTION_LABELS: Record<DeductionKey, string> = {
  pension: '연금',
  norangUmbrella: '노란우산',
  retirementPension: '퇴직연금',
  user1: '사용자 입력 1',
  user2: '사용자 입력 2(자동 배정)',
}

const TAX_BRACKETS: Record<number, Array<{ upTo: number | null; rate: number; deduction: number }>> = {
  2024: [
    { upTo: 14_000_000, rate: 0.06, deduction: 0 },
    { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
    { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
    { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
    { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
    { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
    { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
    { upTo: null, rate: 0.45, deduction: 65_940_000 },
  ],
  2023: [
    { upTo: 14_000_000, rate: 0.06, deduction: 0 },
    { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
    { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
    { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
    { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
    { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
    { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
    { upTo: null, rate: 0.45, deduction: 65_940_000 },
  ],
  2022: [
    { upTo: 12_000_000, rate: 0.06, deduction: 0 },
    { upTo: 46_000_000, rate: 0.15, deduction: 1_080_000 },
    { upTo: 88_000_000, rate: 0.24, deduction: 5_220_000 },
    { upTo: 150_000_000, rate: 0.35, deduction: 14_900_000 },
    { upTo: 300_000_000, rate: 0.38, deduction: 19_400_000 },
    { upTo: 500_000_000, rate: 0.40, deduction: 25_400_000 },
    { upTo: 1_000_000_000, rate: 0.42, deduction: 35_400_000 },
    { upTo: null, rate: 0.45, deduction: 65_400_000 },
  ],
}

const defaultBusiness = (): BusinessForm => ({
  id: `${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
  industryCode: '',
  grossIncomeInput: '',
  expenseRateOverrideInput: '',
  allocation: {},
})

const defaultDeduction: DeductionForm = {
  totalInput: '',
  prepaidTaxInput: '',
  allocation: {},
}

function toNumber(input: string): number {
  const digitsOnly = input.replace(/,/g, '').trim()
  if (!digitsOnly) return 0
  const parsed = Number(digitsOnly)
  return Number.isFinite(parsed) ? parsed : 0
}

function withCommas(input: string): string {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return ''
  const normalized = digits.replace(/^0+(?=\d)/, '')
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function normalizePercentInput(input: string): string {
  const trimmed = input.replace(/[%\s,]/g, '')
  const cleaned = trimmed.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function toRateFromPercentInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  const asRate = parsed >= 0 && parsed <= 1 ? parsed : parsed / 100
  return Math.max(0, Math.min(1, asRate))
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString()
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`
}

function normalizeIndustryCode(code: string): string {
  return code.replace(/[^\d]/g, '').trim()
}

function toIndustryRateRow(code: string, rate: ConsultToolIndustryRateItem | null): IndustryRateRow | null {
  if (!rate) return null
  return {
    code,
    industryName: rate.industryName,
    simpleRateGeneral: rate.simpleRateGeneral,
    simpleRateExcess: rate.simpleRateExcess,
    standardRateGeneral: rate.standardRateGeneral,
    middleCategory: rate.middleCategory,
    subCategory: rate.subCategory,
    detailCategory: rate.detailCategory,
    applyCriteria: rate.applyCriteria,
  }
}

function computeExpenseAllocationAmounts(
  allocation: Partial<Record<ExpenseKey, AllocationInput>>,
  requiredExpense: number
): Record<ExpenseKey, number> {
  const amounts: Record<ExpenseKey, number> = {
    businessPromotion: 0,
    commission: 0,
    supplies: 0,
    travel: 0,
    other: 0,
  }
  const keys: ExpenseKey[] = ['businessPromotion', 'commission', 'supplies', 'travel']
  for (const key of keys) {
    const input = allocation[key]
    if (!input) continue
    if (input.mode === 'AMOUNT') {
      amounts[key] = Math.max(0, Math.round(toNumber(input.value)))
    } else {
      const rate = toRateFromPercentInput(input.value) ?? 0
      amounts[key] = Math.max(0, Math.round(requiredExpense * rate))
    }
  }
  const used = keys.reduce((sum, key) => sum + amounts[key], 0)
  amounts.other = Math.max(0, Math.round(requiredExpense - used))
  return amounts
}

function computeDeductionAllocationAmounts(
  allocation: Partial<Record<DeductionKey, AllocationInput>>,
  total: number
): Record<DeductionKey, number> {
  const amounts: Record<DeductionKey, number> = {
    pension: 0,
    norangUmbrella: 0,
    retirementPension: 0,
    user1: 0,
    user2: 0,
  }
  const keys: DeductionKey[] = ['pension', 'norangUmbrella', 'retirementPension', 'user1']
  for (const key of keys) {
    const input = allocation[key]
    if (!input) continue
    if (input.mode === 'AMOUNT') {
      amounts[key] = Math.max(0, Math.round(toNumber(input.value)))
    } else {
      const rate = toRateFromPercentInput(input.value) ?? 0
      amounts[key] = Math.max(0, Math.round(total * rate))
    }
  }
  const used = keys.reduce((sum, key) => sum + amounts[key], 0)
  amounts.user2 = Math.max(0, Math.round(total - used))
  return amounts
}

function computeSummary(params: {
  incomeAmounts: number[]
  deductionTotal: number
  prepaidTax: number
  taxYear: number
}): SummaryResult {
  const totalIncomeAmount = params.incomeAmounts.reduce((sum, value) => sum + value, 0)
  const incomeDeduction = Math.max(0, Math.round(params.deductionTotal))
  const taxBase = Math.max(0, Math.round(totalIncomeAmount - incomeDeduction))
  const bracketSet = TAX_BRACKETS[params.taxYear] ?? TAX_BRACKETS[2024]
  const applied =
    bracketSet.find((bracket) => bracket.upTo === null || taxBase <= bracket.upTo) ??
    bracketSet[bracketSet.length - 1]
  const incomeTax = Math.max(0, Math.round(taxBase * applied.rate - applied.deduction))
  const localTax = Math.round(incomeTax * 0.1)
  const totalTax = incomeTax + localTax
  const prepaidTax = Math.max(0, Math.round(params.prepaidTax))
  const diffTax = totalTax - prepaidTax
  return {
    totalIncomeAmount,
    incomeDeduction,
    taxBase,
    taxRate: applied.rate,
    progressiveDeduction: applied.deduction,
    incomeTax,
    localTax,
    totalTax,
    prepaidTax,
    diffTax,
  }
}

function SummaryCard({ title, summary }: { title: string; summary: SummaryResult }) {
  const rows = [
    ['소득금액 합계', `${formatMoney(summary.totalIncomeAmount)}원`],
    ['소득공제', `${formatMoney(summary.incomeDeduction)}원`],
    ['과세표준', `${formatMoney(summary.taxBase)}원`],
    ['적용 세율', formatRate(summary.taxRate)],
    ['누진공제', `${formatMoney(summary.progressiveDeduction)}원`],
    ['산출세액(소득세)', `${formatMoney(summary.incomeTax)}원`],
    ['지방세', `${formatMoney(summary.localTax)}원`],
    ['총세액', `${formatMoney(summary.totalTax)}원`],
    ['기납부세액', `${formatMoney(summary.prepaidTax)}원`],
    ['차(가)감세액', `${formatMoney(summary.diffTax)}원`],
  ] as const

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <div className="mt-2 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className="font-medium text-zinc-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminConsultToolPage() {
  const [lookupCode, setLookupCode] = useState('')
  const [submittedCode, setSubmittedCode] = useState('')
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<{
    found: boolean
    industryCode: string
    rate: ConsultToolIndustryRateItem | null
  } | null>(null)

  const [businesses, setBusinesses] = useState<BusinessForm[]>([defaultBusiness()])
  const [deduction, setDeduction] = useState<DeductionForm>(defaultDeduction)
  const [taxYear, setTaxYear] = useState(2024)
  const [industryRatesMap, setIndustryRatesMap] = useState<Record<string, ConsultToolIndustryRateItem>>({})

  const [deltaIndex, setDeltaIndex] = useState(1)
  const deltas = [-0.02, 0, 0.02]

  const foundIndustry = useMemo(
    () => toIndustryRateRow(lookupResult?.industryCode || submittedCode, lookupResult?.rate ?? null),
    [lookupResult, submittedCode]
  )

  const normalizedLookupCode = useMemo(() => normalizeIndustryCode(lookupCode), [lookupCode])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const current = await getConsultToolCurrentIndustryRates('admin', taxYear)
        if (cancelled) return
        setIndustryRatesMap(current.rates || {})
      } catch (error) {
        if (!cancelled) {
          setIndustryRatesMap({})
          toast.error(getApiErrorMessage(error, '기준 경비율 데이터를 불러오지 못했습니다.'))
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [taxYear])

  const businessComputed = useMemo(() => {
    return businesses.map((business) => {
      const grossIncome = toNumber(business.grossIncomeInput)
      const normalizedBusinessCode = normalizeIndustryCode(business.industryCode)
      const industry = toIndustryRateRow(normalizedBusinessCode, industryRatesMap[normalizedBusinessCode] ?? null)
      const baseRate = industry?.simpleRateGeneral ?? 0
      const overrideRate = toRateFromPercentInput(business.expenseRateOverrideInput)
      const resolvedRate = overrideRate == null ? baseRate : overrideRate

      const requiredExpense = Math.round(grossIncome * resolvedRate)
      const expenseAllocationAmounts = computeExpenseAllocationAmounts(business.allocation, requiredExpense)
      const incomeAmount = Math.round(grossIncome - requiredExpense)
      return {
        business,
        industry,
        grossIncome,
        baseRate,
        resolvedRate,
        requiredExpense,
        incomeAmount,
        expenseAllocationAmounts,
      }
    })
  }, [businesses])

  const deductionTotal = toNumber(deduction.totalInput)
  const prepaidTax = toNumber(deduction.prepaidTaxInput)
  const deductionAllocationAmounts = useMemo(
    () => computeDeductionAllocationAmounts(deduction.allocation, deductionTotal),
    [deduction.allocation, deductionTotal]
  )

  const simulations = useMemo(() => {
    return deltas.map((delta) => {
      const adjustedIncomeAmounts = businessComputed.map((entry) => {
        const grossIncome = entry.grossIncome
        const adjustedRate = Math.max(0, Math.min(1, entry.resolvedRate + delta))
        const requiredExpense = Math.round(grossIncome * adjustedRate)
        return Math.round(grossIncome - requiredExpense)
      })
      return {
        delta,
        summary: computeSummary({
          incomeAmounts: adjustedIncomeAmounts,
          deductionTotal,
          prepaidTax,
          taxYear,
        }),
      }
    })
  }, [businessComputed, deductionTotal, prepaidTax, taxYear])

  const currentSimulation = simulations[deltaIndex] ?? simulations[1]
  const leftSimulation = simulations[deltaIndex - 1] ?? null
  const rightSimulation = simulations[deltaIndex + 1] ?? null

  const handleSearchIndustry = async () => {
    const normalized = normalizeIndustryCode(lookupCode)
    setSubmittedCode(normalized)
    if (!normalized) {
      setLookupResult(null)
      setLookupOpen(true)
      return
    }
    setLookupLoading(true)
    try {
      const response = await lookupConsultToolIndustryRate('admin', {
        taxYear,
        industryCode: normalized,
      })
      setLookupResult({
        found: response.found,
        industryCode: response.industry_code,
        rate: response.rate,
      })
      setLookupOpen(true)
    } catch (error) {
      setLookupResult(null)
      toast.error(getApiErrorMessage(error, '업종코드 조회에 실패했습니다.'))
    } finally {
      setLookupLoading(false)
    }
  }

  const handleResetLookup = () => {
    setLookupCode('')
    setSubmittedCode('')
    setLookupResult(null)
    setLookupOpen(false)
  }

  const updateBusiness = (id: string, patch: Partial<BusinessForm>) => {
    setBusinesses((prev) =>
      prev.map((business) => (business.id === id ? { ...business, ...patch } : business))
    )
  }

  const removeBusiness = (id: string) => {
    setBusinesses((prev) => (prev.length <= 1 ? prev : prev.filter((business) => business.id !== id)))
  }

  const addBusiness = () => {
    setBusinesses((prev) => (prev.length >= MAX_BUSINESSES ? prev : [...prev, defaultBusiness()]))
  }

  const updateExpenseAllocation = (
    businessId: string,
    key: ExpenseKey,
    patch: Partial<AllocationInput>
  ) => {
    setBusinesses((prev) =>
      prev.map((business) => {
        if (business.id !== businessId) return business
        const current = business.allocation[key] ?? { mode: 'AMOUNT', value: '' }
        return {
          ...business,
          allocation: {
            ...business.allocation,
            [key]: { ...current, ...patch },
          },
        }
      })
    )
  }

  const updateDeductionAllocation = (key: DeductionKey, patch: Partial<AllocationInput>) => {
    const current = deduction.allocation[key] ?? { mode: 'AMOUNT' as ExpenseMode, value: '' }
    setDeduction((prev) => ({
      ...prev,
      allocation: {
        ...prev.allocation,
        [key]: { ...current, ...patch },
      },
    }))
  }

  return (
    <section className="-m-6 min-h-[calc(100vh-64px)] bg-white p-6">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">상담용 계산기</h1>
          <p className="mt-1 text-xs text-zinc-500">
            사업장(1~4개)은 각각 입력하고, 소득공제/세율/기납부는 동일인 기준으로 합산 계산합니다.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-zinc-900">업종코드 조회(검수용)</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={lookupCode}
              onChange={(event) => setLookupCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSearchIndustry()
                }
              }}
              placeholder="업종코드 입력 (예: 701101)"
              className="h-9 w-[240px] rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
            <UiButton size="sm" onClick={() => void handleSearchIndustry()} disabled={lookupLoading}>
              {lookupLoading ? '조회 중...' : '조회'}
            </UiButton>
            {submittedCode ? (
              <UiButton size="sm" variant="secondary" onClick={() => setLookupOpen((prev) => !prev)}>
                {lookupOpen ? '접기' : '펼치기'}
              </UiButton>
            ) : null}
            <UiButton size="sm" variant="secondary" onClick={handleResetLookup}>초기화</UiButton>
            <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
              정규화: {normalizedLookupCode || '-'}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">경비율은 0~1 비율 기준 데이터입니다. (예: 0.72 = 72%)</p>

          {lookupOpen && submittedCode && lookupResult && !lookupResult.found ? (
            <p className="mt-3 text-sm text-rose-600">
              입력한 업종코드({submittedCode})에 해당하는 항목을 찾지 못했습니다.
            </p>
          ) : null}

          {lookupOpen && foundIndustry ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
              <table className="min-w-full text-xs">
                <tbody>
                  {[
                    ['업종코드', foundIndustry.code],
                    ['업태명', foundIndustry.industryName],
                    ['단순경비율(일반율)', `${formatRate(foundIndustry.simpleRateGeneral)} (${foundIndustry.simpleRateGeneral})`],
                    ['단순경비율(초과율)', `${formatRate(foundIndustry.simpleRateExcess)} (${foundIndustry.simpleRateExcess})`],
                    ['기준경비율(일반율)', `${formatRate(foundIndustry.standardRateGeneral)} (${foundIndustry.standardRateGeneral})`],
                    ['중분류', foundIndustry.middleCategory],
                    ['세분류', foundIndustry.subCategory],
                    ['세세분류', foundIndustry.detailCategory],
                    ['적용기준내용', foundIndustry.applyCriteria],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-t border-zinc-200 first:border-t-0">
                      <th className="w-[190px] bg-zinc-50 px-2.5 py-2 text-left font-medium text-zinc-600">{label}</th>
                      <td className="px-2.5 py-2 text-zinc-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">사업장 입력</h2>
            <UiButton size="sm" onClick={addBusiness} disabled={businesses.length >= MAX_BUSINESSES}>
              + 사업장 추가
            </UiButton>
          </div>

          {businessComputed.map((entry, index) => (
            <div key={entry.business.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">사업장 {index + 1}</p>
                <UiButton
                  size="xs"
                  variant="danger"
                  onClick={() => removeBusiness(entry.business.id)}
                  disabled={businesses.length <= 1}
                >
                  삭제
                </UiButton>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">업종코드</span>
                  <input
                    value={entry.business.industryCode}
                    onChange={(event) =>
                      updateBusiness(entry.business.id, { industryCode: event.target.value.replace(/[^\d]/g, '') })
                    }
                    placeholder="예: 940909"
                    className="h-9 w-full rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    기본 경비율: {formatRate(entry.baseRate)} {entry.industry ? `· ${entry.industry.industryName}` : '· 코드 조회 결과 없음'}
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">총수입금액</span>
                  <input
                    value={entry.business.grossIncomeInput}
                    onChange={(event) =>
                      updateBusiness(entry.business.id, { grossIncomeInput: withCommas(event.target.value) })
                    }
                    placeholder="원 단위 숫자"
                    className="h-9 w-full rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">경비율 override(선택)</span>
                  <div className="relative">
                    <input
                      value={entry.business.expenseRateOverrideInput}
                      onChange={(event) =>
                        updateBusiness(entry.business.id, {
                          expenseRateOverrideInput: normalizePercentInput(event.target.value),
                        })
                      }
                      placeholder="예: 70 또는 70.5"
                      className="h-9 w-full rounded-md border border-zinc-300 px-2.5 pr-8 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    적용 경비율: {formatRate(entry.resolvedRate)} ({entry.business.expenseRateOverrideInput ? '사용자 입력' : '업종 기본값'})
                  </p>
                </label>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700">
                  <div>필요경비(자동): <span className="font-semibold">{formatMoney(entry.requiredExpense)}원</span></div>
                  <div className="mt-1">소득금액(자동): <span className="font-semibold">{formatMoney(entry.incomeAmount)}원</span></div>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-zinc-200 p-3">
                <p className="text-xs font-medium text-zinc-700">세부항목 배분(선택)</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  필요경비는 자동 산정되며, 아래는 배분 기록입니다. 남는 금액은 기타로 자동 배정됩니다.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(Object.keys(EXPENSE_LABELS) as ExpenseKey[]).map((key) => {
                    const input = entry.business.allocation[key] ?? { mode: 'AMOUNT' as ExpenseMode, value: '' }
                    const disabled = key === 'other'
                    return (
                      <div key={key} className="rounded border border-zinc-200 p-2.5">
                        <p className="text-xs font-medium text-zinc-700">{EXPENSE_LABELS[key]}</p>
                        <div className="mt-1.5 flex gap-1.5">
                          <select
                            value={input.mode}
                            disabled={disabled}
                            onChange={(event) =>
                              updateExpenseAllocation(entry.business.id, key, {
                                mode: event.target.value as ExpenseMode,
                              })
                            }
                            className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800"
                          >
                            <option value="AMOUNT">금액</option>
                            <option value="PERCENT">퍼센트</option>
                          </select>
                          <input
                            value={disabled ? '' : input.value}
                            disabled={disabled}
                            onChange={(event) =>
                              updateExpenseAllocation(entry.business.id, key, {
                                value: input.mode === 'AMOUNT'
                                  ? withCommas(event.target.value)
                                  : normalizePercentInput(event.target.value),
                              })
                            }
                            placeholder={disabled ? '자동' : input.mode === 'AMOUNT' ? '원 단위' : '퍼센트'}
                            className="h-8 w-full rounded border border-zinc-300 px-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-500"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          배정 금액: <span className="font-semibold text-zinc-700">{formatMoney(entry.expenseAllocationAmounts[key])}원</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-zinc-900">공통 사항</h2>
          <p className="mt-1 text-xs text-zinc-500">여러 사업장을 입력해도 아래 항목은 1회만 입력합니다.</p>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">귀속연도</span>
              <select
                value={taxYear}
                onChange={(event) => setTaxYear(Number(event.target.value))}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                {[2024, 2023, 2022].map((year) => (
                  <option key={year} value={year}>{year} 귀속</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">소득공제 총액</span>
              <input
                value={deduction.totalInput}
                onChange={(event) =>
                  setDeduction((prev) => ({ ...prev, totalInput: withCommas(event.target.value) }))
                }
                placeholder="예: 1,500,000"
                className="h-9 w-full rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-600">기납부세액</span>
              <input
                value={deduction.prepaidTaxInput}
                onChange={(event) =>
                  setDeduction((prev) => ({ ...prev, prepaidTaxInput: withCommas(event.target.value) }))
                }
                placeholder="예: 0"
                className="h-9 w-full rounded-md border border-zinc-300 px-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <div className="mt-3 rounded-md border border-zinc-200 p-3">
            <p className="text-xs font-medium text-zinc-700">소득공제 상세 배분(선택)</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(Object.keys(DEDUCTION_LABELS) as DeductionKey[]).map((key) => {
                const input = deduction.allocation[key] ?? { mode: 'AMOUNT' as ExpenseMode, value: '' }
                const disabled = key === 'user2'
                return (
                  <div key={key} className="rounded border border-zinc-200 p-2.5">
                    <p className="text-xs font-medium text-zinc-700">{DEDUCTION_LABELS[key]}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <select
                        value={input.mode}
                        disabled={disabled}
                        onChange={(event) =>
                          updateDeductionAllocation(key, {
                            mode: event.target.value as ExpenseMode,
                          })
                        }
                        className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800"
                      >
                        <option value="AMOUNT">금액</option>
                        <option value="PERCENT">퍼센트</option>
                      </select>
                      <input
                        value={disabled ? '' : input.value}
                        disabled={disabled}
                        onChange={(event) =>
                          updateDeductionAllocation(key, {
                            value: input.mode === 'AMOUNT'
                              ? withCommas(event.target.value)
                              : normalizePercentInput(event.target.value),
                          })
                        }
                        placeholder={disabled ? '자동' : input.mode === 'AMOUNT' ? '원 단위' : '퍼센트'}
                        className="h-8 w-full rounded border border-zinc-300 px-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-500"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      배정 금액: <span className="font-semibold text-zinc-700">{formatMoney(deductionAllocationAmounts[key])}원</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">합산 결과(시뮬레이션)</h2>
              <p className="mt-1 text-xs text-zinc-500">
                기준 대비 경비율을 ±2%p로 변경했을 때 차(가)감세액 변화를 확인합니다.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <UiButton
                size="xs"
                variant="secondary"
                onClick={() => setDeltaIndex((prev) => Math.max(0, prev - 1))}
                disabled={deltaIndex <= 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </UiButton>
              <UiButton size="xs" variant="secondary" onClick={() => setDeltaIndex(1)}>
                <RotateCcw className="h-3.5 w-3.5" />
              </UiButton>
              <UiButton
                size="xs"
                variant="secondary"
                onClick={() => setDeltaIndex((prev) => Math.min(deltas.length - 1, prev + 1))}
                disabled={deltaIndex >= deltas.length - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </UiButton>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {leftSimulation ? (
              <SummaryCard title={`${leftSimulation.delta > 0 ? '+' : ''}${(leftSimulation.delta * 100).toFixed(1)}%p`} summary={leftSimulation.summary} />
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-sm text-zinc-400">-</div>
            )}

            <SummaryCard
              title={`${currentSimulation.delta > 0 ? '+' : ''}${(currentSimulation.delta * 100).toFixed(1)}%p (현재)`}
              summary={currentSimulation.summary}
            />

            {rightSimulation ? (
              <SummaryCard title={`${rightSimulation.delta > 0 ? '+' : ''}${(rightSimulation.delta * 100).toFixed(1)}%p`} summary={rightSimulation.summary} />
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-sm text-zinc-400">-</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
