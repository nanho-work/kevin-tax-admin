const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'msi',
  'msp',
  'bat',
  'cmd',
  'com',
  'scr',
  'pif',
  'cpl',
  'jar',
  'js',
  'jse',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'hta',
  'reg',
  'dll',
  'sys',
  'apk',
  'ipa',
])

export interface FileUploadValidationResult {
  valid: boolean
  message?: string
}

function formatBytesForPolicy(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function getExtension(fileName: string): string {
  const normalized = (fileName || '').trim().toLowerCase()
  if (!normalized.includes('.')) return ''
  return normalized.split('.').pop() || ''
}

export function validateUploadFile(
  file: File,
  options?: { maxBytes?: number }
): FileUploadValidationResult {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_FILE_BYTES

  if (!file || file.size <= 0) {
    return {
      valid: false,
      message: `${file?.name || '파일'}: 빈 파일은 업로드할 수 없습니다.`,
    }
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      message: `${file.name}: 파일 크기 제한(${formatBytesForPolicy(maxBytes)})을 초과했습니다.`,
    }
  }

  const ext = getExtension(file.name)
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      message: `${file.name}: 보안 정책상 업로드할 수 없는 확장자(.${ext})입니다.`,
    }
  }

  return { valid: true }
}
