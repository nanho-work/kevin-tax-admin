const ANCHOR_TAG_REGEX = /<a\b[^>]*>/gi

function upsertAnchorAttribute(tag: string, name: string, value: string): string {
  const attrRegex = new RegExp(`\\s${name}\\s*=\\s*(['"])[^'"]*\\1`, 'i')
  if (attrRegex.test(tag)) {
    return tag.replace(attrRegex, ` ${name}="${value}"`)
  }
  return tag.replace(/<a\b/i, `<a ${name}="${value}"`)
}

function upsertAnchorRel(tag: string): string {
  const relRegex = /\srel\s*=\s*(['"])(.*?)\1/i
  const relMatch = tag.match(relRegex)
  const required = ['noopener', 'noreferrer']

  if (!relMatch) {
    return tag.replace(/<a\b/i, `<a rel="${required.join(' ')}"`)
  }

  const existing = relMatch[2]
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  const merged = Array.from(new Set([...existing, ...required]))
  return tag.replace(relRegex, ` rel="${merged.join(' ')}"`)
}

export function enforceAnchorOpenInNewTab(html: string): string {
  if (!html) return ''
  return html.replace(ANCHOR_TAG_REGEX, (tag) => {
    let next = upsertAnchorAttribute(tag, 'target', '_blank')
    next = upsertAnchorRel(next)
    return next
  })
}
