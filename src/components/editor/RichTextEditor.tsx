'use client'

import TiptapEditor from '@/components/editor/TiptapEditor'
import { RICH_EDITOR_PRESETS, type RichEditorPreset } from '@/components/editor/editorPresets'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  preset?: RichEditorPreset
}

export default function RichTextEditor({ value, onChange, preset = 'blog' }: RichTextEditorProps) {
  const config = RICH_EDITOR_PRESETS[preset]

  return (
    <TiptapEditor
      value={value}
      onChange={onChange}
      placeholder={config.placeholder}
      enableImageUpload={config.enableImageUpload}
    />
  )
}
