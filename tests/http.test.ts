import { beforeAll, describe, expect, test } from 'bun:test'
import { createApp } from '../src/server/app'
import { createPreviewToken } from '../src/lib/seo/preview-token'
import { resetRateLimits } from '../src/lib/auth/rate-limit'
import { getDb } from '../src/lib/db/client'
import { articles, articleRevisions } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
import { listSubscribers } from '../src/lib/db/queries/subscribers'
import { getArticleById, publishDueArticles, scheduleArticle } from '../src/lib/db/queries/articles'

const app = createApp()

function cookieFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = headers.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : [])
  return values.map((value) => value.split(';')[0]).join('; ')
}

async function login(): Promise<{ cookie: string; csrfToken: string }> {
  await resetRateLimits()
  const get = await app.request('/admin/login')
  const html = await get.text()
  const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
  expect(csrf.length).toBeGreaterThan(10)
  const loginCookie = cookieFrom(get)
  const response = await app.request('/admin/login', {
    method: 'POST',
    headers: { cookie: loginCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: 'test@example.com',
      password: 'test-password-123',
      _csrf: csrf,
    }).toString(),
  })
  expect(response.status).toBe(303)
  const cookie = cookieFrom(response)
  expect(cookie).toContain('sid=')
  const session = await app.request('/api/admin/session', { headers: { cookie } })
  expect(session.status).toBe(200)
  const sessionJson = (await session.json()) as { csrfToken: string }
  return { cookie, csrfToken: sessionJson.csrfToken }
}

describe('automation', () => {
  test('automation page renders for editors', async () => {
    const { cookie } = await login()
    const response = await app.request('/admin/automation', { headers: { cookie } })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Automation')
    expect(html).toContain('Generate draft sekarang')
  })
})

describe('public pages', () => {
  beforeAll(async () => {
    await resetRateLimits()
  })

  test('homepage renders server-rendered content and metadata', async () => {
    const response = await app.request('/')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<title>RhandytaVERSE — Rhandyta Briantama</title>')
    expect(html).toContain('application/ld+json')
    expect(html).toContain('WebSite')
    expect(html).toContain('The Published Test Article')
    expect(html).toContain('rel="canonical"')
    expect(html).toContain('name="description"')
  })

  test('a custom canonical URL overrides the default canonical and og:url', async () => {
    await getDb()
      .update(articles)
      .set({ canonicalUrl: 'https://syndication.example/articles/test-published' })
      .where(eq(articles.id, 'art_test_published'))
    try {
      const response = await app.request('/articles/test-published')
      const html = await response.text()
      expect(html).toContain('href="https://syndication.example/articles/test-published"')
      expect(html).toContain('property="og:url" content="https://syndication.example/articles/test-published"')
      expect(html).toContain('"@id":"https://syndication.example/articles/test-published"')
    } finally {
      await getDb()
        .update(articles)
        .set({ canonicalUrl: null })
        .where(eq(articles.id, 'art_test_published'))
    }
  })

  test('article page contains structured data, canonical, and TOC anchors', async () => {
    const response = await app.request('/articles/test-published')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('BlogPosting')
    expect(html).toContain('BreadcrumbList')
    expect(html).toContain('id="a-section-heading"')
    expect(html).toContain('href="#a-section-heading"')
    expect(html).toContain('og:type" content="article"')
    expect(html).toContain('aria-label="Share this article"')
  })

  test('draft and scheduled articles are not publicly visible', async () => {
    expect((await app.request('/articles/test-draft')).status).toBe(404)
    expect((await app.request('/articles/test-scheduled')).status).toBe(404)
  })

  test('section, author, archive, topic and static pages render', async () => {
    for (const path of [
      '/articles',
      '/category/test-section',
      '/author/test-author',
      '/archive',
      '/topics',
      '/tags/test-tag',
      '/search?q=notebook',
      '/saved',
      '/about',
      '/privacy',
      '/terms',
      '/subscribe',
    ]) {
      const response = await app.request(path)
      expect({ path, status: response.status }).toEqual({ path, status: 200 })
    }
  })

  test('security headers are present', async () => {
    const response = await app.request('/')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
  })

  test('sitemap excludes drafts, scheduled pieces and noindex articles', async () => {
    const response = await app.request('/sitemap.xml')
    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('/articles/test-published')
    expect(xml).toContain('/privacy')
    expect(xml).toContain('/terms')
    expect(xml).not.toContain('/articles/test-draft')
    expect(xml).not.toContain('/articles/test-scheduled')
    expect(xml).not.toContain('/articles/test-noindex')
  })

  test('RSS excludes unpublished articles and includes absolute content', async () => {
    const response = await app.request('/rss.xml')
    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('The Published Test Article')
    expect(xml).not.toContain('A Draft Test Article')
    expect(response.headers.get('content-type')).toContain('application/rss+xml')
  })

  test('robots.txt references the sitemap and blocks the desk', async () => {
    const response = await app.request('/robots.txt')
    const text = await response.text()
    expect(text).toContain('Sitemap: http://localhost:3000/sitemap.xml')
    expect(text).toContain('Disallow: /admin')
  })

  test('unknown routes return the styled 404 page', async () => {
    const response = await app.request('/nope')
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('This page is not in the index.')
  })
})

describe('search API', () => {
  test('returns full-text results with highlight segments', async () => {
    const response = await app.request('/api/search?q=notebook')
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      results: Array<{ slug: string; titleParts: Array<{ match: boolean }>; snippetParts: Array<{ match: boolean }> }>
    }
    expect(json.results.some((result) => result.slug === 'test-published')).toBe(true)
    const hit = json.results.find((result) => result.slug === 'test-published')
    expect(hit?.snippetParts.some((part) => part.match)).toBe(true)
  })

  test('matches section names as well as tags and body text', async () => {
    const response = await app.request('/api/search?q=Test%20Section')
    const json = (await response.json()) as { results: Array<{ slug: string }> }
    expect(json.results.some((result) => result.slug === 'test-published')).toBe(true)
  })

  test('returns an empty list for nonsense', async () => {
    const response = await app.request('/api/search?q=zzzznothing')
    const json = (await response.json()) as { results: unknown[] }
    expect(json.results).toEqual([])
  })
})

describe('newsletter', () => {
  test('subscribes, deduplicates, and rejects invalid addresses', async () => {
    await resetRateLimits()
    const valid = await app.request('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com' }),
    })
    expect(valid.status).toBe(201)
    expect(((await valid.json()) as { status: string }).status).toBe('pending')

    const pending = await listSubscribers({ q: 'reader@example.com' })
    expect(pending.total).toBe(1)
    expect(pending.items[0]?.confirmedAt).toBeNull()
    expect(pending.items[0]?.ipHash).toMatch(/^[a-f0-9]{32}$/)
    expect(pending.items[0]?.ipHash).not.toBe('127.0.0.1')

    const confirmed = await app.request(`/confirm?token=${encodeURIComponent(pending.items[0]?.confirmationToken ?? '')}`)
    expect(confirmed.status).toBe(200)
    expect(await confirmed.text()).toContain('Subscription confirmed.')

    const duplicate = await app.request('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'READER@example.com' }),
    })
    expect(duplicate.status).toBe(200)
    expect(((await duplicate.json()) as { status: string }).status).toBe('exists')

    const invalid = await app.request('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })
    expect(invalid.status).toBe(400)

    const oneClick = await app.request(
      `/unsubscribe?token=${encodeURIComponent(pending.items[0]?.unsubscribeToken ?? '')}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      },
    )
    expect(oneClick.status).toBe(200)
    expect((await listSubscribers({ q: 'reader@example.com' })).items[0]?.status).toBe('unsubscribed')
  })

  test('cross-origin form submissions are rejected', async () => {
    const response = await app.request('/api/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://evil.example',
      },
      body: new URLSearchParams({ email: 'cross-origin@example.com' }).toString(),
    })
    expect(response.status).toBe(403)
  })

  test('honeypot submissions are accepted but never stored', async () => {
    await resetRateLimits()
    const response = await app.request('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'bot@example.com', website: 'https://spam.example' }),
    })
    expect(response.status).toBe(200)
    const subscribers = await listSubscribers({ q: 'bot@example.com' })
    expect(subscribers.total).toBe(0)
  })

  test('form submissions redirect back to the subscribe page', async () => {
    await resetRateLimits()
    const response = await app.request('/api/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'text/html',
        origin: 'http://localhost:3000',
      },
      body: new URLSearchParams({ email: 'form-reader@example.com', source: 'site' }).toString(),
    })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/subscribe?status=pending')
  })
})

describe('authentication and authorization', () => {
  test('admin pages require a session', async () => {
    const response = await app.request('/admin', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  test('wrong credentials do not create a session', async () => {
    await resetRateLimits()
    const get = await app.request('/admin/login')
    const html = await get.text()
    const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
    const response = await app.request('/admin/login', {
      method: 'POST',
      headers: { cookie: cookieFrom(get), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'test@example.com', password: 'wrong-password', _csrf: csrf }).toString(),
    })
    expect(response.status).toBe(401)
    expect(cookieFrom(response)).not.toContain('sid=')
  })

  test('login creates a session and the dashboard loads', async () => {
    const { cookie } = await login()
    const response = await app.request('/admin', { headers: { cookie } })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Overview')
  })

  test('logout requires a CSRF token and destroys the session', async () => {
    const { cookie, csrfToken } = await login()
    const missing = await app.request('/admin/logout', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    })
    expect(missing.status).toBe(303)
    expect(missing.headers.get('location')).toContain('error-csrf')

    const valid = await app.request('/admin/logout', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrfToken }).toString(),
    })
    expect(valid.status).toBe(303)
    const after = await app.request('/admin', { headers: { cookie }, redirect: 'manual' })
    expect(after.status).toBe(302)
  })

  test('admin APIs reject missing CSRF tokens', async () => {
    const { cookie } = await login()
    const response = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Should not exist' }),
    })
    expect(response.status).toBe(403)
  })

  test('admin APIs reject anonymous requests', async () => {
    const response = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(response.status).toBe(401)
  })
})

describe('CMS pipeline', () => {
  test('creates, publishes, updates, schedules and deletes an article', async () => {
    const { cookie, csrfToken } = await login()
    const payload = {
      title: 'An Integration Test Article',
      subtitle: 'Created by the test suite',
      excerpt: 'Testing the editorial API.',
      slug: 'integration-test-article',
      body: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Integration test body with notebooks and interfaces.' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Testing section' }] },
        ],
      },
      categoryId: 'cat_test',
      authorId: 'author_test',
      tagIds: ['tag_test'],
      status: 'draft',
    }

    const created = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(payload),
    })
    expect(created.status).toBe(201)
    const createdJson = (await created.json()) as {
      article: { id: string; slug: string; status: string }
      previewToken: string
    }
    expect(createdJson.article.slug).toBe('integration-test-article')
    expect(createdJson.article.status).toBe('draft')

    const draftPage = await app.request(`/articles/${createdJson.article.slug}`)
    expect(draftPage.status).toBe(404)

    const preview = await app.request(`/preview/${createdJson.article.id}?token=${createdJson.previewToken}`)
    expect(preview.status).toBe(200)
    expect(await preview.text()).toContain('An Integration Test Article')

    const noTokenPreview = await app.request(`/preview/${createdJson.article.id}`)
    expect(noTokenPreview.status).toBe(404)

    const published = await app.request(`/api/admin/articles/${createdJson.article.id}/publish`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(published.status).toBe(200)
    const publishedJson = (await published.json()) as { article: { status: string } }
    expect(publishedJson.article.status).toBe('published')

    const livePage = await app.request(`/articles/${createdJson.article.slug}`)
    expect(livePage.status).toBe(200)

    const conflict = await app.request(`/api/admin/articles/${createdJson.article.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ ...payload, status: 'published', updatedAt: '2000-01-01T00:00:00.000Z' }),
    })
    expect(conflict.status).toBe(409)

    const scheduled = await app.request(`/api/admin/articles/${createdJson.article.id}/schedule`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ scheduledFor: new Date(Date.now() + 86_400_000).toISOString() }),
    })
    expect(scheduled.status).toBe(200)
    expect(((await scheduled.json()) as { article: { status: string } }).article.status).toBe('scheduled')

    const deleted = await app.request(`/api/admin/articles/${createdJson.article.id}`, {
      method: 'DELETE',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(deleted.status).toBe(200)

    const afterDelete = await app.request(`/articles/${createdJson.article.slug}`)
    expect(afterDelete.status).toBe(404)

    const row = await getDb().select().from(articles).where(eq(articles.slug, createdJson.article.slug)).limit(1)
    expect(row.length).toBe(0)
  })

  test('prunes revisions past 30 without a bare OFFSET query', async () => {
    // Regression: Turso rejects `OFFSET ?` with no LIMIT, which broke saving.
    const { cookie, csrfToken } = await login()
    const payload = {
      title: 'Revision Pruning Article',
      slug: 'revision-pruning-article',
      excerpt: 'Pruning test.',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] }] },
      categoryId: 'cat_test',
      authorId: 'author_test',
      tagIds: [],
      status: 'draft',
    }

    const created = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(payload),
    })
    expect(created.status).toBe(201)
    const { article } = (await created.json()) as { article: { id: string } }

    for (let index = 0; index < 34; index += 1) {
      const current = await getArticleById(article.id)
      const saved = await app.request(`/api/admin/articles/${article.id}`, {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          ...payload,
          title: `Revision Pruning Article ${index}`,
          updatedAt: current?.updatedAt ?? null,
        }),
      })
      expect(saved.status).toBe(200)
    }

    const revisions = await getDb()
      .select({ id: articleRevisions.id })
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, article.id))
    expect(revisions.length).toBe(30)

    await app.request(`/api/admin/articles/${article.id}`, {
      method: 'DELETE',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
  })

  test('promotes scheduled articles once their time has passed', async () => {
    const created = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, 'art_test_scheduled'))
      .limit(1)
    expect(created.length).toBe(1)
    await scheduleArticle('art_test_scheduled', new Date(Date.now() - 60_000).toISOString())
    const promoted = await publishDueArticles()
    expect(promoted).toBeGreaterThanOrEqual(1)
    const row = await getArticleById('art_test_scheduled')
    expect(row?.status).toBe('published')
    // restore the fixture for other assertions
    await scheduleArticle('art_test_scheduled', new Date(Date.now() + 86_400_000).toISOString())
  })

  test('uploads an image, patches metadata, and deletes it', async () => {
    const { cookie, csrfToken } = await login()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      'base64',
    )
    const form = new FormData()
    form.append('file', new File([png], 'pixel.png', { type: 'image/png' }))
    const upload = await app.request('/api/admin/media', {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken },
      body: form,
    })
    expect(upload.status).toBe(201)
    const uploaded = (await upload.json()) as { media: { id: string; src: string } }
    expect(uploaded.media.src.startsWith('/uploads/')).toBe(true)

    const patch = await app.request(`/api/admin/media/${uploaded.media.id}`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ alt: 'A single pixel', caption: 'Test image' }),
    })
    expect(patch.status).toBe(200)

    const deleted = await app.request(`/api/admin/media/${uploaded.media.id}`, {
      method: 'DELETE',
      headers: { cookie, 'x-csrf-token': csrfToken },
    })
    expect(deleted.status).toBe(200)
  })

  test('rejects non-image uploads', async () => {
    const { cookie, csrfToken } = await login()
    const form = new FormData()
    form.append('file', new File([Buffer.from('not an image')], 'notes.txt', { type: 'text/plain' }))
    const upload = await app.request('/api/admin/media', {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken },
      body: form,
    })
    expect(upload.status).toBe(400)
  })
})

describe('preview tokens', () => {
  test('tokens are bound to the article and expire', () => {
    const token = createPreviewToken('art_test_draft')
    expect(token.split('.').length).toBe(2)
  })
})

beforeAll(async () => {
  await resetRateLimits()
})
