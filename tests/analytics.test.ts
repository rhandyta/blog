import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createApp } from '../src/server/app'
import { resetRateLimits } from '../src/lib/auth/rate-limit'
import { createArticle, deleteArticle, getArticleAudienceMap, recordArticleView } from '../src/lib/db/queries/articles'
import { getAnalyticsOverview, getDigestArticles } from '../src/lib/db/queries/analytics'
import {
  anonymizeIp,
  hashVisitor,
  normalizeCountry,
  normalizeReferrer,
  parseUserAgent,
} from '../src/lib/analytics/visitor'

const app = createApp()
const articleId = 'art_analytics_test'

function cookieFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values =
    headers.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';')[0]).join('; ')
}

async function login(): Promise<string> {
  await resetRateLimits()
  const get = await app.request('/admin/login')
  const html = await get.text()
  const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
  const response = await app.request('/admin/login', {
    method: 'POST',
    headers: { cookie: cookieFrom(get), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: 'test@example.com',
      password: 'test-password-123',
      _csrf: csrf,
    }).toString(),
  })
  expect(response.status).toBe(303)
  return cookieFrom(response)
}

describe('visitor privacy helpers', () => {
  test('anonymises IPv4 and IPv6 addresses before hashing', () => {
    expect(anonymizeIp('203.0.113.42')).toBe('203.0.113.0')
    expect(anonymizeIp('2001:db8:abcd:12:3456:7890:abcd:ef01')).toBe('2001:db8:abcd:12::')
    expect(anonymizeIp('::ffff:198.51.100.7')).toBe('198.51.100.0')
  })

  test('builds a deterministic, salted visitor hash without raw identifiers', () => {
    const first = hashVisitor('203.0.113.42', 'Mozilla/5.0 Chrome/120')
    const second = hashVisitor('203.0.113.42', 'Mozilla/5.0 Chrome/120')
    const other = hashVisitor('203.0.113.42', 'Mozilla/5.0 Firefox/120')
    expect(first).toBe(second)
    expect(first).not.toBe(other)
    expect(first).toHaveLength(32)
    expect(first).not.toContain('203.0.113')
  })

  test('classifies devices, browsers and operating systems coarsely', () => {
    expect(
      parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'),
    ).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' })
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' })
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ device: 'tablet', browser: 'Safari', os: 'iOS' })
  })

  test('keeps only an external referrer host and a valid country code', () => {
    expect(normalizeReferrer('https://www.example.com/posts/1?email=secret', 'https://lab-rb.my.id')).toBe(
      'example.com',
    )
    expect(normalizeReferrer('https://lab-rb.my.id/articles/one', 'https://lab-rb.my.id')).toBeNull()
    expect(normalizeReferrer('not a url', 'https://lab-rb.my.id')).toBeNull()
    expect(normalizeCountry('id')).toBe('ID')
    expect(normalizeCountry('Indonesia')).toBeNull()
  })
})

describe('article analytics', () => {
  beforeAll(async () => {
    await createArticle({
      id: articleId,
      slug: 'analytics-test',
      title: 'Analytics test article',
      subtitle: null,
      excerpt: 'A fixture for analytics tests.',
      bodyJson: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Analytics fixture body.' }] }],
      }),
      bodyText: 'Analytics fixture body.',
      readingMinutes: 1,
      status: 'published',
      authorId: 'author_test',
      categoryId: 'cat_test',
      featuredMediaId: null,
      featuredCaption: null,
      isFeatured: false,
      featuredRank: null,
      isEditorsPick: false,
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: null,
      ogMediaId: null,
      noIndex: false,
      isDemo: false,
      publishedAt: new Date().toISOString(),
      scheduledFor: null,
      tagIds: [],
    })
  })

  test('deduplicates hourly views and counts unique readers', async () => {
    const base = {
      articleId,
      visitorHash: 'visitor-a',
      day: new Date().toISOString().slice(0, 10),
      bucket: '2026-11-06T10',
      referrerHost: 'example.com',
      country: 'ID',
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
    }
    expect(await recordArticleView(base)).toBe(true)
    expect(await recordArticleView(base)).toBe(false)
    expect(await recordArticleView({ ...base, bucket: '2026-11-06T11' })).toBe(true)
    expect(await recordArticleView({ ...base, visitorHash: 'visitor-b', bucket: '2026-11-06T10' })).toBe(true)

    const audience = await getArticleAudienceMap([articleId])
    expect(audience.get(articleId)).toEqual({ views: 3, readers: 2 })
  })

  test('includes the fixture in aggregate analytics', async () => {
    const overview = await getAnalyticsOverview()
    expect(overview.readers).toBeGreaterThanOrEqual(2)
    expect(overview.views).toBeGreaterThanOrEqual(3)
  })

  test('selects trending articles for the digest', async () => {
    const items = await getDigestArticles({ days: 7, limit: 5, metric: 'readers' })
    expect(items.some((item) => item.id === articleId)).toBe(true)
  })
})

describe('admin analytics', () => {
  beforeAll(async () => {
    await resetRateLimits()
  })

  test('requires a session', async () => {
    const response = await app.request('/admin/analytics', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  test('renders the audience page and per-article counters for editors', async () => {
    const cookie = await login()
    const audience = await app.request('/admin/analytics', { headers: { cookie, 'accept-language': 'en-US' } })
    expect(audience.status).toBe(200)
    const audienceHtml = await audience.text()
    expect(audienceHtml).toContain('Audience')
    expect(audienceHtml).toContain('How this is measured')
    expect(audienceHtml).toContain('never exposed on the public site')
    expect(audienceHtml).toContain('Analytics test article')
    expect(audienceHtml).toContain('example.com')
    expect(audienceHtml).toContain('Indonesia')
    expect(audienceHtml).toContain('Mobile')

    const articles = await app.request('/admin/articles', { headers: { cookie, 'accept-language': 'en-US' } })
    expect(articles.status).toBe(200)
    const articlesHtml = await articles.text()
    expect(articlesHtml).toContain('<th class="num">Readers</th>')
    expect(articlesHtml).toContain('<th class="num">Views</th>')

    const newsletter = await app.request('/admin/newsletter', { headers: { cookie, 'accept-language': 'en-US' } })
    expect(newsletter.status).toBe(200)
    const newsletterHtml = await newsletter.text()
    expect(newsletterHtml).toContain('Newsletter')
    expect(newsletterHtml).toContain('Compose')

    const subscribers = await app.request('/admin/subscribers', { headers: { cookie, 'accept-language': 'en-US' } })
    expect(subscribers.status).toBe(200)
    expect(await subscribers.text()).toContain('Pending confirmation')

    const audit = await app.request('/admin/audit', { headers: { cookie, 'accept-language': 'en-US' } })
    expect(audit.status).toBe(200)
    const auditHtml = await audit.text()
    expect(auditHtml).toContain('Audit log')
    expect(auditHtml).toContain('auth.login')
  })
})

afterAll(async () => {
  await deleteArticle(articleId)
})
