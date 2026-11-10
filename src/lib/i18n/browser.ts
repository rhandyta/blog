import { DEFAULT_LOCALE, parseLocale, type Locale } from './locale'

/**
 * Locale of the document currently rendered. Client-only React trees (the
 * editor) use it to rebuild the same language the server rendered with.
 */
export function documentLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  return parseLocale(document.documentElement.lang) ?? DEFAULT_LOCALE
}
