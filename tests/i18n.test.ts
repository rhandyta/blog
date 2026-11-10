import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/server/app'
import {
  LOCALES,
  flattenMessages,
  getTranslator,
  interpolate,
  localeFromAcceptLanguage,
  localizedPath,
  messages,
  parseLocale,
  pluralBaseKey,
  splitLocalePath,
  switchLocalePath,
  translate,
} from '../src/lib/i18n'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../src/lib/i18n/format'
import { safeNextPath } from '../src/server/locale'
import { confirmationEmail } from '../src/lib/email/templates'

const app = createApp()

function cookieFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values =
    headers.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';')[0]).join('; ')
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g)].map((match) => match[1]).sort()
}

describe('translation catalogue', () => {
  const id = flattenMessages(messages.id)
  const en = flattenMessages(messages.en)

  test('both languages define the same keys, modulo plural variants', () => {
    const missingInEnglish = Object.keys(id).filter((key) => !(key in en) && !(pluralBaseKey(key) in en))
    const missingInIndonesian = Object.keys(en).filter((key) => !(key in id) && !(pluralBaseKey(key) in id))
    expect(missingInEnglish).toEqual([])
    expect(missingInIndonesian).toEqual([])
    expect(Object.keys(id).length).toBeGreaterThan(300)
  })

  test('no message is empty or a placeholder', () => {
    for (const [locale, catalogue] of [
      ['id', id],
      ['en', en],
    ] as const) {
      const empty = Object.entries(catalogue).filter(
        ([, value]) => !value.trim() || value.startsWith('[TODO') || value === 'TODO',
      )
      expect({ locale, empty: empty.map(([key]) => key) }).toEqual({ locale, empty: [] })
    }
  })

  test('every interpolation placeholder exists in both languages', () => {
    for (const key of Object.keys(id)) {
      if (!(key in en)) continue
      expect({ key, id: placeholders(id[key]), en: placeholders(en[key]) }).toEqual({
        key,
        id: placeholders(id[key]),
        en: placeholders(en[key]),
      })
    }
  })

  test('English plural forms always have a base key', () => {
    const orphans = Object.keys(en).filter((key) => key.endsWith('_one') && !(`${pluralBaseKey(key)}` in en))
    expect(orphans).toEqual([])
  })

  test('every namespace provides both languages', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(messages[locale]).sort()).toEqual(Object.keys(messages.id).sort())
    }
  })
})

describe('translator', () => {
  test('interpolates variables', () => {
    expect(translate('id', 'listing.pageOf', { page: 2, total: 5 })).toBe('Halaman 2 dari 5')
    expect(translate('en', 'listing.pageOf', { page: 2, total: 5 })).toBe('Page 2 of 5')
  })

  test('leaves unknown placeholders untouched', () => {
    expect(interpolate('Hello {{name}}', {})).toBe('Hello {{name}}')
    expect(interpolate('Hello {{ name }}', { name: 'Rhandyta' })).toBe('Hello Rhandyta')
  })

  test('selects plural forms per language', () => {
    expect(translate('en', 'common.pieceCount', { count: 1 })).toBe('1 piece')
    expect(translate('en', 'common.pieceCount', { count: 4 })).toBe('4 pieces')
    expect(translate('id', 'common.pieceCount', { count: 1 })).toBe('1 tulisan')
    expect(translate('id', 'common.pieceCount', { count: 4 })).toBe('4 tulisan')
    expect(translate('en', 'common.sectionCount', { count: 1 })).toBe('1 section')
    expect(translate('en', 'saved.meta', { count: 1 })).toBe('1 saved article')
    expect(translate('en', 'saved.meta', { count: 3 })).toBe('3 saved articles')
  })

  test('falls back to Indonesian and then to the key', () => {
    // A key that only exists in the default catalogue still resolves for `en`.
    expect(translate('en', 'nonexistent.key')).toBe('nonexistent.key')
    expect(getTranslator('en')('nav.language')).toBe('Choose language')
  })

  test('refuses prototype traversal keys', () => {
    expect(translate('en', '__proto__.polluted')).toBe('__proto__.polluted')
    expect(translate('en', 'constructor.prototype')).toBe('constructor.prototype')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  test('translators are independent per locale', () => {
    const id = getTranslator('id')
    const en = getTranslator('en')
    expect(id('nav.articles')).toBe('Artikel')
    expect(en('nav.articles')).toBe('Articles')
    expect(id('nav.articles')).toBe('Artikel')
  })
})

describe('locale primitives', () => {
  test('parses supported tags and legacy Indonesian code', () => {
    expect(parseLocale('id')).toBe('id')
    expect(parseLocale('id-ID')).toBe('id')
    expect(parseLocale('in')).toBe('id')
    expect(parseLocale('EN')).toBe('en')
    expect(parseLocale('en-US')).toBe('en')
    expect(parseLocale('fr')).toBeNull()
    expect(parseLocale('')).toBeNull()
    expect(parseLocale(undefined)).toBeNull()
  })

  test('honours Accept-Language order and quality values', () => {
    expect(localeFromAcceptLanguage('en-US,en;q=0.9,id;q=0.8')).toBe('en')
    expect(localeFromAcceptLanguage('id-ID,id;q=0.9,en;q=0.8')).toBe('id')
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,id;q=0.5')).toBe('id')
    expect(localeFromAcceptLanguage('de;q=0.9,en;q=0.95')).toBe('en')
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9')).toBeNull()
    expect(localeFromAcceptLanguage(null)).toBeNull()
  })

  test('builds and strips locale paths', () => {
    expect(localizedPath('en', '/')).toBe('/en')
    expect(localizedPath('id', '/about')).toBe('/id/about')
    expect(localizedPath('en', 'https://example.com/x')).toBe('https://example.com/x')
    expect(splitLocalePath('/en/articles')).toEqual({ locale: 'en', path: '/articles' })
    expect(splitLocalePath('/id')).toEqual({ locale: 'id', path: '/' })
    expect(splitLocalePath('/articles')).toEqual({ locale: null, path: '/articles' })
    expect(splitLocalePath('/admin/articles')).toEqual({ locale: null, path: '/admin/articles' })
    expect(switchLocalePath('/en/articles?page=2', 'id')).toBe('/id/articles?page=2')
    expect(switchLocalePath('/articles', 'en')).toBe('/en/articles')
  })

  test('safeNextPath rejects off-site redirects', () => {
    expect(safeNextPath('/articles')).toBe('/articles')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath('\\\\evil')).toBe('/')
    expect(safeNextPath(null)).toBe('/')
  })
})

describe('localized formatting', () => {
  test('renders dates in each language', () => {
    expect(formatDate('id', '2026-01-15', 'long')).toBe('15 Januari 2026')
    expect(formatDate('en', '2026-01-15', 'long')).toBe('January 15, 2026')
    expect(formatDate('en', '2026-01-15', 'month')).toBe('January 2026')
    expect(formatDate('id', '2026-01-15', 'short')).toContain('Jan')
  })

  test('handles invalid and empty dates safely', () => {
    expect(formatDate('id', null)).toBe('')
    expect(formatDate('en', '')).toBe('')
    expect(formatDate('en', 'not-a-date')).toBe('')
    expect(formatDate('en', new Date('invalid'))).toBe('')
  })

  test('formats numbers, currency and percentages', () => {
    expect(formatNumber('id', 1234567)).toBe('1.234.567')
    expect(formatNumber('en', 1234567)).toBe('1,234,567')
    expect(formatNumber('en', null)).toBe('')
    expect(formatNumber('en', Number.NaN)).toBe('')
    expect(formatCurrency('id', 1500000, 'IDR')).toContain('Rp')
    expect(formatCurrency('en', 12.5, 'USD')).toContain('$')
    expect(formatPercent('en', 0.256)).toBe('25.6%')
  })
})

describe('localized routing', () => {
  test('serves the Indonesian page by default with alternates', async () => {
    const response = await app.request('/id')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-language')).toBe('id')
    const html = await response.text()
    expect(html).toContain('<html lang="id">')
    expect(html).toContain('href="http://localhost:3000/id"')
    expect(html).toContain('hreflang="en" href="http://localhost:3000/en"')
    expect(html).toContain('hreflang="x-default" href="http://localhost:3000/id"')
    expect(html).toContain('property="og:locale" content="id_ID"')
    expect(html).toContain('>Artikel<')
  })

  test('serves the English page with English copy and prefixed links', async () => {
    const response = await app.request('/en')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-language')).toBe('en')
    const html = await response.text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('>Articles<')
    expect(html).toContain('href="/en/articles"')
    expect(html).toContain('property="og:locale" content="en_US"')
    expect(html).toContain('hreflang="id" href="http://localhost:3000/id"')
  })

  test('redirects legacy paths to the negotiated language', async () => {
    const plain = await app.request('/')
    expect(plain.status).toBe(302)
    expect(plain.headers.get('location')).toBe('/id')
    expect(plain.headers.get('vary')).toContain('Accept-Language')

    const english = await app.request('/', { headers: { 'accept-language': 'en-US,en;q=0.9' } })
    expect(english.headers.get('location')).toBe('/en')

    const cookie = await app.request('/', { headers: { cookie: 'lang=en' } })
    expect(cookie.headers.get('location')).toBe('/en')

    const withQuery = await app.request('/search?q=notebook')
    expect(withQuery.headers.get('location')).toBe('/id/search?q=notebook')

    const invalidCookie = await app.request('/', { headers: { cookie: 'lang=xx' } })
    expect(invalidCookie.headers.get('location')).toBe('/id')
  })

  test('unknown locale prefixes fall back to a localized 404', async () => {
    const response = await app.request('/fr/articles')
    expect(response.status).toBe(404)
    const html = await response.text()
    expect(html).toContain('noindex')
    expect(html).toContain('<html lang="id">')
  })

  test('language switch persists a cookie and preserves the page', async () => {
    const response = await app.request('/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ locale: 'en', next: '/articles?page=2' }).toString(),
    })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/en/articles?page=2')
    expect(response.headers.get('set-cookie')).toContain('lang=en')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
  })

  test('rejects unsupported languages and open redirects', async () => {
    const invalid = await app.request('/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'lang=id' },
      body: new URLSearchParams({ locale: 'fr', next: '/' }).toString(),
    })
    expect(invalid.status).toBe(303)
    expect(invalid.headers.get('location')).toBe('/id')
    expect(invalid.headers.get('set-cookie') ?? '').not.toContain('lang=fr')

    const offsite = await app.request('/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'lang=id' },
      body: new URLSearchParams({ locale: 'en', next: '//evil.example/path' }).toString(),
    })
    // A rejected target falls back to the home page in the requested language.
    expect(offsite.headers.get('location')).toBe('/en')
  })

  test('the language switcher is accessible and marks the active language', async () => {
    const html = await (await app.request('/en')).text()
    expect(html).toContain('action="/locale"')
    expect(html).toContain('name="locale"')
    expect(html).toContain('value="id"')
    expect(html).toContain('value="en"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Current language: English')
    expect(html).toContain('Switch to Bahasa Indonesia')
  })

  test('admin pages use the negotiated language without a URL prefix', async () => {
    const english = await app.request('/admin/login', { headers: { 'accept-language': 'en-US' } })
    expect(await english.text()).toContain('<html lang="en">')
    const indonesian = await app.request('/admin/login', { headers: { 'accept-language': 'id-ID' } })
    expect(await indonesian.text()).toContain('<html lang="id">')
  })

  test('concurrent requests keep their own language', async () => {
    const requests = Array.from({ length: 12 }, (_, index) =>
      index % 2 === 0 ? app.request('/en/topics') : app.request('/id/topics'),
    )
    const responses = await Promise.all(requests)
    const languages = await Promise.all(
      responses.map(async (response) => {
        const html = await response.text()
        return /<html lang="(\w+)">/.exec(html)?.[1]
      }),
    )
    expect(languages).toEqual(Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 'en' : 'id')))
  })
})

describe('localized API responses', () => {
  test('subscribe errors follow the requested language', async () => {
    const english = await app.request('/api/subscribe?lang=en', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })
    expect(english.status).toBe(400)
    expect(english.headers.get('content-language')).toBe('en')
    const englishJson = (await english.json()) as { status: string; message: string }
    expect(englishJson.status).toBe('invalid')
    expect(englishJson.message).toBe('That email address does not look right. Please check it and try again.')

    const indonesian = await app.request('/api/subscribe?lang=id', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })
    expect(indonesian.status).toBe(400)
    const indonesianJson = (await indonesian.json()) as { status: string; message: string }
    expect(indonesianJson.message).toBe('Alamat surel itu sepertinya tidak tepat. Mohon diperiksa dan coba lagi.')
  })

  test('rate-limited search answers in the request language', async () => {
    const response = await app.request('/api/search?q=zzzznothing&lang=en')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-language')).toBe('en')
  })
})

describe('localized email templates', () => {
  test('confirmation email follows the subscriber language', () => {
    const english = confirmationEmail({
      siteTitle: 'RhandytaVERSE',
      origin: 'http://localhost:3000',
      token: 'abc123',
      locale: 'en',
    })
    expect(english.subject).toContain('Confirm')
    expect(english.html).toContain('<html lang="en">')
    expect(english.html).toContain('/en/confirm?token=abc123')
    expect(english.text).toContain('http://localhost:3000/en/confirm')

    const indonesian = confirmationEmail({
      siteTitle: 'RhandytaVERSE',
      origin: 'http://localhost:3000',
      token: 'abc123',
      locale: 'id',
    })
    expect(indonesian.subject).toContain('Konfirmasi')
    expect(indonesian.html).toContain('/id/confirm?token=abc123')
  })
})

describe('seo metadata', () => {
  test('sitemap lists both languages with xhtml alternates', async () => {
    const xml = await (await app.request('/sitemap.xml')).text()
    expect(xml).toContain('<urlset')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain('http://localhost:3000/id/articles/test-published')
    expect(xml).toContain('http://localhost:3000/en/articles/test-published')
    expect(xml).toContain('hreflang="x-default"')
  })

  test('topic pages expose their language alternate', async () => {
    const html = await (await app.request('/en/topics')).text()
    expect(html).toContain('rel="canonical" href="http://localhost:3000/en/topics"')
    expect(html).toContain('hreflang="id" href="http://localhost:3000/id/topics"')
    expect(html).toContain('<html lang="en">')
  })
})
