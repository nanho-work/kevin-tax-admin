'use client'

import UiButton from '@/components/common/UiButton'
import type { MailRule } from '@/types/adminMail'

type MailRuleListProps = {
  rules: MailRule[]
  deletingRuleId: number | null
  onDeleteRule: (ruleId: number) => void
}

function getRuleMatchFieldLabel(field: MailRule['match_field']) {
  if (field === 'from_email') return '보낸 사람'
  if (field === 'subject') return '제목'
  if (field === 'snippet') return '본문'
  if (field === 'to_email') return '받는 사람'
  if (field === 'cc_email') return '참조자'
  return field
}

function getRuleMatchOperatorLabel(operator: MailRule['match_operator']) {
  if (operator === 'contains') return '포함'
  if (operator === 'equals') return '일치'
  if (operator === 'starts_with') return '시작'
  if (operator === 'ends_with') return '끝'
  return operator
}

export default function MailRuleList({ rules, deletingRuleId, onDeleteRule }: MailRuleListProps) {
  return (
    <div className="mt-3 space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm">
          <span>
            {rule.name} · {getRuleMatchFieldLabel(rule.match_field)} {getRuleMatchOperatorLabel(rule.match_operator)} "{rule.match_value}"
          </span>
          <UiButton onClick={() => onDeleteRule(rule.id)} disabled={deletingRuleId === rule.id} variant="danger" size="xs">
            삭제
          </UiButton>
        </div>
      ))}
    </div>
  )
}
