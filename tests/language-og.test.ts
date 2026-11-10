import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createApp } from '../src/server/app'
import { resetRateLimits } from '../src/lib/auth/rate-limit'
import { createArticle, deleteArticle, recordArticleView } from '../src/lib/db/queries/articles'
import { getArticleAnalytics } from '../src/lib/db/queries/analytics'
import { getDb } from '../src/lib/db/client'
import { articles, articleRevisions } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
import { articleLanguage, detectLanguage, ogLocale } from '../src/lib/content/language'
import { articleSeed, fallbackOgPath, parseOgParams, renderFallbackOg } from '../src/lib/media/og-fallback'

const app = createApp()
const articleId = 'art_lang_og_test'
const slug = 'language-and-og-test'

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

describe('content language', () => {
  test('detects Indonesian from common function words', () => {
    expect(detectLanguage('Ini adalah artikel tentang sistem yang sudah berjalan dan tidak berhenti.')).toBe('id')
  })

  test('detects English from common function words', () => {
    expect(detectLanguage('This is an article about the systems that we build and maintain for you.')).toBe('en')
  })

  test('prefers an explicit language over detection', () => {
    const body = 'Ini adalah artikel tentang sistem yang sudah berjalan dan tidak berhenti.'
    expect(articleLanguage('en', body)).toBe('en')
    expect(articleLanguage('id', 'This is an English body with the and of to in it.')).toBe('id')
    expect(articleLanguage(null, body)).toBe('id')
  })

  test('maps languages to Open Graph locales', () => {
    expect(ogLocale('id')).toBe('id_ID')
    expect(ogLocale('in')).toBe('id_ID')
    expect(ogLocale('en')).toBe('en_US')
  })
})

describe('fallback Open Graph images', () => {
  test('derives a stable, deterministic path from the slug', () => {
    expect(articleSeed(slug)).toBe(articleSeed(slug))
    const path = fallbackOgPath(slug, '#c8452b')
    expect(path).toMatch(/^\/og\/\d+\/c8452b\.jpg$/)
  })

  test('rejects malformed path parameters', () => {
    expect(parseOgParams('12', 'c8452b.jpg')).toEqual({ seed: 12, accent: '#c8452b' })
    expect(parseOgParams('-4', 'c8452b.jpg')).toBeNull()
    expect(parseOgParams('12', 'not-hex.jpg')).toBeNull()
    expect(parseOgParams('abc', 'c8452b.jpg')).toBeNull()
  })

  test('renders a 1200×630 JPEG and serves repeats from cache', async () => {
    const jpeg = await renderFallbackOg(42, '#c8452b')
    expect(jpeg).not.toBeNull()
    expect(jpeg!.byteLength).toBeGreaterThan(2_000)
    expect(jpeg![0]).toBe(0xff)
    expect(jpeg![1]).toBe(0xd8)
    expect(await renderFallbackOg(42, '#c8452b')).toBe(jpeg!)
  })
})

describe('article language and Open Graph output', () => {
  beforeAll(async () => {
    await createArticle({
      id: articleId,
      slug,
      title: 'Bahasa dan Gambar Sosial',
      subtitle: null,
      excerpt: 'Artikel uji untuk bahasa dan gambar sosial.',
      bodyJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Ini adalah artikel tentang sistem yang sudah berjalan dan tidak berhenti.' },
            ],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'ts' },
            content: [{ type: 'text', text: 'const answer = 42' }],
          },
        ],
      }),
      bodyText: 'Ini adalah artikel tentang sistem yang sudah berjalan dan tidak berhenti.',
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
      language: 'id',
      isDemo: false,
      publishedAt: new Date().toISOString(),
      scheduledFor: null,
      tagIds: [],
    })
  })

  test('separates the interface language from the article content language', async () => {
    const response = await app.request(`/id/articles/${slug}`)
    const html = await response.text()
    expect(html).toContain('<html lang="id">')
    expect(html).toContain('<article lang="id"')
    expect(html).toContain('<meta property="og:locale" content="id_ID">')
    expect(html).toContain('"inLanguage":"id"')

    // The same Indonesian article on the English interface keeps an English
    // document language while marking the body itself as Indonesian.
    const english = await (await app.request(`/en/articles/${slug}`)).text()
    expect(english).toContain('<html lang="en">')
    expect(english).toContain('<article lang="id"')
    expect(english).toContain('<meta property="og:locale" content="en_US">')
    expect(english).toContain('"inLanguage":"id"')
  })

  test('falls back to the procedural cover for the social image', async () => {
    const html = await (await app.request(`/id/articles/${slug}`)).text()
    expect(html).toMatch(/property="og:image" content="https?:\/\/[^"]+\/og\/\d+\/[0-9a-f]{6}\.jpg"/)
  })

  test('serves the generated image and validates parameters', async () => {
    const seed = articleSeed(slug)
    const image = await app.request(`/og/${seed}/c8452b.jpg`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/jpeg')
    expect(image.headers.get('cache-control')).toContain('immutable')
    expect((await app.request('/og/nope/c8452b.jpg')).status).toBe(404)
    expect((await app.request('/og/12/zzzzzz.jpg')).status).toBe(404)
  })

  test('renders a copy button for code blocks', async () => {
    const html = await (await app.request(`/id/articles/${slug}`)).text()
    expect(html).toContain('data-copy-code')
    expect(html).toContain('aria-label="Salin kode ke papan klip"')
  })

  test('shows per-article readership to editors only', async () => {
    await recordArticleView({
      articleId,
      visitorHash: 'lang-visitor-a',
      day: new Date().toISOString().slice(0, 10),
      bucket: '2026-11-07T09',
      referrerHost: 'example.org',
      country: 'ID',
      device: 'desktop',
      browser: 'Firefox',
      os: 'Linux',
    })
    const data = await getArticleAnalytics(articleId, 30)
    expect(data?.lifetimeReaders).toBeGreaterThanOrEqual(1)
    expect(data?.referrers.map((row) => row.label)).toContain('example.org')

    expect((await app.request(`/admin/analytics/${articleId}`, { redirect: 'manual' })).status).toBe(302)
    const cookie = await login()
    const page = await app.request(`/admin/analytics/${articleId}`, {
      headers: { cookie, 'accept-language': 'en-US' },
    })
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Bahasa dan Gambar Sosial')
    expect(html).toContain('Readers, all time')
    expect(html).toContain('example.org')
    expect((await app.request(`/admin/analytics/${articleId}?days=7`, { headers: { cookie } })).status).toBe(200)
  })
})

describe('editor language field', () => {
  test('persists, updates and clears the language through the admin API', async () => {
    const cookie = await login()
    const session = (await (await app.request('/api/admin/session', { headers: { cookie } })).json()) as {
      csrfToken: string
    }
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Halo.' }] }] }
    const base = {
      title: 'Language roundtrip',
      slug: 'language-roundtrip',
      body,
      categoryId: 'cat_test',
      authorId: 'author_test',
    }

    const created = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
      body: JSON.stringify({ ...base, language: 'id' }),
    })
    expect(created.status).toBe(201)
    const id = ((await created.json()) as { article: { id: string } }).article.id

    const stored = async () =>
      (await getDb().select({ language: articles.language }).from(articles).where(eq(articles.id, id)))[0]?.language
    expect(await stored()).toBe('id')

    async function put(payload: Record<string, unknown>) {
      const current = (
        await getDb().select({ updatedAt: articles.updatedAt }).from(articles).where(eq(articles.id, id))
      )[0]
      return app.request(`/api/admin/articles/${id}`, {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify({ ...base, updatedAt: current?.updatedAt, ...payload }),
      })
    }

    expect((await put({ language: 'en' })).status).toBe(200)
    expect(await stored()).toBe('en')
    expect((await put({ language: null })).status).toBe(200)
    expect(await stored()).toBeNull()
    expect((await put({ language: 'fr' })).status).toBe(400)

    await getDb().delete(articleRevisions).where(eq(articleRevisions.articleId, id))
    await getDb().delete(articles).where(eq(articles.id, id))
  })
})

afterAll(async () => {
  await deleteArticle(articleId)
})
