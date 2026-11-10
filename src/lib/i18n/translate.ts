import { DEFAULT_LOCALE, pluralCategory, type Locale } from './locale'
import { interpolate, type TranslationVars } from './interpolate'
import { messages } from './messages'

export type { TranslationVars }
export { interpolate }

type NonEmpty<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${NonEmpty<T[K]>}`
}[keyof T & string]

/** Dot-notation union of every key defined in `messages/id`. */
export type TranslationKey = NonEmpty<typeof messages.id>

export type Translate = (key: TranslationKey, vars?: TranslationVars) => string

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])
const warned = new Set<string>()

function isWritable(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production'
}

function warnMissing(locale: Locale, key: string): void {
  if (!isWritable()) return
  const marker = `${locale}:${key}`
  if (warned.has(marker)) return
  warned.add(marker)
  console.warn(`[i18n] missing ${locale} translation for "${key}" (fell back to ${DEFAULT_LOCALE})`)
}

/** Resolves a dot-notation key inside a message tree. */
function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree
  for (const segment of key.split('.')) {
    if (FORBIDDEN_SEGMENTS.has(segment)) return undefined
    if (typeof node !== 'object' || node === null) return undefined
    if (!Object.hasOwn(node as Record<string, unknown>, segment)) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string' ? node : undefined
}

/** Replaces `{{name}}` placeholders. Unknown placeholders are left untouched. */

type Resolution = { locale: Locale; key: string }

function candidateKeys(key: string, vars: TranslationVars | undefined, locale: Locale): string[] {
  const count = vars?.count
  if (typeof count === 'number' && Number.isFinite(count)) {
    const category = pluralCategory(locale, count)
    if (category !== 'other') return [`${key}_${category}`, `${key}_other`, key]
  }
  return [key]
}

/**
 * Finds the message for a locale, falling back to the default locale and then
 * to the key itself. Locale is always explicit — no process-wide state.
 */
function resolve(locale: Locale, key: string, vars?: TranslationVars): Resolution | null {
  for (const candidate of candidateKeys(key, vars, locale)) {
    if (lookup(messages[locale], candidate) !== undefined) return { locale, key: candidate }
  }
  if (locale !== DEFAULT_LOCALE) {
    for (const candidate of candidateKeys(key, vars, DEFAULT_LOCALE)) {
      if (lookup(messages[DEFAULT_LOCALE], candidate) !== undefined) {
        return { locale: DEFAULT_LOCALE, key: candidate }
      }
    }
  }
  return null
}

export function hasMessage(locale: Locale, key: string): boolean {
  return lookup(messages[locale], key) !== undefined
}

/** Raw message lookup without interpolation or fallback. */
export function rawMessage(locale: Locale, key: string): string | undefined {
  return lookup(messages[locale], key)
}

/**
 * Translates a key. `count` drives pluralisation (`_one`/`_other` suffixes);
 * any other entry in `vars` fills `{{placeholder}}` slots.
 */
export function translate(locale: Locale, key: string, vars?: TranslationVars): string {
  const found = resolve(locale, key, vars)
  if (!found) {
    warnMissing(locale, key)
    return key
  }
  const template = lookup(messages[found.locale], found.key) ?? key
  return interpolate(template, vars)
}

export function createTranslator(locale: Locale): Translate {
  return ((key: TranslationKey, vars?: TranslationVars) => translate(locale, key, vars)) as Translate
}

const translators: Partial<Record<Locale, Translate>> = {}

/** Cached translator; the dictionary is shared, only the binding differs. */
export function getTranslator(locale: Locale): Translate {
  const cached = translators[locale]
  if (cached) return cached
  const translator = createTranslator(locale)
  translators[locale] = translator
  return translator
}

/** Flattens a message tree into `key → value`, used by integrity tests. */
export function flattenMessages(tree: unknown, prefix = ''): Record<string, string> {
  const output: Record<string, string> = {}
  if (typeof tree !== 'object' || tree === null) return output
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') output[path] = value
    else if (value && typeof value === 'object') Object.assign(output, flattenMessages(value, path))
  }
  return output
}

/** Base key for plural variants: `x_one` → `x`. */
export function pluralBaseKey(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, '')
}
