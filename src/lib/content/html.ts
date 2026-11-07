const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

export function safeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  if (value.startsWith('#')) return value
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (!SAFE_SCHEMES.has(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function externalLink(raw: string): boolean {
  return /^https?:\/\//i.test(raw)
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Splits prose into paragraphs. Stored text may use CRLF or even bare CR
 * (Windows textareas post `\r\n`), so line endings are normalised first —
 * splitting on `/\n{2,}/` alone merges paragraphs saved with CRLF.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = origin.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function formatDate(iso: string | null | undefined, style: 'long' | 'short' | 'month' = 'long'): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (style === 'short') {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  }
  if (style === 'month') {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function isoDay(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}
