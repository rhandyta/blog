import { LOCALE_META, type Locale } from './locale'

/**
 * Every formatter is explicit about its locale: nothing reads a global
 * "current language". Server renders, emails and the browser bundle therefore
 * agree, and concurrent requests cannot contaminate each other.
 */

export type DateStyle = 'long' | 'short' | 'month' | 'weekday' | 'datetime' | 'time'

/**
 * Publication timestamps are stored as ISO instants. Rendering them in a fixed
 * zone keeps server and browser output identical regardless of where the
 * process runs (development in Asia/Jakarta, production on UTC workers).
 */
export const DEFAULT_TIME_ZONE = 'UTC'

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  month: { month: 'long', year: 'numeric' },
  weekday: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  datetime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(locale: Locale, style: DateStyle, timeZone: string): Intl.DateTimeFormat {
  const key = `${locale}|${style}|${timeZone}`
  const cached = formatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(LOCALE_META[locale].dateLocale, {
    ...DATE_STYLES[style],
    timeZone,
  })
  formatterCache.set(key, formatter)
  return formatter
}

/** Formats an ISO instant; invalid or empty input renders an empty string. */
export function formatDate(
  locale: Locale,
  value: string | number | Date | null | undefined,
  style: DateStyle = 'long',
  options: { timeZone?: string } = {},
): string {
  if (value === null || value === undefined || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return dateFormatter(locale, style, options.timeZone ?? DEFAULT_TIME_ZONE).format(date)
  } catch {
    return ''
  }
}

const numberCache = new Map<string, Intl.NumberFormat>()

/** Formats a number with locale-aware grouping; invalid input renders ''. */
export function formatNumber(
  locale: Locale,
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || value === '') return ''
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return ''
  const key = `${locale}|${JSON.stringify(options)}`
  let formatter = numberCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_META[locale].dateLocale, options)
    numberCache.set(key, formatter)
  }
  return formatter.format(numeric)
}

/**
 * Formats a monetary amount. Amounts are stored in major units (e.g. `12.5`),
 * never pre-formatted, and the currency code is explicit at the call site.
 */
export function formatCurrency(
  locale: Locale,
  value: number | string | null | undefined,
  currency: string = LOCALE_META[locale].currency,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || value === '') return ''
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return ''
  return formatNumber(locale, numeric, { style: 'currency', currency, ...options })
}

/** Percentages from a 0–1 ratio, matching how analytics are stored. */
export function formatPercent(locale: Locale, ratio: number | null | undefined, fractionDigits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return ''
  return formatNumber(locale, ratio, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

/** "3 days ago" / "3 hari lalu" for relative timestamps. */
export function formatRelativeTime(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
): string {
  if (!Number.isFinite(value)) return ''
  try {
    return new Intl.RelativeTimeFormat(LOCALE_META[locale].dateLocale, options).format(value, unit)
  } catch {
    return ''
  }
}

/** Joins a list using the locale's conjunction and separators. */
export function formatList(
  locale: Locale,
  values: string[],
  options: Intl.ListFormatOptions = { type: 'conjunction' },
): string {
  if (!values.length) return ''
  try {
    return new Intl.ListFormat(LOCALE_META[locale].dateLocale, options).format(values)
  } catch {
    return values.join(', ')
  }
}
