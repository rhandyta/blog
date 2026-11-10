import type { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { isProd } from '../../lib/config'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, parseLocale } from '../../lib/i18n'
import { updateUserLocale } from '../../lib/db/queries/users'
import { localizedTarget } from '../routing'
import { safeNextPath } from '../locale'
import type { AppEnv } from '../types'

/** Persists a locale choice and returns to the page the visitor came from. */
export function registerLocaleRoutes(app: Hono<AppEnv>): void {
  app.post('/locale', async (c) => {
    let body: Record<string, unknown> = {}
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>
    } catch {
      body = {}
    }

    // Unsupported values are ignored rather than trusted: the request keeps the
    // language it already negotiated, so a bad form post cannot break the UI.
    const requested = parseLocale(typeof body.locale === 'string' ? body.locale : null)
    const locale = requested ?? c.get('locale')
    const next = safeNextPath(typeof body.next === 'string' ? body.next : null, '/')

    setCookie(c, LOCALE_COOKIE, locale, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      secure: isProd(),
    })

    const user = c.get('user')
    if (requested && user) {
      await updateUserLocale(user.id, requested).catch((error) => {
        console.error('[locale] could not persist the profile language', error)
      })
    }

    c.header('Cache-Control', 'private, no-store')
    c.header('Vary', 'Accept-Language, Cookie')
    return c.redirect(localizedTarget(next, locale), 303)
  })
}
