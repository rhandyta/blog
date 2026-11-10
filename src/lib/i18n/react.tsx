import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { formatCurrency, formatDate, formatNumber, formatPercent, type DateStyle } from './format'
import { DEFAULT_LOCALE, localizedPath, type Locale } from './locale'
import { getTranslator, type Translate } from './translate'

export type I18nValue = {
  locale: Locale
  /** Translation function bound to `locale`. */
  t: Translate
  /** Builds a link for the current surface (locale-prefixed for the public site). */
  href: (path: string) => string
  /** Current request path (locale-free) plus query string, for the switcher. */
  currentPath: string
  formatDate: (value: string | number | Date | null | undefined, style?: DateStyle) => string
  formatNumber: (value: number | string | null | undefined, options?: Intl.NumberFormatOptions) => string
  formatCurrency: (
    value: number | string | null | undefined,
    currency?: string,
    options?: Intl.NumberFormatOptions,
  ) => string
  formatPercent: (value: number | null | undefined, fractionDigits?: number) => string
}

export function createI18nValue(
  locale: Locale,
  options: { localizedLinks?: boolean; currentPath?: string } = {},
): I18nValue {
  const t = getTranslator(locale)
  const localizedLinks = options.localizedLinks ?? false
  return {
    locale,
    t,
    href: (path) => (localizedLinks ? localizedPath(locale, path) : path),
    currentPath: options.currentPath ?? '/',
    formatDate: (value, style = 'long') => formatDate(locale, value, style),
    formatNumber: (value, opts) => formatNumber(locale, value, opts),
    formatCurrency: (value, currency, opts) => formatCurrency(locale, value, currency, opts),
    formatPercent: (value, digits) => formatPercent(locale, value, digits),
  }
}

const defaultContext: I18nValue = createI18nValue(DEFAULT_LOCALE)

const I18nContext = createContext<I18nValue>(defaultContext)

export function I18nProvider({
  locale,
  localizedLinks = false,
  currentPath = '/',
  children,
}: {
  locale: Locale
  localizedLinks?: boolean
  currentPath?: string
  children: ReactNode
}) {
  const value = useMemo(
    () => createI18nValue(locale, { localizedLinks, currentPath }),
    [locale, localizedLinks, currentPath],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Reads the active language for the current render tree. */
export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
