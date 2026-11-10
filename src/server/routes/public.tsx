import type { Context } from 'hono'
import type { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { getConfig, isProd } from '../../lib/config'
import { absoluteUrl, splitParagraphs } from '../../lib/content/html'
import { collectMediaIds, countWords, parseDoc } from '../../lib/content/doc'
import { articleLanguage, ogLocale } from '../../lib/content/language'
import { renderDoc } from '../../lib/content/render'
import { LOCALES, LOCALE_META, localizedPath } from '../../lib/i18n'
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
  ACCENTS,
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
import { fallbackOgPath, parseOgParams, renderFallbackOg } from '../../lib/media/og-fallback'
import { recordNewsletterEvent } from '../../lib/db/queries/newsletter-events'
import { pruneAuditLog } from '../../lib/db/queries/audit'
import { pruneAnalytics } from '../../lib/db/queries/analytics'
import { checkDatabaseHealth, pruneOpsEvents, recordOpsEvent } from '../../lib/ops/monitor'
import { buildVisitContext } from '../../lib/analytics/visitor'
import { searchPublished } from '../../lib/db/queries/search'
import { pruneRateLimits, rateLimit } from '../../lib/auth/rate-limit'
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
import { localPath } from '../locale'
import { renderPageResponse } from '../render-page'
import { action, page } from '../routing'
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
  if (
    /bot|spider|crawl|preview|headless|facebookexternalhit|slack|twitterbot|linkedinbot|discord|curl|wget|python-requests|go-http-client|axios/i.test(
      ua,
    )
  )
    return false
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

function scheduleBackgroundTask(c: Context<AppEnv>, promise: Promise<unknown>): boolean {
  const tracked = promise.catch((error) => {
    console.error('[background] task failed', error)
  })
  try {
    const reqCtx = (
      globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>
    )[Symbol.for('@vercel/request-context')]?.get?.()
    if (reqCtx && typeof reqCtx.waitUntil === 'function') {
      reqCtx.waitUntil(tracked)
      return true
    }
  } catch {
    // ignore missing Vercel request context
  }
  try {
    if (typeof c.executionCtx?.waitUntil === 'function') {
      c.executionCtx.waitUntil(tracked)
      return true
    }
  } catch {
    // Hono throws when c.executionCtx is accessed outside a FetchEvent context
  }
  return false
}

async function layout() {
  const [settings, categories] = await Promise.all([getSiteSettings(), listCategories({ withCounts: true })])
  return { settings, categories }
}

/** prev/next paths for a paginated listing, so crawlers can follow the sequence. */
function paginationLinks(basePath: string, page: number, totalPages: number) {
  return {
    prev: page > 1 ? (page === 2 ? basePath : `${basePath}?page=${page - 1}`) : null,
    next: page < totalPages ? `${basePath}?page=${page + 1}` : null,
  }
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
  page(app, '/', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const hero = await getFeaturedArticle()
    if (!hero) {
      return renderPageResponse(c, {
        element: <HomeEmptyPage settings={settings} categories={categories} />,
        head: baseHead({
          settings,
          origin,
          locale,
          title: t('seo.homeTitle', { site: settings.title }),
          description: settings.description,
          path: '/',
          jsonLd: [websiteJsonLd(settings, origin, locale)],
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
        locale,
        title: t('seo.homeTitle', { site: settings.title }),
        description: settings.description,
        path: '/',
        ogImage: ogFromMedia(hero.media),
        jsonLd: [websiteJsonLd(settings, origin, locale)],
      }),
    })
  })

  page(app, '/articles', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
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
        locale,
        title: page > 1 ? t('seo.articlesPageTitle', { page }) : t('seo.articlesTitle', { site: settings.title }),
        description: t('seo.articlesDescription', { site: settings.title }),
        path: page > 1 ? `/articles?page=${page}` : '/articles',
        pagination: paginationLinks('/articles', page, totalPages),
        ogImage: items[0]?.media ? ogFromMedia(items[0].media) : null,
      }),
    })
  })

  page(app, '/articles/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const detail = await getPublishedArticleDetail(c.req.param('slug'))
    if (!detail) return c.notFound()
    const doc = parseDoc(detail.article.bodyJson)
    let viewPromise: Promise<unknown> | null = null
    if (shouldCountView(c, detail.article.id)) {
      const visit = buildVisitContext({
        ip: clientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        referer: c.req.header('referer') ?? null,
        country: c.req.header('x-vercel-ip-country') ?? c.req.header('cf-ipcountry') ?? null,
        origin,
      })
      const write = recordArticleView({ articleId: detail.article.id, ...visit }).catch(() => undefined)
      if (process.env.NODE_ENV === 'test' || !scheduleBackgroundTask(c, write)) {
        viewPromise = write
      }
    }
    const [media, related, neighbours] = await Promise.all([
      getMediaMap(collectMediaIds(doc)),
      getRelatedArticles(detail.article, 3),
      getNeighbourArticles(detail.article),
      viewPromise ?? Promise.resolve(),
    ])
    const { html, toc } = renderDoc(doc, media, locale)
    const url = absoluteUrl(origin, localizedPath(locale, `/articles/${detail.article.slug}`))
    const canonicalPath = detail.article.canonicalUrl || `/articles/${detail.article.slug}`
    const description = detail.article.seoDescription || detail.article.excerpt
    const accentHex = ACCENTS.find((item) => item.token === (detail.category?.accent ?? 'vermilion'))?.hex ?? '#c8452b'
    const image = ogFromMedia(detail.ogMedia ?? detail.featuredMedia) ?? {
      url: fallbackOgPath(detail.article.slug, accentHex),
      width: 1200,
      height: 630,
      alt: t('seo.previewOgAlt', { title: detail.article.title }),
    }
    const language = articleLanguage(detail.article.language, detail.article.bodyText)
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
        language,
      }),
      breadcrumbJsonLd(
        [
          { name: t('nav.home'), path: localizedPath(locale, '/') },
          ...(detail.category
            ? [{ name: detail.category.name, path: localizedPath(locale, `/category/${detail.category.slug}`) }]
            : []),
          { name: detail.article.title, path: localizedPath(locale, `/articles/${detail.article.slug}`) },
        ],
        origin,
      ),
    ]
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
          contentLanguage={language}
        />
      ),
      head: baseHead({
        settings,
        origin,
        locale,
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

  app.get('/og/:seed/:accent', async (c) => {
    const parsed = parseOgParams(c.req.param('seed') ?? '', c.req.param('accent') ?? '')
    if (!parsed) return c.notFound()
    try {
      const jpeg = await renderFallbackOg(parsed.seed, parsed.accent)
      if (!jpeg) {
        c.header('Retry-After', '60')
        return c.body(null, 503)
      }
      c.header('Content-Type', 'image/jpeg')
      c.header('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
      return c.body(new Uint8Array(jpeg))
    } catch (error) {
      console.error('[og] fallback render failed', error)
      return c.notFound()
    }
  })

  app.get('/preview/:id', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const id = c.req.param('id')
    const token = c.req.query('token')
    const user = c.get('user')
    if (!verifyPreviewToken(id, token) && !user) return c.notFound()
    const detail = await getArticleDetailById(id)
    if (!detail) return c.notFound()
    const { settings, categories } = await layout()
    const doc = parseDoc(detail.article.bodyJson)
    const media = await getMediaMap(collectMediaIds(doc))
    const { html, toc } = renderDoc(doc, media, locale)
    const previewUrl = `${absoluteUrl(origin, `/preview/${id}`)}?token=${encodeURIComponent(token ?? '')}`
    const previewLanguage = articleLanguage(detail.article.language, detail.article.bodyText)
    return renderPageResponse(c, {
      noAnalytics: true,
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
          contentLanguage={previewLanguage}
        />
      ),
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.previewTitle', { title: detail.article.title }),
        description: detail.article.excerpt,
        // Preview URLs are token-scoped and never advertised as alternates.
        path: absoluteUrl(origin, `/preview/${id}`),
        robots: 'noindex, nofollow',
        alternates: [],
        ogImage: ogFromMedia(detail.featuredMedia),
      }),
    })
  })

  page(app, '/category/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
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
    const featured = page === 1 ? (items[0] ?? null) : null
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
        locale,
        title: category.name,
        description: category.description,
        path: page > 1 ? `/category/${category.slug}?page=${page}` : `/category/${category.slug}`,
        pagination: total === 0 ? undefined : paginationLinks(`/category/${category.slug}`, page, totalPages),
        // An empty section and deep pagination are thin pages; keep them
        // crawlable but out of the index.
        robots: total === 0 || page > 1 ? 'noindex, follow' : undefined,
        ogImage: ogFromMedia(featured?.media ?? null),
        jsonLd:
          total === 0
            ? []
            : [
                collectionJsonLd({
                  name: category.name,
                  description: category.description,
                  url: localizedPath(locale, `/category/${category.slug}`),
                  origin,
                  items: items.map((card) => ({
                    title: card.title,
                    path: localizedPath(locale, `/articles/${card.slug}`),
                  })),
                }),
              ],
      }),
    })
  })

  page(app, '/topics', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <TopicsPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.topicsTitle', { site: settings.title }),
        description: t('seo.topicsDescription'),
        path: '/topics',
        jsonLd: [
          collectionJsonLd({
            name: t('listing.topicsTitle'),
            description: t('listing.topicsBlurb'),
            url: localizedPath(locale, '/topics'),
            origin,
            items: categories.map((category) => ({
              title: category.name,
              path: localizedPath(locale, `/category/${category.slug}`),
            })),
          }),
        ],
      }),
    })
  })

  page(app, '/author/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const locale = c.get('locale')
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
        locale,
        title: author.displayName,
        description: author.bio,
        path: page > 1 ? `/author/${author.slug}?page=${page}` : `/author/${author.slug}`,
        pagination: paginationLinks(`/author/${author.slug}`, page, totalPages),
        ogImage: avatar ? ogFromMedia(avatar) : null,
        jsonLd: [
          personJsonLd({
            name: author.displayName,
            url: localizedPath(locale, `/author/${author.slug}`),
            description: author.longBio ?? author.bio,
            image: avatar ? avatar.src : null,
            origin,
            jobTitle: author.roleTitle ?? undefined,
            sameAs: Object.values(parseJsonObject(author.socialLinks)).filter((value): value is string =>
              Boolean(value),
            ),
          }),
        ],
      }),
    })
  })

  page(app, '/tags/:slug', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
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
        locale,
        title: t('seo.tagTitle', { name: tag.name }),
        description: tag.description || t('seo.tagDescription', { name: tag.name }),
        path: page > 1 ? `/tags/${tag.slug}?page=${page}` : `/tags/${tag.slug}`,
        pagination: paginationLinks(`/tags/${tag.slug}`, page, totalPages),
        ogImage: items[0]?.media ? ogFromMedia(items[0].media) : null,
      }),
    })
  })

  page(app, '/archive', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const [entries, tags] = await Promise.all([getArchiveEntries(), listTags({ withCounts: true, limit: 40 })])
    return renderPageResponse(c, {
      element: <ArchivePage settings={settings} categories={categories} entries={entries} tags={tags} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.archiveTitle', { site: settings.title }),
        description: t('seo.archiveDescription'),
        path: '/archive',
        jsonLd: [
          collectionJsonLd({
            name: t('listing.archiveTitle'),
            description: t('listing.archiveBlurb'),
            url: localizedPath(locale, '/archive'),
            origin,
            items: entries
              .slice(0, 50)
              .map((entry) => ({ title: entry.title, path: localizedPath(locale, `/articles/${entry.slug}`) })),
          }),
        ],
      }),
    })
  })

  page(app, '/search', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const query = (c.req.query('q') ?? '').slice(0, 200)
    const [hits, tags] = await Promise.all([searchPublished(query, 20), listTags({ withCounts: true, limit: 40 })])
    return renderPageResponse(c, {
      element: <SearchPage settings={settings} categories={categories} tags={tags} query={query} hits={hits} />,
      extraEntries: ['search'],
      head: baseHead({
        settings,
        origin,
        locale,
        title: query ? t('seo.searchTitleQuery', { query }) : t('seo.searchTitle'),
        description: t('seo.searchDescription'),
        path: query ? `/search?q=${encodeURIComponent(query)}` : '/search',
        robots: 'noindex, follow',
      }),
    })
  })

  page(app, '/saved', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <SavedPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.savedTitle'),
        description: t('seo.savedDescription'),
        path: '/saved',
        robots: 'noindex, nofollow',
      }),
    })
  })

  page(app, '/about', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const [articleCount, author] = await Promise.all([countPublished(), getAuthorBySlug('rhandyta-briantama')])
    const person = author ?? null
    const personName = person?.displayName ?? 'Rhandyta Briantama'
    const personSlug = person?.slug ?? 'rhandyta-briantama'
    const sameAs = [settings.github, settings.x, settings.linkedin].filter((value): value is string => Boolean(value))
    return renderPageResponse(c, {
      element: <AboutPage settings={settings} categories={categories} articleCount={articleCount} author={person} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.aboutTitle', { site: settings.title }),
        description: splitParagraphs(settings.about)[0] ?? settings.description,
        path: '/about',
        jsonLd: [
          personJsonLd({
            name: personName,
            url: localizedPath(locale, `/author/${personSlug}`),
            description: person?.longBio ?? person?.bio ?? t('seo.aboutDescription', { site: settings.title }),
            image: null,
            origin,
            jobTitle: person?.roleTitle ?? undefined,
            sameAs,
          }),
        ],
      }),
    })
  })

  page(app, '/privacy', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <PrivacyPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.privacyTitle'),
        description: t('seo.privacyDescription', { site: settings.title }),
        path: '/privacy',
      }),
    })
  })

  page(app, '/terms', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    return renderPageResponse(c, {
      element: <TermsPage settings={settings} categories={categories} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.termsTitle'),
        description: t('seo.termsDescription', { site: settings.title }),
        path: '/terms',
      }),
    })
  })

  page(app, '/subscribe', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
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
        locale,
        title: t('seo.subscribeTitle', { site: settings.title }),
        description: settings.newsletterBlurb,
        path: '/subscribe',
      }),
    })
  })

  page(app, '/unsubscribe', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const token = c.req.query('token')
    const email = token ? await unsubscribeByToken(token) : null
    return renderPageResponse(c, {
      element: <UnsubscribePage settings={settings} categories={categories} status={email ? 'done' : 'invalid'} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.unsubscribeTitle'),
        description: t('seo.unsubscribeDescription'),
        path: '/unsubscribe',
        robots: 'noindex, nofollow',
      }),
    })
  })

  action(app, '/unsubscribe', async (c) => {
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

  page(app, '/confirm', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const t = c.get('t')
    const locale = c.get('locale')
    const { settings, categories } = await layout()
    const token = c.req.query('token')
    const email = token ? await confirmSubscriber(token) : null
    return renderPageResponse(c, {
      element: <ConfirmPage settings={settings} categories={categories} status={email ? 'done' : 'invalid'} />,
      head: baseHead({
        settings,
        origin,
        locale,
        title: t('seo.confirmTitle'),
        description: t('seo.confirmDescription'),
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
    let event: { type?: string }
    try {
      event = JSON.parse(payload) as { type?: string }
    } catch {
      await recordOpsEvent({
        level: 'warn',
        source: 'webhook.resend',
        code: 'invalid_payload',
        message: 'Verified Resend webhook contained invalid JSON',
        requestId: c.get('requestId'),
        path: c.req.path,
        notify: false,
      })
      return c.json({ error: 'Invalid payload.' }, 400)
    }
    const id = c.req.header('svix-id') ?? crypto.randomUUID()
    await recordNewsletterEvent({
      id,
      event: event as Parameters<typeof recordNewsletterEvent>[0]['event'],
      payload,
    }).catch(async (error) => {
      await recordOpsEvent({
        level: 'error',
        source: 'webhook.resend',
        code: 'webhook_persist_failed',
        message: error instanceof Error ? error.message : String(error),
        detail: { eventId: id, type: event.type ?? null },
        requestId: c.get('requestId'),
        path: c.req.path,
      })
    })
    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      await recordOpsEvent({
        level: 'warn',
        source: 'webhook.resend',
        code: event.type,
        message: `Resend reported ${event.type}`,
        detail: { eventId: id },
        requestId: c.get('requestId'),
        path: c.req.path,
        notify: false,
      })
    }
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
      const { html } = renderDoc(doc, media, c.get('locale'))
      items.push({
        title: detail.article.title,
        link: `${origin}/articles/${detail.article.slug}`,
        guid: `${origin}/articles/${detail.article.slug}`,
        description: detail.article.excerpt,
        content: absoluteContent(html, origin),
        publishedAt: detail.article.publishedAt,
        author: detail.author?.displayName ?? settings.title,
        category: detail.category?.name ?? null,
        language: articleLanguage(detail.article.language, detail.article.bodyText),
      })
    }
    const xml = renderRss({
      title: settings.title,
      description: settings.description,
      origin,
      feedPath: '/rss.xml',
      items,
      lastBuild: cards[0]?.publishedAt ?? new Date().toISOString(),
      language: settings.siteLanguage,
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

    /** Both language variants of one page, each listing the other as alternate. */
    const localizedEntries = (path: string, options: { lastmod?: string; changefreq?: string; priority?: number }) => {
      const alternates = [
        { hreflang: 'id', href: `${origin}${localizedPath('id', path)}` },
        { hreflang: 'en', href: `${origin}${localizedPath('en', path)}` },
        { hreflang: 'x-default', href: `${origin}${localizedPath('id', path)}` },
      ]
      return LOCALES.map((locale) => ({
        loc: `${origin}${localizedPath(locale, path)}`,
        lastmod: options.lastmod,
        changefreq: options.changefreq,
        priority: options.priority,
        alternates,
      }))
    }

    const entries = [
      ...localizedEntries('/', { lastmod: today, changefreq: 'daily', priority: 1.0 }),
      ...localizedEntries('/articles', { lastmod: today, changefreq: 'daily', priority: 0.9 }),
      ...localizedEntries('/topics', { lastmod: today, changefreq: 'weekly', priority: 0.7 }),
      ...localizedEntries('/archive', { lastmod: today, changefreq: 'weekly', priority: 0.7 }),
      ...localizedEntries('/about', { lastmod: today, changefreq: 'monthly', priority: 0.4 }),
      ...localizedEntries('/privacy', { lastmod: today, changefreq: 'yearly', priority: 0.2 }),
      ...localizedEntries('/terms', { lastmod: today, changefreq: 'yearly', priority: 0.2 }),
      ...localizedEntries('/subscribe', { lastmod: today, changefreq: 'monthly', priority: 0.4 }),
      ...cards
        .filter((card) => !card.noIndex)
        .flatMap((card) =>
          localizedEntries(`/articles/${card.slug}`, {
            lastmod: card.publishedAt ?? today,
            changefreq: 'monthly',
            priority: 0.8,
          }),
        ),
      // Empty sections are noindexed, so they must not be advertised here either.
      ...categories
        .filter((category) => category.articleCount > 0)
        .flatMap((category) =>
          localizedEntries(`/category/${category.slug}`, {
            lastmod: today,
            changefreq: 'weekly',
            priority: 0.6,
          }),
        ),
      ...authors.flatMap((author) =>
        localizedEntries(`/author/${author.slug}`, {
          lastmod: today,
          changefreq: 'monthly',
          priority: 0.5,
        }),
      ),
      ...tags
        .filter((tag) => tag.articleCount > 0)
        .flatMap((tag) =>
          localizedEntries(`/tags/${tag.slug}`, {
            lastmod: today,
            changefreq: 'weekly',
            priority: 0.4,
          }),
        ),
    ]
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return c.body(renderSitemap(entries))
  })

  app.get('/llms.txt', async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const settings = await getSiteSettings()
    const [cards, authors] = await Promise.all([listPublished({ limit: 200 }), listAuthors({ withCounts: true })])
    const author = authors[0]
    const lines = [
      `# ${settings.title}`,
      '',
      `> ${settings.description}`,
      '',
      `${settings.title} is the personal publication of ${author?.displayName ?? 'Rhandyta Briantama'}.`,
      'Essays are written in Indonesian and English; each article states its own language.',
      'All pages are server-rendered and readable without JavaScript.',
      '',
      '## Contact',
      '',
      `- Author: ${author?.displayName ?? 'Rhandyta Briantama'} (${origin}/author/${author?.slug ?? 'rhandyta-briantama'})`,
      settings.email ? `- Email: ${settings.email}` : null,
      '',
      '## Main pages',
      '',
      `- Home: ${origin}/ (both languages: ${origin}/id, ${origin}/en)`,
      `- All articles: ${origin}/articles`,
      `- Topics: ${origin}/topics`,
      `- Archive: ${origin}/archive`,
      `- About: ${origin}/about`,
      `- RSS: ${origin}/rss.xml`,
      `- Sitemap: ${origin}/sitemap.xml`,
      '',
      '## Languages',
      '',
      'Every page exists in Indonesian and English. Prefix a path with /id or /en to',
      'select a language explicitly; without a prefix the site negotiates one from the',
      'visitor cookie and Accept-Language header, defaulting to Indonesian.',
      '',
      '## Articles',
      '',
      ...cards
        .filter((card) => !card.noIndex)
        .map((card) => `- [${card.title}](${origin}/articles/${card.slug}): ${card.excerpt}`),
      '',
      '## Usage',
      '',
      'Quoting and summarising these articles is welcome with attribution and a link to the source.',
      'Prices, dates, and third-party facts should be verified against the linked primary sources.',
    ].filter((line): line is string => line !== null)
    c.header('Content-Type', 'text/plain; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return c.body(`${lines.join('\n')}\n`)
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
Disallow: /id/saved
Disallow: /en/saved
Disallow: /locale

Sitemap: ${origin}/sitemap.xml
`)
  })

  /* ---------------------------- public API ---------------------------- */

  app.get('/api/health', async (c) => {
    const db = await checkDatabaseHealth()
    c.header('Cache-Control', 'no-store')
    if (!db.ok) {
      await recordOpsEvent({
        level: 'error',
        source: 'health',
        code: 'db_unhealthy',
        message: 'Health check database ping failed',
        detail: { mode: db.mode, latencyMs: db.latencyMs },
        requestId: c.get('requestId'),
        path: c.req.path,
      })
      return c.json({ ok: false, db: 'error', mode: db.mode, at: new Date().toISOString() }, 503)
    }
    return c.json({ ok: true, db: 'ok', mode: db.mode, latencyMs: db.latencyMs, at: new Date().toISOString() })
  })

  app.get('/api/cron/publish', async (c) => {
    const secret = getConfig().CRON_SECRET
    if (secret) {
      if (c.req.header('authorization') !== `Bearer ${secret}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    } else if (isProd()) {
      return c.json({ error: 'CRON_SECRET is not configured' }, 403)
    }
    try {
      const published = await publishDueArticles()
      await pruneAnalytics().catch(() => undefined)
      await pruneOpsEvents().catch(() => undefined)
      await recordOpsEvent({
        level: 'info',
        source: 'cron.publish',
        code: 'cron_completed',
        message: `Scheduled publish completed (${published} published)`,
        detail: { published },
        requestId: c.get('requestId'),
        path: c.req.path,
        notify: false,
      })
      return c.json({ published })
    } catch (error) {
      await recordOpsEvent({
        level: 'error',
        source: 'cron.publish',
        code: 'cron_crashed',
        message: error instanceof Error ? error.message : String(error),
        detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
        requestId: c.get('requestId'),
        path: c.req.path,
      })
      return c.json({ ok: false, error: 'Publish cron failed' }, 500)
    }
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

    try {
      const scheduled = await publishDueArticles()
      const result = await runAutomationCron()
      let digestError: string | null = null
      const digest = await runScheduledNewsletter().catch((error) => {
        digestError = error instanceof Error ? error.message : String(error)
        return { status: 'error' as const, reason: 'failed' as const }
      })
      await pruneAnalytics().catch(() => undefined)
      await pruneRateLimits()
      await pruneAuditLog()
      await pruneOpsEvents().catch(() => undefined)

      if (result.generated.errors.length > 0) {
        await recordOpsEvent({
          level: 'error',
          source: 'cron.automation',
          code: 'generation_failed',
          message: result.generated.errors[0] ?? 'Automation generation reported an error',
          detail: { errors: result.generated.errors, scheduled, generated: result.generated.generated.length },
          requestId: c.get('requestId'),
          path: c.req.path,
        })
      }
      if (digestError || digest.status === 'error') {
        const digestReason = 'reason' in digest && digest.reason ? digest.reason : 'unknown'
        await recordOpsEvent({
          level: 'error',
          source: 'cron.automation',
          code: 'digest_failed',
          message: digestError ?? `Scheduled newsletter digest failed (${digestReason})`,
          detail: { scheduled, digest },
          requestId: c.get('requestId'),
          path: c.req.path,
        })
      }
      if (result.generated.errors.length === 0 && !digestError && digest.status !== 'error') {
        await recordOpsEvent({
          level: 'info',
          source: 'cron.automation',
          code: 'cron_completed',
          message: `Automation cron ran (${result.generated.generated.length} generated, ${result.published + scheduled} published)`,
          detail: {
            scheduled,
            autoPublished: result.published,
            generated: result.generated.generated.length,
            reason: result.generated.reason,
            digest: digest.status,
          },
          requestId: c.get('requestId'),
          path: c.req.path,
          notify: false,
        })
      }
      return c.json({ scheduled, ...result, digest })
    } catch (error) {
      await recordOpsEvent({
        level: 'error',
        source: 'cron.automation',
        code: 'cron_crashed',
        message: error instanceof Error ? error.message : String(error),
        detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
        requestId: c.get('requestId'),
        path: c.req.path,
      })
      return c.json({ ok: false, error: 'Automation cron failed' }, 500)
    }
  })

  app.get('/api/search', async (c) => {
    const t = c.get('t')
    const ip = clientIp(c)
    const limited = await rateLimit(`search:${ip}`, 60, 60_000)
    if (!limited.allowed) {
      c.header('Retry-After', String(limited.retryAfterSeconds))
      return c.json({ success: false, error: { code: 'RATE_LIMITED', message: t('api.rateLimited') } }, 429)
    }
    const query = (c.req.query('q') ?? '').trim().slice(0, 200)
    const hits = await searchPublished(query, 20)
    return c.json({
      query,
      results: hits.map((hit) => ({
        slug: hit.card.slug,
        title: hit.card.title,
        category: hit.card.category?.name ?? t('common.essay'),
        accent: hit.card.category?.accent ?? 'vermilion',
        publishedAt: hit.card.publishedAt,
        readingMinutes: hit.card.readingMinutes,
        titleParts: hit.titleParts,
        snippetParts: hit.snippetParts,
      })),
    })
  })

  app.get('/api/articles', async (c) => {
    const t = c.get('t')
    const limited = await rateLimit(`articles:${clientIp(c)}`, 120, 60_000)
    if (!limited.allowed) {
      c.header('Retry-After', String(limited.retryAfterSeconds))
      return c.json({ success: false, error: { code: 'RATE_LIMITED', message: t('api.rateLimited') } }, 429)
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
        category: card.category?.name ?? t('common.essay'),
        accent: card.category?.accent ?? 'vermilion',
        publishedAt: card.article.publishedAt,
        readingMinutes: card.article.readingMinutes,
        cover: card.featuredMedia ? { src: card.featuredMedia.src, alt: card.featuredMedia.alt } : null,
      })
    }
    return c.json({ articles: cards })
  })

  app.post('/api/subscribe', async (c) => {
    const t = c.get('t')
    const locale = c.get('locale')
    const ip = clientIp(c)
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const wantsJson =
      (c.req.header('accept') ?? '').includes('application/json') ||
      (c.req.header('content-type') ?? '').includes('application/json')
    const limited = await rateLimit(`subscribe:${ip}`, 5, 60 * 60 * 1000)
    const statusMessage = {
      ok: t('subscribe.statusOk'),
      pending: t('subscribe.statusPending'),
      exists: t('subscribe.statusExists'),
      invalid: t('subscribe.statusInvalid'),
      error: t('subscribe.statusError'),
    }
    const respond = (status: 'ok' | 'pending' | 'exists' | 'invalid' | 'error', code: number) => {
      if (wantsJson) {
        return c.json({ status, message: statusMessage[status] }, code as 200)
      }
      return c.redirect(localizedPath(locale, `/subscribe?status=${status}`), 303)
    }
    if (!limited.allowed) {
      if (wantsJson) {
        c.header('Retry-After', String(limited.retryAfterSeconds))
        return c.json({ success: false, error: { code: 'RATE_LIMITED', message: t('api.rateLimited') } }, 429)
      }
      return c.redirect(localizedPath(locale, '/subscribe?status=error'), 303)
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
        locale,
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
          locale,
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
