import DOMPurify from 'isomorphic-dompurify'

const UNSUPPORTED_IMG_SRC_PATTERN =
  /<img\b[^>]*\bsrc\s*=\s*(['"])\s*(?:cid:|about:blank|file:|javascript:|x-apple-data-detectors:)[^'"]*\1[^>]*>/gi
const IMG_WITHOUT_SRC_PATTERN = /<img\b(?![^>]*\bsrc\s*=)[^>]*>/gi

export type MailAttachmentLike = {
  id?: number
  mime_type?: string | null
  content_id?: string | null
  cid?: string | null
  content_disposition?: string | null
  is_inline?: boolean | null
  preview_url?: string | null
  download_url?: string | null
  file_url?: string | null
  url?: string | null
}

function normalizeCid(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw.replace(/^cid:/i, '').replace(/[<>]/g, '').trim() || null
}

function extractInlineImageUrl(attachment: MailAttachmentLike): string | null {
  return attachment.preview_url || attachment.file_url || attachment.url || attachment.download_url || null
}

function isInlineAttachment(attachment: MailAttachmentLike): boolean {
  if (attachment.is_inline) return true
  if ((attachment.content_disposition || '').toLowerCase() === 'inline') return true
  const mimeType = (attachment.mime_type || '').toLowerCase()
  const hasCid = Boolean(normalizeCid(attachment.content_id) || normalizeCid(attachment.cid))
  return mimeType.startsWith('image/') && hasCid
}

export function sanitizeMailBodyHtml(rawHtml: string, attachments: MailAttachmentLike[] = []): string {
  const cidUrlMap = new Map<string, string>()

  attachments.forEach((attachment) => {
    if (!isInlineAttachment(attachment)) return
    const cid = normalizeCid(attachment.content_id) || normalizeCid(attachment.cid)
    const url = extractInlineImageUrl(attachment)
    if (!cid || !url) return
    cidUrlMap.set(cid, url)
  })

  const cidReplacedHtml = rawHtml.replace(
    /(<img\b[^>]*\bsrc\s*=\s*['"])\s*cid:([^'"]+)(['"][^>]*>)/gi,
    (match, prefix: string, cidRaw: string, suffix: string) => {
      const cid = normalizeCid(cidRaw)
      if (!cid) return match
      const mappedUrl = cidUrlMap.get(cid)
      if (!mappedUrl) return match
      return `${prefix}${mappedUrl}${suffix}`
    }
  )

  const sanitized = DOMPurify.sanitize(cidReplacedHtml, {
    USE_PROFILES: { html: true },
  })

  return sanitized
    .replace(UNSUPPORTED_IMG_SRC_PATTERN, '')
    .replace(IMG_WITHOUT_SRC_PATTERN, '')
}

export function isInlineMailAttachment(attachment: MailAttachmentLike): boolean {
  return isInlineAttachment(attachment)
}
