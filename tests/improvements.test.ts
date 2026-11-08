import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { createApp } from '../src/server/app'
import { resetConfigCache } from '../src/lib/config'
import { resetRateLimits } from '../src/lib/auth/rate-limit'
import { getDb } from '../src/lib/db/client'
import { authors, media as mediaTable, settings as settingsTable, users as usersTable } from '../src/lib/db/schema'
import { getArticleAnalytics } from '../src/lib/db/queries/analytics'
import { createPreviewToken } from '../src/lib/seo/preview-token'
import {
  AUTOMATION_CACHE_TTL_MS,
  getAutomationSettings,
  invalidateAutomationSettings,
  saveAutomationSettings,
} from '../src/lib/db/queries/automation'
import {
  SETTINGS_CACHE_TTL_MS,
  defaultSettings,
  getSiteSettings,
  invalidateSettingsCache,
  saveSiteSettings,
} from '../src/lib/db/queries/taxonomy'

const app = createApp()

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
)

function cookieFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values =
    headers.getSetCookie?.() ??
    (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';')[0]).join('; ')
}

async function loginAs(
  email = 'test@example.com',
  password = 'test-password-123',
): Promise<{ cookie: string; csrfToken: string }> {
  await resetRateLimits()
  const get = await app.request('/admin/login')
  const html = await get.text()
  const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
  const loginCookie = cookieFrom(get)
  const response = await app.request('/admin/login', {
    method: 'POST',
    headers: { cookie: loginCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password, _csrf: csrf }).toString(),
  })
  expect(response.status).toBe(303)
  const cookie = cookieFrom(response)
  const session = await app.request('/api/admin/session', { headers: { cookie } })
  expect(session.status).toBe(200)
  const json = (await session.json()) as { csrfToken: string }
  return { cookie, csrfToken: json.csrfToken }
}

function cspDirectives(header: string | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf(' ')
    if (idx === -1) map.set(trimmed, '')
    else map.set(trimmed.slice(0, idx), trimmed.slice(idx + 1))
  }
  return map
}

beforeAll(async () => {
  await resetRateLimits()
})

describe('poin 1: GTM, strict production CSP, and privacy alignment', () => {
  test('public routes load GTM via external /analytics.js and static script is served', async () => {
    const asset = await app.request('/analytics.js')
    expect(asset.status).toBe(200)
    expect(await asset.text()).toContain('window.dataLayer')

    for (const path of ['/', '/articles/test-published', '/about', '/privacy']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain('<script src="/analytics.js"></script>')
      expect(html).toContain('https://www.googletagmanager.com/gtm.js?id=GTM-NSRP398Z')
      expect(html).toContain('https://www.googletagmanager.com/gtm.js?id=GTM-TW77C5JM')
      expect(html).not.toContain("gtag('js', new Date())")
    }
  })

  test('admin and preview pages omit GTM and /analytics.js', async () => {
    const { cookie } = await loginAs()
    const previewToken = createPreviewToken('art_test_draft')
    const isolatedPaths = [
      { path: '/admin/login', headers: {} as Record<string, string> },
      { path: '/admin', headers: { cookie } },
      { path: '/admin/account', headers: { cookie } },
      { path: `/preview/art_test_draft?token=${encodeURIComponent(previewToken)}`, headers: {} as Record<string, string> },
    ]
    for (const item of isolatedPaths) {
      const response = await app.request(item.path, { headers: item.headers })
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).not.toContain('/analytics.js')
      expect(html).not.toContain('googletagmanager.com')
      expect(html).not.toContain('GTM-NSRP398Z')
      expect(html).not.toContain('GTM-TW77C5JM')
    }
  })

  test('production CSP drops unsafe-inline from script-src and scopes GTM away from admin/preview', async () => {
    const { cookie } = await loginAs()
    const previewToken = createPreviewToken('art_test_draft')
    const previousNodeEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'
      resetConfigCache()

      const pub = await app.request('/')
      const pubCsp = cspDirectives(pub.headers.get('content-security-policy'))
      const pubScript = pubCsp.get('script-src') ?? ''
      expect(pubScript).toContain("'self'")
      expect(pubScript).toContain('https://www.googletagmanager.com')
      expect(pubScript).not.toContain("'unsafe-inline'")

      for (const path of [
        '/admin/login',
        '/admin',
        `/preview/art_test_draft?token=${encodeURIComponent(previewToken)}`,
      ]) {
        const res = await app.request(path, path === '/admin' ? { headers: { cookie } } : undefined)
        const csp = cspDirectives(res.headers.get('content-security-policy'))
        const scriptSrc = csp.get('script-src') ?? ''
        expect(scriptSrc).toBe("'self'")
        expect(csp.get('connect-src')).toBe("'self'")
      }
    } finally {
      process.env.NODE_ENV = previousNodeEnv
      resetConfigCache()
    }
  })

  test('privacy and about pages accurately disclose GTM alongside internal analytics', async () => {
    const privacyHtml = await (await app.request('/privacy')).text()
    expect(privacyHtml).toContain('Google Tag Manager')
    expect(privacyHtml).toContain('googletagmanager.com')
    expect(privacyHtml).toContain('tanpa cookie analitik internal')

    const aboutHtml = await (await app.request('/about')).text()
    expect(aboutHtml).toContain('Google Tag Manager')
    expect(aboutHtml).toContain('tanpa cookie analitik')
  })
})

describe('poin 2: caching, TTL invalidation, and non-blocking views', () => {
  test('settings and automation caches expose 30s TTL and refresh on invalidation', async () => {
    expect(SETTINGS_CACHE_TTL_MS).toBe(30_000)
    expect(AUTOMATION_CACHE_TTL_MS).toBe(30_000)

    const originalSite = await getSiteSettings()
    const originalAuto = await getAutomationSettings()
    try {
      await saveSiteSettings({ ...originalSite, issue: 'No. 77' })
      expect((await getSiteSettings()).issue).toBe('No. 77')

      // Direct DB edit stays cached until TTL or explicit invalidation.
      await getDb()
        .update(settingsTable)
        .set({ value: JSON.stringify({ ...originalSite, issue: 'No. 88' }) })
        .where(eq(settingsTable.key, 'site'))
      expect((await getSiteSettings()).issue).toBe('No. 77')

      invalidateSettingsCache()
      expect((await getSiteSettings()).issue).toBe('No. 88')

      await saveAutomationSettings({ initiativeBrief: 'Brief A' })
      expect((await getAutomationSettings()).initiativeBrief).toBe('Brief A')
      await getDb()
        .update(settingsTable)
        .set({ value: JSON.stringify({ ...originalAuto, initiativeBrief: 'Brief B' }) })
        .where(eq(settingsTable.key, 'automation'))
      expect((await getAutomationSettings()).initiativeBrief).toBe('Brief A')

      invalidateAutomationSettings()
      expect((await getAutomationSettings()).initiativeBrief).toBe('Brief B')
    } finally {
      await saveSiteSettings({ ...defaultSettings, ...originalSite })
      await saveAutomationSettings(originalAuto)
    }
  })

  test('Cache-Control headers distinguish cacheable public HTML, search/404, and private/auth pages', async () => {
    const { cookie } = await loginAs()
    const previewToken = createPreviewToken('art_test_draft')

    for (const path of ['/', '/articles', '/articles/test-published', '/about', '/privacy', '/terms', '/topics', '/archive']) {
      const res = await app.request(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe(
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      )
    }

    for (const path of ['/search?q=notebook', '/saved', '/does-not-exist-anywhere']) {
      const res = await app.request(path)
      expect(res.headers.get('cache-control')).toBe('no-cache')
    }

    for (const path of ['/admin/login', '/subscribe', `/preview/art_test_draft?token=${encodeURIComponent(previewToken)}`]) {
      const res = await app.request(path)
      expect(res.headers.get('cache-control')).toBe('private, no-store')
    }

    for (const path of ['/', '/admin', '/admin/account']) {
      const res = await app.request(path, { headers: { cookie } })
      expect(res.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  test('anonymous article view still increments article analytics', async () => {
    const before = (await getArticleAnalytics('art_test_published', 30))?.lifetimeViews ?? 0
    const res = await app.request('/articles/test-published', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/130.0',
        'x-forwarded-for': '203.0.113.42',
      },
    })
    expect(res.status).toBe(200)
    const after = (await getArticleAnalytics('art_test_published', 30))?.lifetimeViews ?? 0
    expect(after).toBeGreaterThanOrEqual(before + 1)
  })
})

describe('poin 3: user management, account security, media ownership RBAC, and localization', () => {
  const createdUserEmails = ['author-poin3@example.com', 'blocked-author@example.com']
  const uploadedMediaIds: string[] = []

  afterAll(async () => {
    for (const id of uploadedMediaIds) {
      await getDb().delete(mediaTable).where(eq(mediaTable.id, id))
    }
    for (const email of createdUserEmails) {
      const [u] = await getDb().select().from(usersTable).where(eq(usersTable.email, email)).limit(1)
      if (u) {
        await getDb().delete(authors).where(eq(authors.userId, u.id))
        await getDb().delete(usersTable).where(eq(usersTable.id, u.id))
      }
    }
  })

  test('admin creates user with author profile, manages account/sessions, and enforces safety guards', async () => {
    const admin = await loginAs()

    // Admin creates a new Author user with auto-created linked author profile
    const createRes = await app.request('/admin/users', {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: admin.csrfToken,
        name: 'Author Poin Tiga',
        email: 'author-poin3@example.com',
        password: 'author-password-1',
        role: 'author',
        createAuthor: 'on',
      }).toString(),
    })
    expect(createRes.status).toBe(303)
    expect(createRes.headers.get('location')).toBe('/admin/users?flash=user-created')

    const [createdUser] = await getDb()
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, 'author-poin3@example.com'))
      .limit(1)
    expect(createdUser).toBeDefined()
    expect(createdUser!.role).toBe('author')

    const [linkedAuthor] = await getDb()
      .select()
      .from(authors)
      .where(eq(authors.userId, createdUser!.id))
      .limit(1)
    expect(linkedAuthor).toBeDefined()
    expect(linkedAuthor!.displayName).toBe('Author Poin Tiga')

    // Self-lockout guard & last-admin guard on admin's own account
    const selfLockout = await app.request(`/admin/users/${'user_test'}`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: admin.csrfToken,
        name: 'Test Editor',
        email: 'test@example.com',
        role: 'author',
        active: 'on',
      }).toString(),
    })
    expect(selfLockout.status).toBe(303)
    expect(selfLockout.headers.get('location')).toContain('flash=error-self-lockout')

    // Log in as author and verify RBAC in UI + routes
    const authorSession1 = await loginAs('author-poin3@example.com', 'author-password-1')
    const authorSession2 = await loginAs('author-poin3@example.com', 'author-password-1')

    const authorDashHtml = await (
      await app.request('/admin', { headers: { cookie: authorSession1.cookie } })
    ).text()
    expect(authorDashHtml).not.toContain('/admin/automation')
    expect(authorDashHtml).not.toContain('/admin/users')
    expect(authorDashHtml).toContain('/admin/account')

    // Author blocked from admin-only user management routes & automation
    const usersGetAsAuthor = await app.request('/admin/users', { headers: { cookie: authorSession1.cookie } })
    expect(usersGetAsAuthor.status).toBe(303)
    const usersPostAsAuthor = await app.request('/admin/users', {
      method: 'POST',
      headers: { cookie: authorSession1.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: authorSession1.csrfToken,
        name: 'Blocked User',
        email: 'blocked-author@example.com',
        password: 'password-1234',
        role: 'admin',
      }).toString(),
    })
    expect(usersPostAsAuthor.status).toBe(303)
    const [shouldNotExist] = await getDb()
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, 'blocked-author@example.com'))
      .limit(1)
    expect(shouldNotExist).toBeUndefined()

    // Author can access /admin/account, update profile, change password (rejecting wrong currentPassword), and keep current session while revoking others
    const accountPage = await app.request('/admin/account', { headers: { cookie: authorSession1.cookie } })
    expect(accountPage.status).toBe(200)
    const accountHtml = await accountPage.text()
    expect(accountHtml).toContain('Author Poin Tiga')
    expect(accountHtml).toMatch(/Active sessions \(.*2.*\)/)

    const profileRes = await app.request('/admin/account/profile', {
      method: 'POST',
      headers: { cookie: authorSession1.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: authorSession1.csrfToken,
        name: 'Author Poin Baru',
      }).toString(),
    })
    expect(profileRes.status).toBe(303)
    expect(profileRes.headers.get('location')).toBe('/admin/account?flash=profile-saved')

    const wrongPwdRes = await app.request('/admin/account/password', {
      method: 'POST',
      headers: { cookie: authorSession1.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: authorSession1.csrfToken,
        currentPassword: 'wrong-password',
        newPassword: 'author-password-2',
        confirmPassword: 'author-password-2',
      }).toString(),
    })
    expect(wrongPwdRes.headers.get('location')).toBe('/admin/account?flash=error-current-password')

    const changePwdRes = await app.request('/admin/account/password', {
      method: 'POST',
      headers: { cookie: authorSession1.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: authorSession1.csrfToken,
        currentPassword: 'author-password-1',
        newPassword: 'author-password-2',
        confirmPassword: 'author-password-2',
        revokeOthers: 'on',
      }).toString(),
    })
    expect(changePwdRes.headers.get('location')).toBe('/admin/account?flash=password-changed')

    // Session 1 remains valid; Session 2 was revoked
    expect(
      (await app.request('/admin/account', { headers: { cookie: authorSession1.cookie }, redirect: 'manual' })).status,
    ).toBe(200)
    expect(
      (await app.request('/admin/account', { headers: { cookie: authorSession2.cookie }, redirect: 'manual' })).status,
    ).toBe(302)

    // New password works, admin reset password revokes authorSession1
    const resetByAdmin = await app.request(`/admin/users/${createdUser!.id}/password`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: admin.csrfToken,
        newPassword: 'author-password-3',
        confirmPassword: 'author-password-3',
      }).toString(),
    })
    expect(resetByAdmin.headers.get('location')).toContain('flash=password-changed')
    expect(
      (await app.request('/admin/account', { headers: { cookie: authorSession1.cookie }, redirect: 'manual' })).status,
    ).toBe(302)

    // Media ownership RBAC: admin uploads M1, author uploads M2
    const upload = async (who: { cookie: string; csrfToken: string }, filename: string) => {
      const form = new FormData()
      form.append('file', new File([ONE_PIXEL_PNG], filename, { type: 'image/png' }))
      const res = await app.request('/api/admin/media', {
        method: 'POST',
        headers: { cookie: who.cookie, 'x-csrf-token': who.csrfToken },
        body: form,
      })
      expect(res.status).toBe(201)
      return ((await res.json()) as { media: { id: string; canEdit?: boolean } }).media
    }

    const authorFresh = await loginAs('author-poin3@example.com', 'author-password-3')
    const adminMedia = await upload(admin, 'admin-only.png')
    const authorMedia = await upload(authorFresh, 'author-own.png')
    uploadedMediaIds.push(adminMedia.id, authorMedia.id)

    // Author sees canEdit=true on own media, canEdit=false on admin media (both API & SSR props)
    const mediaPageHtml = await (await app.request('/admin/media', { headers: { cookie: authorFresh.cookie } })).text()
    expect(mediaPageHtml).toContain(`"id":"${authorMedia.id}"`)
    expect(mediaPageHtml).toContain('"canEdit":false')
    expect(mediaPageHtml).toContain('"canEdit":true')

    const mediaListRes = await app.request('/api/admin/media', { headers: { cookie: authorFresh.cookie } })
    const mediaListJson = (await mediaListRes.json()) as { media: Array<{ id: string; canEdit: boolean }> }
    expect(mediaListJson.media.find((m) => m.id === authorMedia.id)?.canEdit).toBe(true)
    expect(mediaListJson.media.find((m) => m.id === adminMedia.id)?.canEdit).toBe(false)

    // Author CANNOT patch or delete admin's media
    expect(
      (
        await app.request(`/api/admin/media/${adminMedia.id}`, {
          method: 'PATCH',
          headers: {
            cookie: authorFresh.cookie,
            'content-type': 'application/json',
            'x-csrf-token': authorFresh.csrfToken,
          },
          body: JSON.stringify({ alt: 'Hijacked alt' }),
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await app.request(`/api/admin/media/${adminMedia.id}`, {
          method: 'DELETE',
          headers: { cookie: authorFresh.cookie, 'x-csrf-token': authorFresh.csrfToken },
        })
      ).status,
    ).toBe(403)

    // Author CAN patch & delete own media; admin CAN delete admin's media
    expect(
      (
        await app.request(`/api/admin/media/${authorMedia.id}`, {
          method: 'PATCH',
          headers: {
            cookie: authorFresh.cookie,
            'content-type': 'application/json',
            'x-csrf-token': authorFresh.csrfToken,
          },
          body: JSON.stringify({ alt: 'Updated own alt' }),
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request(`/api/admin/media/${authorMedia.id}`, {
          method: 'DELETE',
          headers: { cookie: authorFresh.cookie, 'x-csrf-token': authorFresh.csrfToken },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request(`/api/admin/media/${adminMedia.id}`, {
          method: 'DELETE',
          headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrfToken },
        })
      ).status,
    ).toBe(200)

    // Admin deactivates the user -> existing session is immediately terminated
    const deactivateRes = await app.request(`/admin/users/${createdUser!.id}`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: admin.csrfToken,
        name: 'Author Poin Baru',
        email: 'author-poin3@example.com',
        role: 'author',
        authorId: linkedAuthor!.id,
      }).toString(),
    })
    expect(deactivateRes.headers.get('location')).toContain('flash=user-saved')
    expect(
      (await app.request('/admin/account', { headers: { cookie: authorFresh.cookie }, redirect: 'manual' })).status,
    ).toBe(302)
  })

  test('visitor-facing UI remnants are localized cleanly in Indonesian', async () => {
    const articleHtml = await (await app.request('/articles/test-published')).text()
    expect(articleHtml).toContain('>Beranda</a>')
    expect(articleHtml).toContain('"name":"Beranda"')
    expect(articleHtml).toContain('— beranda"')

    const tagHtml = await (await app.request('/tags/test-tag')).text()
    expect(tagHtml).toContain('<title>Bertanda “Test Tag” — RhandytaVERSE</title>')
  })
})
