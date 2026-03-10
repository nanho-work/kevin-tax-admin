export function toCleanMailSnippet(raw?: string | null): string {
  if (!raw) return '-'

  let text = String(raw)

  // Remove MIME encoded words and quoted-printable line wrapping.
  text = text.replace(/=\?[^?]+\?[BbQq]\?[^?]*\?=/g, ' ')
  text = text.replace(/=\r?\n/g, '')
  text = text.replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )

  // Decode common HTML entities early, then strip markup again.
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

  // Strip obvious HTML/image payloads from preview text.
  text = text.replace(/<img[^>]*>/gi, ' ')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, ' ')
  text = text.replace(
    /\b(?:img|span|div|p|table|tr|td|font|a)\b\s+(?:[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)\s*)+/gi,
    ' '
  )
  text = text.replace(
    /\b(?:src|href|style|class|width|height|alt|border|cellpadding|cellspacing)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/gi,
    ' '
  )

  // Drop technical MIME header lines from snippet preview.
  text = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(content-type|content-transfer-encoding|mime-version|boundary=|--)/i.test(line) &&
        !/^cid:/i.test(line) &&
        !/^[.#]?[a-z0-9_-]+\s*\{[^}]*\}$/i.test(line) &&
        !/^[a-z-]+\s*:\s*[^;{}]+;?$/i.test(line) &&
        !/^@(?:media|font-face|supports|keyframes)\b/i.test(line)
    )
    .join(' ')

  text = text
    .replace(/[{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return '텍스트 미리보기가 없습니다.'
  if (/^[A-Za-z0-9+/=._-]{40,}$/.test(text)) return '텍스트 미리보기가 없습니다.'

  return text
}

export function resolveMailSnippet(params: {
  snippetText?: string | null
  snippet?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
}): string {
  const source =
    params.snippetText ||
    params.snippet ||
    params.bodyText ||
    params.bodyHtml ||
    null

  return toCleanMailSnippet(source)
}
