/**
 * Locale primitives shared by the server, the React renderer and the browser
 * bundle. This module deliberately has no dependencies so it can run in every
 * environment (Hono worker, Bun, browser).
 */

export const LOCALES = ['id', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/** Indonesian is the publication's primary language and the final fallback. */
export const DEFAULT_LOCALE: Locale = 'id'

/** Cookie that remembers an anonymous visitor's language choice. */
export const LOCALE_COOKIE = 'lang'

/** One year: the choice should survive browser restarts. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export type LocaleMeta = {
  code: Locale
  /** Endonym shown in the language switcher. */
  label: string
  /** Label used when the interface language itself is not yet decided. */
  englishLabel: string
  /** Compact label for tight spaces. */
  shortLabel: string
  htmlLang: string
  /** BCP 47 tag handed to the Intl APIs. */
  dateLocale: string
  /** Open Graph locale (underscored territory form). */
  ogLocale: string
  currency: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  id: {
    code: 'id',
    label: 'Bahasa Indonesia',
    englishLabel: 'Indonesian',
    shortLabel: 'ID',
    htmlLang: 'id',
    dateLocale: 'id-ID',
    ogLocale: 'id_ID',
    currency: 'IDR',
  },
  en: {
    code: 'en',
    label: 'English',
    englishLabel: 'English',
    shortLabel: 'EN',
    htmlLang: 'en',
    dateLocale: 'en-US',
    ogLocale: 'en_US',
    currency: 'USD',
  },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Accepts a raw value from a URL, cookie or header and returns a supported
 * locale or `null`. `in` is the legacy ISO 639-1 code for Indonesian and is
 * still emitted by some clients, so it is normalised rather than rejected.
 */
export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const normalised = value.trim().toLowerCase().split(/[-_]/)[0]
  if (!normalised) return null
  if (normalised === 'in') return 'id'
  if (isLocale(normalised)) return normalised
  return null
}

/** Never throws: anything unsupported becomes the default locale. */
export function resolveLocale(value: string | null | undefined): Locale {
  return parseLocale(value) ?? DEFAULT_LOCALE
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'id' ? 'en' : 'id'
}

/**
 * Parses `Accept-Language` honouring quality values. The first supported
 * language wins; when none match, `DEFAULT_LOCALE` is used by the caller.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const candidates: Array<{ locale: Locale; quality: number; order: number }> = []
  header.split(',').forEach((part, order) => {
    const [rawTag, ...params] = part.trim().split(';')
    const locale = parseLocale(rawTag)
    if (!locale) return
    let quality = 1
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param)
      if (match) {
        const parsed = Number(match[1])
        if (Number.isFinite(parsed)) quality = parsed
      }
    }
    if (quality <= 0) return
    candidates.push({ locale, quality, order })
  })
  candidates.sort((a, b) => b.quality - a.quality || a.order - b.order)
  return candidates[0]?.locale ?? null
}

/* ------------------------------------------------------------------ *
 *  URL helpers
 * ------------------------------------------------------------------ */

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

/** True for links that must never receive a locale prefix. */
export function isExternalHref(href: string): boolean {
  return ABSOLUTE_URL.test(href)
}

/**
 * Prefixes a root-relative path with a locale segment.
 * `localizedPath('en', '/')` → `/en`; `localizedPath('id', '/about')` → `/id/about`.
 */
export function localizedPath(locale: Locale, path: string): string {
  if (isExternalHref(path)) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  if (clean === '/') return `/${locale}`
  return `/${locale}${clean}`
}

const LOCALE_SEGMENT = /^\/([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)(?=\/|$)/

/**
 * Splits a request path into a supported locale prefix and the remaining
 * local path. Unsupported or absent prefixes yield `locale: null` and the
 * path unchanged.
 */
export function splitLocalePath(path: string): { locale: Locale | null; path: string } {
  const match = path.match(LOCALE_SEGMENT)
  if (!match || !isLocale(match[1].toLowerCase())) return { locale: null, path }
  const rest = path.slice(match[0].length)
  return { locale: match[1].toLowerCase() as Locale, path: rest || '/' }
}

/** Returns the local path without a locale prefix. */
export function stripLocalePrefix(path: string): string {
  return splitLocalePath(path).path
}

/**
 * Rewrites a path so it points at the same page in another locale. When the
 * path is not locale-prefixed, it is treated as the default locale's form.
 */
export function switchLocalePath(path: string, locale: Locale): string {
  if (isExternalHref(path)) return path
  const { path: local } = splitLocalePath(path)
  return localizedPath(locale, local)
}

/* ------------------------------------------------------------------ *
 *  Pluralisation
 * ------------------------------------------------------------------ */

export type PluralCategory = 'one' | 'other'

/**
 * CLDR plural categories for the two supported languages. Indonesian has a
 * single form; English distinguishes one from the rest.
 */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  if (locale === 'en') return count === 1 ? 'one' : 'other'
  return 'other'
}
