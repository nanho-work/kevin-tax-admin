'use client'

import UiButton from '@/components/common/UiButton'

export type MailSettingsTab = 'external' | 'spam'

type MailSettingsTabBarProps = {
  value: MailSettingsTab
  onChange: (tab: MailSettingsTab) => void
}

export default function MailSettingsTabBar({ value, onChange }: MailSettingsTabBarProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-1">
      <div className="flex items-center gap-1">
        <UiButton onClick={() => onChange('external')} variant={value === 'external' ? 'tabActive' : 'tabInactive'}>
          외부 메일 연동
        </UiButton>
        <UiButton onClick={() => onChange('spam')} variant={value === 'spam' ? 'tabActive' : 'tabInactive'}>
          스팸 설정
        </UiButton>
      </div>
    </div>
  )
}
