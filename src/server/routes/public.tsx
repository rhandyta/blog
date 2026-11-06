import type { Context } from 'hono'
import type { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { getConfig, isProd } from '../../lib/config'
import { absoluteUrl } from '../../lib/content/html'
import { collectMediaIds, countWords, parseDoc } from '../../lib/content/doc'
import { renderDoc } from '../../lib/content/render'
import { getMediaById, getMediaMap } from '../../lib/db/queries/media'
import {
  countArticlesByTag,
  countPublished,
  getArchiveEntries,
  getArticleDetailById,
  getFeaturedArticle,
  getMostRead,
  getNeighbourArticles,
  getPublishedArticleDetail,
  getRelatedArticles,
  listArticlesByTag,
  listEditorsPicks,
  listPublished,
  publishDueArticles,
  recordArticleView,
} from '../../lib/db/queries/articles'
import {
  getAuthorBySlug,
  getCategoryBySlug,
  getSiteSettings,
  getTagBySlug,
  listAuthors,
  listCategories,
  listTags,
  parseJsonObject,
} from '../../lib/db/queries/taxonomy'
import {
  clearConfirmationTimestamp,
  confirmSubscriber,
  subscribeEmail,
  unsubscribeByToken,
} from '../../lib/db/queries/subscribers'
import { sendEmail } from '../../lib/email/mailer'
import { confirmationEmail } from '../../lib/email/templates'
import { verifyResendWebhook } from '../../lib/email/webhook'
import { recordNewsletterEvent } from '../../lib/db/queries/newsletter-events'
import { pruneAnalytics } from '../../lib/db/queries/analytics'
import { buildVisitContext } from '../../lib/analytics/visitor'
import { searchPublished } from '../../lib/db/queries/search'
import { rateLimit } from '../../lib/auth/rate-limit'
import { runAutomationCron } from '../../lib/automation/generate'
import { runScheduledNewsletter } from '../../lib/newsletter/digest'
import { verifyPreviewToken } from '../../lib/seo/preview-token'
import { articleJsonLd, breadcrumbJsonLd, collectionJsonLd, personJsonLd, websiteJsonLd } from '../../lib/seo/meta'
import { renderRss, renderSitemap } from '../../lib/seo/feeds'
import { ArticlePage } from '../../pages/public/article'
import { ArticlesPage } from '../../pages/public/articles'
import { AboutPage } from '../../pages/public/about'
import { PrivacyPage, TermsPage } from '../../pages/public/legal'
import { ArchivePage } from '../../pages/public/archive'
import { AuthorPage } from '../../pages/public/author'
import { HomeEmptyPage, HomePage } from '../../pages/public/home'
import { SearchPage, SavedPage } from '../../pages/public/search'
import { ConfirmPage, SubscribePage, UnsubscribePage } from '../../pages/public/subscribe'
import { CategoryPage, TagPage } from '../../pages/public/taxonomy-pages'
import { TopicsPage } from '../../pages/public/topics'
import { baseHead, ogFromMedia } from '../head'
import { renderPageResponse } from '../render-page'
import type { AppEnv } from '../types'

const ARTICLES_PER_PAGE = 10
const ARCHIVE_PER_PAGE = 8

function pageParam(raw: string | undefined): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

function clientIp(c: Context<AppEnv>): string {
  try {
    const info = getConnInfo(c)
    return info.remote.address ?? 'unknown'
  } catch {
    return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  }
}

const recentViewKeys = new Map<string, number>()
const VIEW_DEDUPE_MS = 60 * 60 * 1000
const VIEW_DEDUPE_LIMIT = 5_000
const VIEW_WINDOW_MS = 60 * 1000
const VIEW_WRITES_PER_WINDOW = 120
let viewWindowStartedAt = 0
let viewWindowCount = 0

function shouldCountView(c: Context<AppEnv>, articleId: string): boolean {
  if (c.get('user')) return false
  if (c.req.header('dnt') === '1' || c.req.header('sec-gpc') === '1') return false
  const ua = c.req.header('user-agent') ?? ''
  if (/bot|spider|crawl|preview|headless|facebookexternalhit|slack|twitterbot|linkedinbot|discord|curl|wget|python-requests|go-http-client|axios/i.test(ua)) return false
  if (c.req.header('sec-purpose') === 'prefetch' || c.req.header('purpose') === 'prefetch') return false

  const now = Date.now()
  const key = `${articleId}:${clientIp(c)}`
  const last = recentViewKeys.get(key)
  if (last !== undefined && now - last < VIEW_DEDUPE_MS) return false

  if (now - viewWindowStartedAt >= VIEW_WINDOW_MS) {
    viewWindowStartedAt = now
    viewWindowCount = 0
  }
  if (viewWindowCount >= VIEW_WRITES_PER_WINDOW) return false
  viewWindowCount += 1

  recentViewKeys.set(key, now)
  if (recentViewKeys.size > VIEW_DEDUPE_LIMIT) {
    for (const [entry, at] of recentViewKeys) {
      if (now - at >= VIEW_DEDUPE_MS) recentViewKeys.delete(entry)
    }
    while (recentViewKeys.size > VIEW_DEDUPE_LIMIT) {
      const oldest = recentViewKeys.keys().next().value
      if (oldest === undefined) break
      recentViewKeys.delete(oldest)
    }
  }
  return true
}

async function layout() {
  const [settings, categories] = await Promise.all([getSiteSettings(), listCategories({ withCounts: true })])
  return { settings, categories }
}

function absoluteContent(html: string, origin: string): string {
  // Rewrite uploaded media first so srcset entries become absolute too, then
  // resolve any remaining root-relative links.
  return html
    .replaceAll('/uploads/', `${origin}/uploads/`)
    .replaceAll('src="/', `src="${origin}/`)
    .replaceAll('href="/', `href="${origin}/`)
}

export function registerPublicRoutes(app: Hono<AppEnv>): void {
  app.get('/', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const hero = await getFeaturedArticle()
    if (!hero) {
      return renderPageResponse(c, {
        element: <HomeEmptyPage settings={settings} categories={categories} />,
        head: baseHead({
          settings,
          origin,
          title: `${settings.title} — Rhandyta Briantama`,
          description: settings.description,
          path: '/',
          jsonLd: [websiteJsonLd(settings, origin)],
        }),
      })
    }
    const [latest, picks, mostRead] = await Promise.all([
      listPublished({ limit: 5, excludeIds: [hero.id] }),
      listEditorsPicks(4),
      getMostRead(4),
    ])
    return renderPageResponse(c, {
      element: (
        <HomePage
          settings={settings}
          categories={categories}
          hero={hero}
          latest={latest}
          picks={picks.filter((card) => card.id !== hero.id).slice(0, 3)}
          mostRead={mostRead.filter((card) => card.id !== hero.id).slice(0, 4)}
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: `${settings.title} — Rhandyta Briantama`,
        description: settings.description,
        path: '/',
        ogImage: ogFromMedia(hero.media),
        jsonLd: [websiteJsonLd(settings, origin)],
      }),
    })
  })

  app.get('/articles', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const page = pageParam(c.req.query('page'))
    const [total, items] = await Promise.all([
      countPublished(),
      listPublished({ limit: ARTICLES_PER_PAGE, offset: (page - 1) * ARTICLES_PER_PAGE }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE))
    return renderPageResponse(c, {
      element: (
        <ArticlesPage
          settings={settings}
          categories={categories}
          items={items}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      ),
      status: page > totalPages ? 404 : 200,
      head: baseHead({
        settings,
        origin,
        title: page > 1 ? `Articles — page ${page}` : 'Articles',
        description: 'Every essay and note in RhandytaVERSE, newest first.',
        path: page > 1 ? `/articles?page=${page}` : '/articles',
        ogImage: items[0]?.media ? ogFromMedia(items[0].media) : null,
      }),
    })
  })

  app.get('/articles/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const detail = await getPublishedArticleDetail(c.req.param('slug'))
    if (!detail) return c.notFound()
    const doc = parseDoc(detail.article.bodyJson)
    const media = await getMediaMap(collectMediaIds(doc))
    const { html, toc } = renderDoc(doc, media)
    const [related, neighbours] = await Promise.all([
      getRelatedArticles(detail.article, 3),
      getNeighbourArticles(detail.article),
    ])
    const url = absoluteUrl(origin, `/articles/${detail.article.slug}`)
    const canonicalPath = detail.article.canonicalUrl || `/articles/${detail.article.slug}`
    const description = detail.article.seoDescription || detail.article.excerpt
    const image = ogFromMedia(detail.ogMedia ?? detail.featuredMedia)
    const jsonLd: unknown[] = [
      articleJsonLd({
        origin,
        title: detail.article.title,
        description,
        slug: detail.article.slug,
        publishedAt: detail.article.publishedAt,
        modifiedAt: detail.article.updatedAt,
        authorName: detail.author?.displayName ?? settings.title,
        authorUrl: detail.author ? `/author/${detail.author.slug}` : null,
        image,
        section: detail.category?.name ?? null,
        tags: detail.tags.map((tag) => tag.name),
        wordCount: countWords(detail.article.bodyText),
        canonicalUrl: detail.article.canonicalUrl,
        settings,
      }),
      breadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          ...(detail.category ? [{ name: detail.category.name, path: `/category/${detail.category.slug}` }] : []),
          { name: detail.article.title, path: `/articles/${detail.article.slug}` },
        ],
        origin,
      ),
    ]
    if (shouldCountView(c, detail.article.id)) {
      const visit = buildVisitContext({
        ip: clientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        referer: c.req.header('referer') ?? null,
        country: c.req.header('x-vercel-ip-country') ?? c.req.header('cf-ipcountry') ?? null,
        origin,
      })
      await recordArticleView({ articleId: detail.article.id, ...visit }).catch(() => undefined)
    }
    return renderPageResponse(c, {
      element: (
        <ArticlePage
          settings={settings}
          categories={categories}
          detail={detail}
          html={html}
          toc={toc}
          url={url}
          related={related}
          previous={neighbours.previous}
          next={neighbours.next}
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: detail.article.seoTitle || detail.article.title,
        description,
        path: canonicalPath,
        robots: detail.article.noIndex ? 'noindex, follow' : undefined,
        ogType: 'article',
        ogImage: image,
        publishedTime: detail.article.publishedAt,
        modifiedTime: detail.article.updatedAt,
        author: detail.author?.displayName ?? null,
        section: detail.category?.name ?? null,
        tags: detail.tags.map((tag) => tag.name),
        jsonLd,
      }),
    })
  })

  app.get('/preview/:id', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const id = c.req.param('id')
    const token = c.req.query('token')
    const user = c.get('user')
    if (!verifyPreviewToken(id, token) && !user) return c.notFound()
    const detail = await getArticleDetailById(id)
    if (!detail) return c.notFound()
    const { settings, categories } = await layout()
    const doc = parseDoc(detail.article.bodyJson)
    const media = await getMediaMap(collectMediaIds(doc))
    const { html, toc } = renderDoc(doc, media)
    const previewUrl = `${absoluteUrl(origin, `/preview/${id}`)}?token=${encodeURIComponent(token ?? '')}`
    return renderPageResponse(c, {
      element: (
        <ArticlePage
          settings={settings}
          categories={categories}
          detail={detail}
          html={html}
          toc={toc}
          url={previewUrl}
          related={[]}
          previous={null}
          next={null}
          preview
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: `Preview — ${detail.article.title}`,
        description: detail.article.excerpt,
        path: `/preview/${id}`,
        robots: 'noindex, nofollow',
        ogImage: ogFromMedia(detail.featuredMedia),
      }),
    })
  })

  app.get('/category/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const category = await getCategoryBySlug(c.req.param('slug'))
    if (!category) return c.notFound()
    const { settings, categories } = await layout()
    const page = pageParam(c.req.query('page'))
    const [total, items] = await Promise.all([
      countPublished({ categoryId: category.id }),
      listPublished({
        categoryId: category.id,
        limit: ARCHIVE_PER_PAGE,
        offset: (page - 1) * ARCHIVE_PER_PAGE,
      }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / ARCHIVE_PER_PAGE))
    const featured = page === 1 ? items[0] ?? null : null
    const list = page === 1 ? items.slice(1) : items
    return renderPageResponse(c, {
      element: (
        <CategoryPage
          settings={settings}
          categories={categories}
          category={category}
          items={list}
          featured={featured}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      ),
      status: page > totalPages && total > 0 ? 404 : 200,
      head: baseHead({
        settings,
        origin,
        title: category.name,
        description: category.description,
        path: page > 1 ? `/category/${category.slug}?page=${page}` : `/category/${category.slug}`,
        ogImage: ogFromMedia(featured?.media ?? null),
        jsonLd: [
          collectionJsonLd({
            name: category.name,
            description: category.description,
            url: `/category/${category.slug}`,
            origin,
            items: items.map((card) => ({ title: card.title, path: `/articles/${card.slug}` })),
          }),
        ],
      }),
    })
  })

  app.get('/topics', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <TopicsPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        title: 'Topics',
        description: 'Every section of the publication, with its own accent and archive.',
        path: '/topics',
        jsonLd: [
          collectionJsonLd({
            name: 'Topics',
            description: 'Sections of the publication.',
            url: '/topics',
            origin,
            items: categories.map((category) => ({ title: category.name, path: `/category/${category.slug}` })),
          }),
        ],
      }),
    })
  })

  app.get('/author/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const author = await getAuthorBySlug(c.req.param('slug'))
    if (!author) return c.notFound()
    const { settings, categories } = await layout()
    const page = pageParam(c.req.query('page'))
    const [total, items, avatar] = await Promise.all([
      countPublished({ authorId: author.id }),
      listPublished({ authorId: author.id, limit: ARCHIVE_PER_PAGE, offset: (page - 1) * ARCHIVE_PER_PAGE }),
      author.avatarMediaId ? getMediaById(author.avatarMediaId) : Promise.resolve(undefined),
    ])
    const totalPages = Math.max(1, Math.ceil(total / ARCHIVE_PER_PAGE))
    return renderPageResponse(c, {
      element: (
        <AuthorPage
          settings={settings}
          categories={categories}
          author={author}
          avatar={avatar ?? null}
          items={items}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: author.displayName,
        description: author.bio,
        path: page > 1 ? `/author/${author.slug}?page=${page}` : `/author/${author.slug}`,
        ogImage: avatar ? ogFromMedia(avatar) : null,
        jsonLd: [
          personJsonLd({
            name: author.displayName,
            url: `/author/${author.slug}`,
            description: author.longBio ?? author.bio,
            image: avatar ? avatar.src : null,
            origin,
            jobTitle: author.roleTitle ?? undefined,
            sameAs: Object.values(parseJsonObject(author.socialLinks)).filter(
              (value): value is string => Boolean(value),
            ),
          }),
        ],
      }),
    })
  })

  app.get('/tags/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const tag = await getTagBySlug(c.req.param('slug'))
    if (!tag) return c.notFound()
    const { settings, categories } = await layout()
    const page = pageParam(c.req.query('page'))
    const [total, items] = await Promise.all([
      countArticlesByTag(tag.id),
      listArticlesByTag(tag.id, { limit: ARCHIVE_PER_PAGE, offset: (page - 1) * ARCHIVE_PER_PAGE }),
    ])
    const totalPages = Math.max(1, Math.ceil(total / ARCHIVE_PER_PAGE))
    return renderPageResponse(c, {
      element: (
        <TagPage
          settings={settings}
          categories={categories}
          tag={tag}
          items={items}
          total={total}
          page={page}
          totalPages={totalPages}
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: `Tagged “${tag.name}”`,
        description: tag.description || `Every piece filed under ${tag.name}.`,
        path: page > 1 ? `/tags/${tag.slug}?page=${page}` : `/tags/${tag.slug}`,
        ogImage: items[0]?.media ? ogFromMedia(items[0].media) : null,
      }),
    })
  })

  app.get('/archive', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const [entries, tags] = await Promise.all([getArchiveEntries(), listTags({ withCounts: true, limit: 40 })])
    return renderPageResponse(c, {
      element: <ArchivePage settings={settings} categories={categories} entries={entries} tags={tags} />,
      head: baseHead({
        settings,
        origin,
        title: 'Archive',
        description: 'A complete chronological archive of the publication.',
        path: '/archive',
        jsonLd: [
          collectionJsonLd({
            name: 'Archive',
            description: 'A complete chronological archive.',
            url: '/archive',
            origin,
            items: entries.slice(0, 50).map((entry) => ({ title: entry.title, path: `/articles/${entry.slug}` })),
          }),
        ],
      }),
    })
  })

  app.get('/search', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const query = (c.req.query('q') ?? '').slice(0, 200)
    const [hits, tags] = await Promise.all([searchPublished(query, 20), listTags({ withCounts: true, limit: 40 })])
    return renderPageResponse(c, {
      element: <SearchPage settings={settings} categories={categories} tags={tags} query={query} hits={hits} />,
      extraEntries: ['search'],
      head: baseHead({
        settings,
        origin,
        title: query ? `Search — ${query}` : 'Search',
        description: 'Search the full text of every published essay, note, and tag.',
        path: query ? `/search?q=${encodeURIComponent(query)}` : '/search',
        robots: 'noindex, follow',
      }),
    })
  })

  app.get('/saved', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <SavedPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        title: 'Saved articles',
        description: 'A reading list kept privately in your browser.',
        path: '/saved',
        robots: 'noindex, nofollow',
      }),
    })
  })

  app.get('/about', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const [articleCount, author] = await Promise.all([
      countPublished(),
      getAuthorBySlug('rhandyta-briantama'),
    ])
    const person = author ?? null
    const personName = person?.displayName ?? 'Rhandyta Briantama'
    const personSlug = person?.slug ?? 'rhandyta-briantama'
    const sameAs = [settings.github, settings.x, settings.linkedin].filter(
      (value): value is string => Boolean(value),
    )
    return renderPageResponse(c, {
      element: (
        <AboutPage
          settings={settings}
          categories={categories}
          articleCount={articleCount}
          author={person}
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'About',
        description: settings.about.split(/\n{2,}/)[0] ?? settings.description,
        path: '/about',
        jsonLd: [
          personJsonLd({
            name: personName,
            url: `/author/${personSlug}`,
            description:
              person?.longBio ??
              person?.bio ??
              'Rhandyta Briantama is the writer and editor behind RhandytaVERSE.',
            image: null,
            origin,
            jobTitle: person?.roleTitle ?? 'Writer & Editor',
            sameAs,
          }),
        ],
      }),
    })
  })

  app.get('/privacy', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <PrivacyPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        title: 'Privacy policy',
        description: 'How RhandytaVERSE handles newsletter and readership data.',
        path: '/privacy',
      }),
    })
  })

  app.get('/terms', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <TermsPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        title: 'Terms of use',
        description: 'Terms for reading and subscribing to RhandytaVERSE.',
        path: '/terms',
      }),
    })
  })

  app.get('/subscribe', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const status = c.req.query('status')
    return renderPageResponse(c, {
      element: (
        <SubscribePage
          settings={settings}
          categories={categories}
          status={
            status === 'ok' || status === 'pending' || status === 'exists' || status === 'invalid' || status === 'error'
              ? status
              : null
          }
        />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'Subscribe',
        description: settings.newsletterBlurb,
        path: '/subscribe',
      }),
    })
  })

  app.get('/unsubscribe', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const token = c.req.query('token')
    const email = token ? await unsubscribeByToken(token) : null
    return renderPageResponse(c, {
      element: (
        <UnsubscribePage settings={settings} categories={categories} status={email ? 'done' : 'invalid'} />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'Unsubscribe',
        description: 'Manage your newsletter subscription.',
        path: '/unsubscribe',
        robots: 'noindex, nofollow',
      }),
    })
  })

  app.post('/unsubscribe', async (c) => {
    let token = c.req.query('token')?.trim() ?? ''
    if (!token) {
      try {
        const body = await c.req.parseBody()
        token = typeof body.token === 'string' ? body.token.trim() : ''
      } catch {
        token = ''
      }
    }
    const email = token ? await unsubscribeByToken(token) : null
    return c.json({ ok: Boolean(email) }, email ? 200 : 404)
  })

  app.get('/confirm', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const { settings, categories } = await layout()
    const token = c.req.query('token')
    const email = token ? await confirmSubscriber(token) : null
    return renderPageResponse(c, {
      element: (
        <ConfirmPage settings={settings} categories={categories} status={email ? 'done' : 'invalid'} />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'Confirm subscription',
        description: 'Confirm your newsletter subscription.',
        path: '/confirm',
        robots: 'noindex, nofollow',
      }),
    })
  })

  app.post('/api/webhooks/resend', async (c) => {
    const secret = getConfig().RESEND_WEBHOOK_SECRET
    if (!secret) return c.json({ error: 'Webhook is not configured.' }, 503)
    const payload = await c.req.text()
    const valid = verifyResendWebhook({
      id: c.req.header('svix-id') ?? null,
      timestamp: c.req.header('svix-timestamp') ?? null,
      signature: c.req.header('svix-signature') ?? null,
      payload,
      secret,
    })
    if (!valid) return c.json({ error: 'Invalid signature.' }, 401)
    let event: unknown
    try {
      event = JSON.parse(payload)
    } catch {
      return c.json({ error: 'Invalid payload.' }, 400)
    }
    const id = c.req.header('svix-id') ?? crypto.randomUUID()
    await recordNewsletterEvent({
      id,
      event: event as Parameters<typeof recordNewsletterEvent>[0]['event'],
      payload,
    }).catch((error) => {
      console.error('[newsletter] webhook processing failed', error)
    })
    return c.json({ ok: true })
  })

  app.get('/rss.xml', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const settings = await getSiteSettings()
    const cards = await listPublished({ limit: 20 })
    const items = []
    for (const card of cards) {
      const detail = await getPublishedArticleDetail(card.slug)
      if (!detail) continue
      const doc = parseDoc(detail.article.bodyJson)
      const media = await getMediaMap(collectMediaIds(doc))
      const { html } = renderDoc(doc, media)
      items.push({
        title: detail.article.title,
        link: `${origin}/articles/${detail.article.slug}`,
        guid: `${origin}/articles/${detail.article.slug}`,
        description: detail.article.excerpt,
        content: absoluteContent(html, origin),
        publishedAt: detail.article.publishedAt,
        author: detail.author?.displayName ?? settings.title,
        category: detail.category?.name ?? null,
      })
    }
    const xml = renderRss({
      title: settings.title,
      description: settings.description,
      origin,
      feedPath: '/rss.xml',
      items,
      lastBuild: cards[0]?.publishedAt ?? new Date().toISOString(),
    })
    c.header('Content-Type', 'application/rss+xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=300, s-maxage=300')
    return c.body(xml)
  })

  app.get('/feed.xml', (c) => c.redirect('/rss.xml', 301))

  app.get('/sitemap.xml', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const [cards, categories, authors, tags] = await Promise.all([
      listPublished({ limit: 500 }),
      listCategories({ withCounts: true }),
      listAuthors({ withCounts: true }),
      listTags({ withCounts: true, limit: 100 }),
    ])
    const today = new Date().toISOString()
    const entries = [
      { loc: `${origin}/`, lastmod: today, changefreq: 'daily', priority: 1.0 },
      { loc: `${origin}/articles`, lastmod: today, changefreq: 'daily', priority: 0.9 },
      { loc: `${origin}/topics`, lastmod: today, changefreq: 'weekly', priority: 0.7 },
      { loc: `${origin}/archive`, lastmod: today, changefreq: 'weekly', priority: 0.7 },
      { loc: `${origin}/about`, lastmod: today, changefreq: 'monthly', priority: 0.4 },
      { loc: `${origin}/privacy`, lastmod: today, changefreq: 'yearly', priority: 0.2 },
      { loc: `${origin}/terms`, lastmod: today, changefreq: 'yearly', priority: 0.2 },
      { loc: `${origin}/subscribe`, lastmod: today, changefreq: 'monthly', priority: 0.4 },
      ...cards.filter((card) => !card.noIndex).map((card) => ({
        loc: `${origin}/articles/${card.slug}`,
        lastmod: card.publishedAt ?? today,
        changefreq: 'monthly',
        priority: 0.8,
      })),
      ...categories.map((category) => ({
        loc: `${origin}/category/${category.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.6,
      })),
      ...authors.map((author) => ({
        loc: `${origin}/author/${author.slug}`,
        lastmod: today,
        changefreq: 'monthly',
        priority: 0.5,
      })),
      ...tags.map((tag) => ({
        loc: `${origin}/tags/${tag.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.4,
      })),
    ]
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return c.body(renderSitemap(entries))
  })

  app.get('/robots.txt', (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    c.header('Content-Type', 'text/plain; charset=utf-8')
    return c.body(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /preview/
Disallow: /saved

Sitemap: ${origin}/sitemap.xml
`)
  })

  /* ---------------------------- public API ---------------------------- */

  app.get('/api/health', (c) => c.json({ ok: true, at: new Date().toISOString() }))

  app.get('/api/cron/publish', async (c) => {
    const secret = getConfig().CRON_SECRET
    if (secret) {
      if (c.req.header('authorization') !== `Bearer ${secret}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    } else if (isProd()) {
      return c.json({ error: 'CRON_SECRET is not configured' }, 403)
    }
    const published = await publishDueArticles()
    await pruneAnalytics().catch(() => undefined)
    return c.json({ published })
  })

  app.get('/api/cron/automation', async (c) => {
    const secret = getConfig().CRON_SECRET
    if (secret) {
      if (c.req.header('authorization') !== `Bearer ${secret}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    } else if (isProd()) {
      return c.json({ error: 'CRON_SECRET is not configured' }, 403)
    }

    const scheduled = await publishDueArticles()
    const result = await runAutomationCron()
    const digest = await runScheduledNewsletter().catch((error) => {
      console.error('[newsletter] scheduled digest failed', error)
      return { status: 'error' as const, reason: 'failed' as const }
    })
    await pruneAnalytics().catch(() => undefined)
    return c.json({ scheduled, ...result, digest })
  })

  app.get('/api/search', async (c) => {
    const ip = clientIp(c)
    const limited = rateLimit(`search:${ip}`, 60, 60_000)
    if (!limited.allowed) {
      c.header('Retry-After', String(limited.retryAfterSeconds))
      return c.json({ error: 'Too many searches. Please wait a moment.' }, 429)
    }
    const query = (c.req.query('q') ?? '').trim().slice(0, 200)
    const hits = await searchPublished(query, 20)
    return c.json({
      query,
      results: hits.map((hit) => ({
        slug: hit.card.slug,
        title: hit.card.title,
        category: hit.card.category?.name ?? 'Essay',
        accent: hit.card.category?.accent ?? 'vermilion',
        publishedAt: hit.card.publishedAt,
        readingMinutes: hit.card.readingMinutes,
        titleParts: hit.titleParts,
        snippetParts: hit.snippetParts,
      })),
    })
  })

  app.get('/api/articles', async (c) => {
    const limited = rateLimit(`articles:${clientIp(c)}`, 120, 60_000)
    if (!limited.allowed) {
      c.header('Retry-After', String(limited.retryAfterSeconds))
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429)
    }
    const slugs = (c.req.query('slugs') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 30)
    const cards = []
    for (const slug of slugs) {
      const card = await getPublishedArticleDetail(slug)
      if (!card) continue
      cards.push({
        slug: card.article.slug,
        title: card.article.title,
        excerpt: card.article.excerpt,
        category: card.category?.name ?? 'Essay',
        accent: card.category?.accent ?? 'vermilion',
        publishedAt: card.article.publishedAt,
        readingMinutes: card.article.readingMinutes,
        cover: card.featuredMedia
          ? { src: card.featuredMedia.src, alt: card.featuredMedia.alt }
          : null,
      })
    }
    return c.json({ articles: cards })
  })

  app.post('/api/subscribe', async (c) => {
    const ip = clientIp(c)
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const wantsJson =
      (c.req.header('accept') ?? '').includes('application/json') ||
      (c.req.header('content-type') ?? '').includes('application/json')
    const limited = rateLimit(`subscribe:${ip}`, 5, 60 * 60 * 1000)
    const respond = (status: 'ok' | 'pending' | 'exists' | 'invalid' | 'error', code: number) => {
      if (wantsJson) {
        return c.json(
          {
            status,
            message:
              status === 'ok'
                ? 'Subscribed'
                : status === 'pending'
                  ? 'Confirmation sent'
                  : status,
          },
          code as 200,
        )
      }
      return c.redirect(`/subscribe?status=${status}`, 303)
    }
    if (!limited.allowed) {
      if (wantsJson) {
        c.header('Retry-After', String(limited.retryAfterSeconds))
        return c.json({ status: 'error', message: 'Too many attempts. Please try again later.' }, 429)
      }
      return c.redirect('/subscribe?status=error', 303)
    }

    let email = ''
    let website = ''
    let source = 'site'
    try {
      if ((c.req.header('content-type') ?? '').includes('application/json')) {
        const body = (await c.req.json()) as Record<string, unknown>
        email = typeof body.email === 'string' ? body.email : ''
        website = typeof body.website === 'string' ? body.website : ''
        source = typeof body.source === 'string' ? body.source.slice(0, 30) : 'site'
      } else {
        const body = await c.req.parseBody()
        email = typeof body.email === 'string' ? body.email : ''
        website = typeof body.website === 'string' ? body.website : ''
        source = typeof body.source === 'string' ? body.source.slice(0, 30) : 'site'
      }
    } catch {
      return respond('invalid', 400)
    }

    if (website) {
      return respond('ok', 200)
    }
    try {
      const outcome = await subscribeEmail(email, {
        source,
        ip,
        requireConfirmation: true,
      })
      if (outcome.result === 'invalid') return respond('invalid', 400)
      if (outcome.result === 'already') return respond('exists', 200)
      if (outcome.result === 'subscribed') return respond('ok', 201)

      if (outcome.send) {
        const settings = await getSiteSettings()
        const mail = confirmationEmail({
          siteTitle: settings.title,
          origin,
          token: outcome.token,
        })
        const sent = await sendEmail({ to: outcome.email, ...mail })
        if (!sent.ok) {
          await clearConfirmationTimestamp(outcome.email).catch(() => undefined)
          console.error('[subscribe] confirmation email failed:', sent.error)
          return respond('error', 500)
        }
      }
      return respond('pending', 201)
    } catch (error) {
      console.error('[subscribe] failed', error)
      return respond('error', 500)
    }
  })

}
