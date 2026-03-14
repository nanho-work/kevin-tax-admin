export type RichEditorPreset = 'blog' | 'document' | 'workPost' | 'mail'

export type RichEditorPresetConfig = {
  placeholder: string
  enableImageUpload: boolean
}

export const RICH_EDITOR_PRESETS: Record<RichEditorPreset, RichEditorPresetConfig> = {
  blog: {
    placeholder: '본문을 입력하세요...',
    enableImageUpload: true,
  },
  document: {
    placeholder: '결재 문서 내용을 입력해 주세요.',
    enableImageUpload: false,
  },
  workPost: {
    placeholder: '공지/업무지시 내용을 입력해 주세요.',
    enableImageUpload: false,
  },
  mail: {
    placeholder: '메일 본문을 입력하세요.',
    enableImageUpload: false,
  },
}
