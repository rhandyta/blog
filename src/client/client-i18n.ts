import type { ClientMessages } from '../lib/i18n/client'

/**
 * Reads the server-serialised copy bundle. Parsed once and cached: every client
 * script shares the same instance instead of re-reading the DOM.
 */
let cached: ClientMessages | null = null

export function clientMessages(): ClientMessages | null {
  if (cached) return cached
  const node = document.querySelector('[data-client-i18n]')
  const raw = node?.getAttribute('data-client-i18n')
  if (!raw) return null
  try {
    cached = JSON.parse(raw) as ClientMessages
    return cached
  } catch {
    return null
  }
}

/** Minimal placeholder interpolation for client-side messages. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, name: string) => {
    if (!Object.hasOwn(vars, name)) return match
    return String(vars[name])
  })
}

export function formatDateFor(locale: string, value: string | null, style: 'short' | 'long' = 'short'): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: style === 'long' ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return ''
  }
}
