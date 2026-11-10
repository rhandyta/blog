import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getTranslator,
  localeFromAcceptLanguage,
  parseLocale,
  splitLocalePath,
  type Locale,
} from '../lib/i18n'
import type { User } from '../lib/db/schema'
import type { AppEnv } from './types'

export type LocaleSource = 'url' | 'query' | 'cookie' | 'user' | 'header' | 'default'

export type LocaleResolution = {
  locale: Locale
  source: LocaleSource
  /** The request path with any locale prefix removed. */
  localPath: string
  /** True when the URL itself carried the locale. */
  fromUrl: boolean
}

/** Locale stored on the user's profile, when the account has one. */
export function userLocale(user: User | null | undefined): Locale | null {
  return parseLocale((user as { locale?: string | null } | null | undefined)?.locale ?? null)
}

/**
 * Deterministic locale negotiation:
 *   1. explicit locale segment in the URL
 *   2. explicit `?lang=` override (useful for links and API clients)
 *   3. saved preference cookie
 *   4. saved preference on an authenticated profile
 *   5. browser `Accept-Language`
 *   6. Indonesian
 */
export function resolveRequestLocale(c: Context<AppEnv>): LocaleResolution {
  const { locale: urlLocale, path } = splitLocalePath(c.req.path)
  if (urlLocale) return { locale: urlLocale, source: 'url', localPath: path, fromUrl: true }

  const queryLocale = parseLocale(c.req.query('lang'))
  if (queryLocale) return { locale: queryLocale, source: 'query', localPath: c.req.path, fromUrl: false }

  const cookieLocale = parseLocale(getCookie(c, LOCALE_COOKIE))
  if (cookieLocale) return { locale: cookieLocale, source: 'cookie', localPath: c.req.path, fromUrl: false }

  const profileLocale = userLocale(c.get('user'))
  if (profileLocale) return { locale: profileLocale, source: 'user', localPath: c.req.path, fromUrl: false }

  const headerLocale = localeFromAcceptLanguage(c.req.header('accept-language'))
  if (headerLocale) return { locale: headerLocale, source: 'header', localPath: c.req.path, fromUrl: false }

  return { locale: DEFAULT_LOCALE, source: 'default', localPath: c.req.path, fromUrl: false }
}

/**
 * Installs the request-scoped locale. It must run after the session middleware
 * so an authenticated profile preference can participate in negotiation.
 */
export const localeMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const resolved = resolveRequestLocale(c)
  c.set('locale', resolved.locale)
  c.set('t', getTranslator(resolved.locale))
  c.set('localPath', resolved.localPath)
  await next()

  const type = c.res.headers.get('content-type') ?? ''
  const isHtml = type.includes('text/html')
  const isJson = type.includes('application/json')
  if (isHtml || isJson) {
    c.header('Content-Language', resolved.locale)
  }
  // Negotiated responses are user-specific: never let a shared cache hand one
  // visitor's language to another. Locale-prefixed URLs and explicit `?lang=`
  // requests stay cacheable because the URL already identifies the language.
  const negotiated = !resolved.fromUrl && resolved.source !== 'query'
  if (negotiated && (isHtml || isJson)) {
    const vary = c.res.headers.get('vary')
    const merged = vary ? `${vary}, Accept-Language, Cookie` : 'Accept-Language, Cookie'
    c.header('Vary', merged)
  }
}

/** The request path with the locale prefix removed. */
export function localPath(c: Context<AppEnv>): string {
  return c.get('localPath') ?? c.req.path
}

/**
 * Refuses redirect targets that could leave the site. Only root-relative paths
 * are accepted, which also blocks protocol-relative `//evil.example` URLs.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return fallback
  return trimmed
}
