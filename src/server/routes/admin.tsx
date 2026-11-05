import type { ReactElement } from 'react'
import type { Context } from 'hono'
import type { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { getConfig, isProd } from '../../lib/config'
import { collectMediaIds, docToText, isDoc, makeExcerpt, parseDoc, readingMinutes, slugify } from '../../lib/content/doc'
import { createPreviewToken } from '../../lib/seo/preview-token'
import {
  csrfMatches,
  createSession,
  destroySession,
  getUserByEmail,
  SESSION_COOKIE,
  touchLogin,
  verifyPassword,
} from '../../lib/auth/session'
import { canEditArticle, canManageContent, canManageSettings } from '../../lib/auth/permissions'
import { rateLimit } from '../../lib/auth/rate-limit'
import {
  archiveArticle,
  createArticle,
  deleteArticle,
  getArticleById,
  getArticleTags,
  getDashboardStats,
  listAdminArticles,
  listRevisions,
  publishArticle,
  restoreRevision,
  scheduleArticle,
  unpublishArticle,
  uniqueArticleSlug,
  updateArticle,
} from '../../lib/db/queries/articles'
import {
  createTag,
  defaultSettings,
  deleteAuthor,
  deleteCategory,
  deleteTag,
  getAuthorById,
  getAuthorBySlug,
  getAuthorForUser,
  getCategoryById,
  getCategoryBySlug,
  getSiteSettings,
  getTagById,
  getTagBySlug,
  listAuthors,
  listCategories,
  listTags,
  saveSiteSettings,
  updateTag,
  upsertAuthor,
  upsertCategory,
} from '../../lib/db/queries/taxonomy'
import {
  countMedia,
  deleteMedia,
  getMediaById,
  getMediaReferences,
  listMedia,
  mediaUsage,
  updateMedia,
} from '../../lib/db/queries/media'
import { exportSubscribersCsv, listSubscribers, subscriberStats } from '../../lib/db/queries/subscribers'
import { parseScheduleDate, articlePayloadSchema, authorInputSchema, categoryInputSchema, loginSchema, mediaPatchSchema, settingsInputSchema, tagInputSchema, validHttpUrl } from '../../lib/validation/admin'
import { deleteStoredFiles, MAX_UPLOAD_BYTES, saveUpload, sniffImage } from '../../lib/media/storage'
import { baseHead } from '../head'
import { renderPageResponse } from '../render-page'
import type { AppEnv } from '../types'
import { ArticleEditorPage, MediaLibraryPage, articleToEditorState } from '../../pages/admin/editor-shell'
import { ArticleListPage, DashboardPage, RevisionsPage } from '../../pages/admin/dashboard'
import { LoginPage } from '../../pages/admin/login'
import { SettingsPage, SubscribersPage } from '../../pages/admin/settings'
import { AuthorsPage, AuthorEditPage, CategoryEditPage, CategoriesPage, TagEditPage, TagsPage } from '../../pages/admin/taxonomy'
import type { Flash } from '../../pages/admin/shared'

const LOGIN_CSRF_COOKIE = 'login_csrf'
const PAGE_SIZE = 30

let dummyPasswordHash: string | null = null
async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await Bun.password.hash('commonplace-dummy-credential', { algorithm: 'argon2id' })
  }
  return dummyPasswordHash
}

const FLASH_MESSAGES: Record<string, Flash> = {
  saved: { tone: 'success', message: 'Saved.' },
  created: { tone: 'success', message: 'Created.' },
  deleted: { tone: 'success', message: 'Deleted.' },
  restored: { tone: 'success', message: 'Revision restored.' },
  published: { tone: 'success', message: 'Article published.' },
  scheduled: { tone: 'success', message: 'Article scheduled.' },
  unpublished: { tone: 'success', message: 'Article returned to draft.' },
  archived: { tone: 'success', message: 'Article archived.' },
  'error': { tone: 'error', message: 'That action could not be completed.' },
  'error-slug': { tone: 'error', message: 'That slug is already in use.' },
  'error-fields': { tone: 'error', message: 'Please check the form fields and try again.' },
  'error-in-use': { tone: 'error', message: 'That image is still used by an article or author and cannot be deleted.' },
  'error-has-articles': { tone: 'error', message: 'This author still has articles. Reassign or delete them first.' },
  'error-csrf': { tone: 'error', message: 'The form expired. Please try again.' },
  'error-conflict': { tone: 'error', message: 'This article changed elsewhere. Reload before saving again.' },
}

function flashFrom(c: Context<AppEnv>): Flash {
  const code = c.req.query('flash')
  return code ? FLASH_MESSAGES[code] ?? null : null
}

function clientIp(c: Context<AppEnv>): string {
  try {
    const info = getConnInfo(c)
    return info.remote.address ?? 'unknown'
  } catch {
    return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  }
}

function pageParam(raw: string | undefined): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

async function renderAdminPage(
  c: Context<AppEnv>,
  element: ReactElement,
  entry: 'admin' | 'admin-common' = 'admin-common',
): Promise<Response> {
  const settings = await getSiteSettings().catch(() => defaultSettings)
  const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
  return renderPageResponse(c, {
    element,
    entry,
    head: baseHead({
      settings,
      origin,
      title: 'Editorial desk',
      description: 'Private editorial tools.',
      path: c.req.path,
      robots: 'noindex, nofollow',
    }),
  })
}

function formCsrfOk(session: { csrfToken: string }, body: Record<string, unknown>): boolean {
  return csrfMatches(session.csrfToken, typeof body._csrf === 'string' ? body._csrf : '')
}

async function parseBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.parseBody()
    return body as Record<string, unknown>
  } catch {
    return {}
  }
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function checkbox(value: unknown): boolean {
  return value === 'on' || value === 'true' || value === '1'
}

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  /* ------------------------------------------------------------------ *
   *  Guards
   * ------------------------------------------------------------------ */

  const pageGuard = async (c: Context<AppEnv>, next: () => Promise<void>) => {
    if (c.req.path === '/admin/login') return next()
    if (!c.get('user')) {
      const nextPath = c.req.path + (new URL(c.req.url).search || '')
      return c.redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`)
    }
    await next()
  }

  app.use('/admin', pageGuard)
  app.use('/admin/*', pageGuard)

  app.use('/api/admin/*', async (c, next) => {
    if (!c.get('user')) return c.json({ error: 'Unauthorized' }, 401)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const session = c.get('session')
      if (!session || !csrfMatches(session.csrfToken, c.req.header('x-csrf-token'))) {
        return c.json({ error: 'Invalid CSRF token' }, 403)
      }
    }
    await next()
  })

  /* ------------------------------------------------------------------ *
   *  Authentication
   * ------------------------------------------------------------------ */

  app.get('/admin/login', async (c) => {
    if (c.get('user')) return c.redirect('/admin')
    const settings = await getSiteSettings().catch(() => defaultSettings)
    const existing = getCookie(c, LOGIN_CSRF_COOKIE)
    const csrf = existing || crypto.randomUUID().replace(/-/g, '')
    setCookie(c, LOGIN_CSRF_COOKIE, csrf, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/admin',
      maxAge: 900,
      secure: isProd(),
    })
    return renderPageResponse(c, {
      element: (
        <LoginPage
          settings={settings}
          csrf={csrf}
          next={c.req.query('next')}
        />
      ),
      entry: 'admin-common',
      head: baseHead({
        settings,
        origin: getConfig().PUBLIC_ORIGIN.replace(/\/$/, ''),
        title: 'Sign in',
        description: 'Editorial sign in.',
        path: '/admin/login',
        robots: 'noindex, nofollow',
      }),
    })
  })

  app.post('/admin/login', async (c) => {
    const settings = await getSiteSettings().catch(() => defaultSettings)
    const body = await parseBody(c)
    const email = text(body.email).trim().toLowerCase()
    const password = text(body.password)
    const next = text(body.next, '/admin')
    const csrfCookie = getCookie(c, LOGIN_CSRF_COOKIE)
    const renderError = (message: string, status: number) => {
      const csrf = csrfCookie || ''
      return renderPageResponse(c, {
        element: (
          <LoginPage
            settings={settings}
            csrf={csrf}
            email={email}
            error={message}
            next={next.startsWith('/admin') ? next : undefined}
          />
        ),
        entry: 'admin-common',
        status,
        head: baseHead({
          settings,
          origin: getConfig().PUBLIC_ORIGIN.replace(/\/$/, ''),
          title: 'Sign in',
          description: 'Editorial sign in.',
          path: '/admin/login',
          robots: 'noindex, nofollow',
        }),
      })
    }

    if (!csrfCookie || !csrfMatches(csrfCookie, text(body._csrf))) {
      return renderError('The sign-in form expired. Please try again.', 403)
    }

    const ip = clientIp(c)
    const limit = rateLimit(`login:${ip}:${email}`, 5, 15 * 60 * 1000)
    if (!limit.allowed) {
      return renderError('Too many sign-in attempts. Please wait a few minutes and try again.', 429)
    }

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      return renderError('Enter a valid email address and password.', 400)
    }

    const user = await getUserByEmail(email)
    // Always perform an Argon2 verification, even for unknown addresses, so the
    // response time does not reveal whether an account exists.
    const validPassword = await verifyPassword(password, user?.passwordHash ?? (await getDummyPasswordHash()))
    if (!user || !validPassword || !user.active) {
      return renderError('Those credentials do not match an active account.', 401)
    }

    await touchLogin(user.id)
    const { token } = await createSession(user.id, {
      userAgent: c.req.header('user-agent'),
      ip,
    })
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      secure: isProd(),
    })
    deleteCookie(c, LOGIN_CSRF_COOKIE, { path: '/admin' })

    const destination = next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'
    return c.redirect(destination, 303)
  })

  app.post('/admin/logout', async (c) => {
    const session = c.get('session')
    const body = await parseBody(c)
    if (!session || !formCsrfOk(session, body)) {
      return c.redirect('/admin/login?flash=error-csrf', 303)
    }
    await destroySession(getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.redirect('/admin/login', 303)
  })

  /* ------------------------------------------------------------------ *
   *  Dashboard
   * ------------------------------------------------------------------ */

  app.get('/admin', async (c) => {
    const user = c.get('user')!
    const settings = await getSiteSettings()
    const [stats, recentRows, draftRows, scheduledRows, categories, subs] = await Promise.all([
      getDashboardStats(),
      listAdminArticles({ limit: 6 }),
      listAdminArticles({ status: 'draft', limit: 5 }),
      listAdminArticles({ status: 'scheduled', limit: 5 }),
      listCategories({ withCounts: true }),
      subscriberStats(),
    ])
    return renderAdminPage(
      c,
      <DashboardPage
        user={user}
        settings={settings}
        stats={stats}
        recent={recentRows.items}
        drafts={draftRows.items}
        scheduled={scheduledRows.items}
        categories={categories}
        subscriberCount={subs.subscribed}
        csrfToken={c.get('session')!.csrfToken}
      />,
    )
  })

  /* ------------------------------------------------------------------ *
   *  Articles
   * ------------------------------------------------------------------ */

  app.get('/admin/articles', async (c) => {
    const user = c.get('user')!
    const ownAuthor = await getAuthorForUser(user.id)
    const page = pageParam(c.req.query('page'))
    const statusRaw = c.req.query('status') ?? 'all'
    const status = (['all', 'draft', 'published', 'scheduled', 'archived'] as const).includes(statusRaw as never)
      ? (statusRaw as 'all' | 'draft' | 'published' | 'scheduled' | 'archived')
      : 'all'
    const authorId = user.role === 'author' ? ownAuthor?.id : c.req.query('author') || undefined
    const filters = {
      status,
      authorId,
      categoryId: c.req.query('category') || undefined,
      q: c.req.query('q')?.trim() || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }
    const [result, categories, authors] = await Promise.all([
      listAdminArticles(filters),
      listCategories({ withCounts: true }),
      listAuthors(),
    ])
    const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    return renderAdminPage(
      c,
      <ArticleListPage
        user={user}
        articles={result.items.map(({ article, author, category }) => ({ article, author, category }))}
        total={result.total}
        page={page}
        totalPages={totalPages}
        filters={filters}
        categories={categories}
        authors={authors}
        session={c.get('session')!}
        flash={flashFrom(c)}
      />,
    )
  })

  app.get('/admin/articles/new', async (c) => {
    const user = c.get('user')!
    const ownAuthor = await getAuthorForUser(user.id)
    const [categories, authors, tags, media] = await Promise.all([
      listCategories({ withCounts: true }),
      listAuthors(),
      listTags({ withCounts: true }),
      listMedia({ limit: 60 }),
    ])
    return renderAdminPage(
      c,
      <ArticleEditorPage
        categories={categories}
        authors={authors}
        tags={tags}
        media={media}
        csrfToken={c.get('session')!.csrfToken}
        article={null}
        previewToken={null}
        defaultAuthorId={ownAuthor?.id ?? authors[0]?.id ?? null}
        origin={getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')}
      />,
      'admin',
    )
  })

  app.get('/admin/articles/:id/edit', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.notFound()
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) {
      return renderPageResponse(c, {
        element: <div style={{ padding: '2rem' }}><h1>Not your article</h1><p>You can only edit pieces you authored.</p><a href="/admin/articles">Back</a></div>,
        entry: 'admin-common',
        status: 403,
        head: {
          title: 'Forbidden',
          description: '',
          canonicalPath: c.req.path,
          robots: 'noindex, nofollow',
          siteName: 'RhandytaVERSE',
          origin: getConfig().PUBLIC_ORIGIN,
          jsonLd: [],
        },
      })
    }
    const [categories, authors, tags, media, articleTags] = await Promise.all([
      listCategories({ withCounts: true }),
      listAuthors(),
      listTags({ withCounts: true }),
      listMedia({ limit: 100 }),
      getArticleTags(article.id),
    ])
    // Make sure images used in the body are available to the editor even when
    // they are older than the most recent 100 library items.
    const presentMediaIds = new Set(media.map((asset) => asset.id))
    const missingMediaIds = collectMediaIds(parseDoc(article.bodyJson)).filter((id) => !presentMediaIds.has(id))
    const extraMedia = []
    for (const mediaId of missingMediaIds) {
      const asset = await getMediaById(mediaId)
      if (asset) extraMedia.push(asset)
    }
    const editorMedia = [...media, ...extraMedia]
    return renderAdminPage(
      c,
      <ArticleEditorPage
        categories={categories}
        authors={authors}
        tags={tags}
        media={editorMedia}
        csrfToken={c.get('session')!.csrfToken}
        article={articleToEditorState({ article, tags: articleTags.map((tag) => tag.id) })}
        previewToken={createPreviewToken(article.id)}
        defaultAuthorId={ownAuthor?.id ?? authors[0]?.id ?? null}
        origin={getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')}
      />,
      'admin',
    )
  })

  app.post('/admin/articles/:id/delete', async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const body = await parseBody(c)
    if (!formCsrfOk(session, body)) return c.redirect('/admin/articles?flash=error-csrf', 303)
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.notFound()
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) {
      return c.redirect('/admin/articles?flash=error', 303)
    }
    await deleteArticle(article.id)
    return c.redirect('/admin/articles?flash=deleted', 303)
  })

  app.get('/admin/articles/:id/revisions', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.notFound()
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.redirect('/admin/articles?flash=error', 303)
    const revisions = await listRevisions(article.id)
    return renderAdminPage(
      c,
      <RevisionsPage
        user={user}
        article={article}
        revisions={revisions.map((revision) => ({
          id: revision.id,
          title: revision.title,
          note: revision.note,
          createdAt: revision.createdAt,
        }))}
        session={c.get('session')!}
        flash={flashFrom(c)}
      />,
    )
  })

  app.post('/admin/articles/:id/revisions/:revisionId/restore', async (c) => {
    const user = c.get('user')!
    const session = c.get('session')!
    const body = await parseBody(c)
    if (!formCsrfOk(session, body)) return c.redirect('/admin/articles?flash=error-csrf', 303)
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.notFound()
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.redirect('/admin/articles?flash=error', 303)
    const restored = await restoreRevision(article.id, c.req.param('revisionId'), user.id)
    return c.redirect(
      `/admin/articles/${article.id}/revisions?flash=${restored ? 'restored' : 'error'}`,
      303,
    )
  })

  /* ------------------------------------------------------------------ *
   *  Article JSON API (editor)
   * ------------------------------------------------------------------ */

  async function resolveArticleFields(
    c: Context<AppEnv>,
    payload: ReturnType<typeof articlePayloadSchema.parse>,
    existing?: { id: string; status: string; publishedAt: string | null; scheduledFor: string | null } | null,
  ) {
    const user = c.get('user')!
    if (!isDoc(payload.body)) {
      return { error: 'The article body is not a valid document.', status: 400 as const }
    }
    const bodyText = docToText(payload.body)
    const slugBase = slugify(payload.slug || payload.title)
    const slug = await uniqueArticleSlug(slugBase, existing?.id)
    const ownAuthor = await getAuthorForUser(user.id)

    let authorId = ownAuthor?.id ?? null
    if (user.role !== 'author') {
      if (payload.authorId) {
        const author = await getAuthorById(payload.authorId)
        if (!author) return { error: 'Unknown author.', status: 400 as const }
        authorId = author.id
      }
      if (!authorId) {
        const authors = await listAuthors()
        authorId = authors[0]?.id ?? null
      }
    }
    if (!authorId) return { error: 'No author profile is available for this account.', status: 400 as const }

    if (payload.categoryId) {
      const category = await getCategoryById(payload.categoryId)
      if (!category) return { error: 'Unknown section.', status: 400 as const }
    }
    if (payload.featuredMediaId) {
      const media = await getMediaById(payload.featuredMediaId)
      if (!media) return { error: 'Unknown featured image.', status: 400 as const }
    }
    if (payload.ogMediaId) {
      const media = await getMediaById(payload.ogMediaId)
      if (!media) return { error: 'Unknown social image.', status: 400 as const }
    }
    if (payload.canonicalUrl && !validHttpUrl(payload.canonicalUrl)) {
      return { error: 'The canonical URL must be a valid http(s) address.', status: 400 as const }
    }
    const tagIds = payload.tagIds ?? []
    if (tagIds.length) {
      const known = new Set((await listTags({ limit: 500 })).map((tag) => tag.id))
      if (tagIds.some((id) => !known.has(id))) return { error: 'Unknown tag.', status: 400 as const }
    }

    let status = existing?.status ?? 'draft'
    let publishedAt = existing?.publishedAt ?? null
    let scheduledFor = existing?.scheduledFor ?? null
    if (payload.status === 'published' && status !== 'published') {
      status = 'published'
      publishedAt = new Date().toISOString()
      scheduledFor = null
    }

    return {
      fields: {
        slug,
        title: payload.title,
        subtitle: payload.subtitle?.trim() || null,
        excerpt: payload.excerpt?.trim() || makeExcerpt(bodyText, 200),
        bodyJson: JSON.stringify(payload.body),
        bodyText,
        readingMinutes: readingMinutes(bodyText),
        status: status as 'draft' | 'scheduled' | 'published' | 'archived',
        authorId,
        categoryId: payload.categoryId || null,
        featuredMediaId: payload.featuredMediaId || null,
        featuredCaption: payload.featuredCaption?.trim() || null,
        isFeatured: payload.isFeatured ?? false,
        featuredRank: payload.featuredRank ?? null,
        isEditorsPick: payload.isEditorsPick ?? false,
        seoTitle: payload.seoTitle?.trim() || null,
        seoDescription: payload.seoDescription?.trim() || null,
        canonicalUrl: payload.canonicalUrl?.trim() || null,
        ogMediaId: payload.ogMediaId || null,
        noIndex: payload.noIndex ?? false,
        isDemo: false,
        publishedAt,
        scheduledFor,
      },
      tagIds,
    }
  }

  function articleResponse(article: { id: string; slug: string; title: string; status: string; updatedAt: string; publishedAt: string | null; scheduledFor: string | null }) {
    return {
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        status: article.status,
        updatedAt: article.updatedAt,
        publishedAt: article.publishedAt,
        scheduledFor: article.scheduledFor,
      },
      previewToken: createPreviewToken(article.id),
    }
  }

  async function handleArticleSave(c: Context<AppEnv>, mode: 'create' | 'update' | 'autosave') {
    const user = c.get('user')!
    if (!canManageContent(user) && user.role !== 'author') return c.json({ error: 'Forbidden' }, 403)
    let json: unknown
    try {
      json = await c.req.json()
    } catch {
      return c.json({ error: 'Expected JSON' }, 400)
    }
    const parsed = articlePayloadSchema.safeParse(json)
    if (!parsed.success) {
      return c.json(
        {
          error: 'Validation failed',
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
        400,
      )
    }

    if (mode === 'create') {
      const resolved = await resolveArticleFields(c, parsed.data)
      if ('error' in resolved) return c.json({ error: resolved.error }, resolved.status)
      const article = await createArticle({
        id: crypto.randomUUID(),
        ...resolved.fields,
        tagIds: resolved.tagIds,
      } as Parameters<typeof createArticle>[0])
      if (!article) return c.json({ error: 'Could not create the article.' }, 500)
      return c.json(articleResponse(article), 201)
    }

    const existing = await getArticleById(c.req.param('id') ?? '')
    if (!existing) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, existing, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)

    if (mode !== 'autosave' && parsed.data.updatedAt && parsed.data.updatedAt !== existing.updatedAt) {
      return c.json({ error: 'conflict', article: { updatedAt: existing.updatedAt } }, 409)
    }

    const resolved = await resolveArticleFields(c, parsed.data, existing)
    if ('error' in resolved) return c.json({ error: resolved.error }, resolved.status)

    const article = await updateArticle(
      existing.id,
      resolved.fields,
      {
        tagIds: resolved.tagIds,
        actorId: mode === 'autosave' ? null : user.id,
        revisionNote: mode === 'autosave' ? undefined : 'Saved from the editor',
      },
    )
    if (!article) return c.json({ error: 'Could not save the article.' }, 500)
    return c.json(articleResponse(article))
  }

  app.post('/api/admin/articles', (c) => handleArticleSave(c, 'create'))
  app.put('/api/admin/articles/:id', (c) => handleArticleSave(c, 'update'))
  app.post('/api/admin/articles/:id/autosave', (c) => handleArticleSave(c, 'autosave'))

  app.delete('/api/admin/articles/:id', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)
    await deleteArticle(article.id)
    return c.json({ ok: true })
  })

  app.post('/api/admin/articles/:id/publish', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)
    const published = await publishArticle(article.id)
    if (!published) return c.json({ error: 'Could not publish.' }, 500)
    return c.json(articleResponse(published))
  })

  app.post('/api/admin/articles/:id/unpublish', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)
    const draft = await unpublishArticle(article.id)
    if (!draft) return c.json({ error: 'Could not unpublish.' }, 500)
    return c.json(articleResponse(draft))
  })

  app.post('/api/admin/articles/:id/archive', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)
    const archived = await archiveArticle(article.id)
    if (!archived) return c.json({ error: 'Could not archive.' }, 500)
    return c.json(articleResponse(archived))
  })

  app.post('/api/admin/articles/:id/schedule', async (c) => {
    const user = c.get('user')!
    const article = await getArticleById(c.req.param('id'))
    if (!article) return c.json({ error: 'Not found' }, 404)
    const ownAuthor = await getAuthorForUser(user.id)
    if (!canEditArticle(user, article, ownAuthor?.id)) return c.json({ error: 'Forbidden' }, 403)
    let payload: { scheduledFor?: unknown }
    try {
      payload = (await c.req.json()) as { scheduledFor?: unknown }
    } catch {
      return c.json({ error: 'Expected JSON' }, 400)
    }
    const iso = parseScheduleDate(typeof payload.scheduledFor === 'string' ? payload.scheduledFor : '')
    if (!iso) return c.json({ error: 'Choose a valid date and time.' }, 400)
    const scheduled = await scheduleArticle(article.id, iso)
    if (!scheduled) return c.json({ error: 'Could not schedule.' }, 500)
    return c.json(articleResponse(scheduled))
  })

  /* ------------------------------------------------------------------ *
   *  Media
   * ------------------------------------------------------------------ */

  app.get('/admin/media', async (c) => {
    const user = c.get('user')!
    const media = await listMedia({ limit: 100 })
    const settings = await getSiteSettings()
    return renderAdminPage(
      c,
      <MediaLibraryPage
        user={user}
        settings={settings}
        media={media}
        csrfToken={c.get('session')!.csrfToken}
        flash={flashFrom(c)}
      />,
      'admin',
    )
  })

  app.get('/api/admin/media', async (c) => {
    const media = await listMedia({ q: c.req.query('q') || undefined, limit: 100 })
    return c.json({
      media: media.map((asset) => ({
        id: asset.id,
        src: asset.src,
        alt: asset.alt,
        caption: asset.caption,
        width: asset.width,
        height: asset.height,
        originalName: asset.originalName,
        createdAt: asset.createdAt,
      })),
      total: await countMedia(),
    })
  })

  app.post('/api/admin/media', async (c) => {
    const user = c.get('user')!
    let body: Record<string, unknown>
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>
    } catch {
      return c.json({ error: 'Upload could not be read.' }, 400)
    }
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: 'Choose an image file.' }, 400)
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'Images must be 8 MB or smaller.' }, 400)
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!sniffImage(buffer)) return c.json({ error: 'That file is not a supported image.' }, 400)
    try {
      const media = await saveUpload(buffer, {
        originalName: file.name.slice(0, 200),
        alt: text(body.alt).slice(0, 300),
        caption: text(body.caption).slice(0, 400) || null,
        uploadedBy: user.id,
        allowSvg: false,
      })
      if (!media) throw new Error('Image could not be stored')
      return c.json(
        {
          media: {
            id: media.id,
            src: media.src,
            alt: media.alt,
            caption: media.caption,
            width: media.width,
            height: media.height,
            originalName: media.originalName,
            createdAt: media.createdAt,
          },
        },
        201,
      )
    } catch (error) {
      console.error('[media] upload failed', error)
      return c.json({ error: 'The image could not be processed.' }, 400)
    }
  })

  app.patch('/api/admin/media/:id', async (c) => {
    const parsed = mediaPatchSchema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: 'Invalid media details.' }, 400)
    const ok = await updateMedia(c.req.param('id'), {
      ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt } : {}),
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.originalName !== undefined ? { originalName: parsed.data.originalName } : {}),
    })
    if (!ok) return c.json({ error: 'Not found.' }, 404)
    return c.json({ ok: true })
  })

  app.delete('/api/admin/media/:id', async (c) => {
    const asset = await getMediaById(c.req.param('id'))
    if (!asset) return c.json({ error: 'Not found.' }, 404)
    const usage = await mediaUsage(asset.id)
    if (usage.articles > 0 || usage.authors > 0 || usage.settings > 0) {
      const references = await getMediaReferences(asset.id)
      return c.json(
        { error: 'This image is still in use.', references },
        409,
      )
    }
    await deleteStoredFiles(asset)
    await deleteMedia(asset.id)
    return c.json({ ok: true })
  })

  /* ------------------------------------------------------------------ *
   *  Categories
   * ------------------------------------------------------------------ */

  app.get('/admin/categories', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const categories = await listCategories({ withCounts: true })
    return renderAdminPage(
      c,
      <CategoriesPage user={user} categories={categories} session={c.get('session')!} flash={flashFrom(c)} />,
    )
  })

  app.post('/admin/categories', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/categories?flash=error-csrf', 303)
    const parsed = categoryInputSchema.safeParse({
      name: text(body.name),
      slug: text(body.slug),
      description: text(body.description),
      intro: text(body.intro),
      accent: text(body.accent),
      sortOrder: text(body.sortOrder, '0'),
    })
    if (!parsed.success) return c.redirect('/admin/categories?flash=error-fields', 303)
    const slug = slugify(parsed.data.slug || parsed.data.name)
    const existing = await getCategoryBySlug(slug)
    if (existing) return c.redirect('/admin/categories?flash=error-slug', 303)
    await upsertCategory({
      id: crypto.randomUUID(),
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      intro: parsed.data.intro,
      accent: parsed.data.accent,
      sortOrder: parsed.data.sortOrder,
    })
    return c.redirect('/admin/categories?flash=created', 303)
  })

  app.get('/admin/categories/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const category = await getCategoryById(c.req.param('id'))
    if (!category) return c.notFound()
    return renderAdminPage(
      c,
      <CategoryEditPage user={user} category={category} session={c.get('session')!} flash={flashFrom(c)} />,
    )
  })

  app.post('/admin/categories/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/categories?flash=error-csrf', 303)
    const category = await getCategoryById(c.req.param('id'))
    if (!category) return c.notFound()
    const parsed = categoryInputSchema.safeParse({
      name: text(body.name),
      slug: text(body.slug),
      description: text(body.description),
      intro: text(body.intro),
      accent: text(body.accent),
      sortOrder: text(body.sortOrder, '0'),
    })
    if (!parsed.success) return c.redirect(`/admin/categories/${category.id}?flash=error-fields`, 303)
    const slug = slugify(parsed.data.slug || parsed.data.name)
    const conflict = await getCategoryBySlug(slug)
    if (conflict && conflict.id !== category.id) return c.redirect(`/admin/categories/${category.id}?flash=error-slug`, 303)
    await upsertCategory({
      id: category.id,
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      intro: parsed.data.intro,
      accent: parsed.data.accent,
      sortOrder: parsed.data.sortOrder,
    })
    return c.redirect(`/admin/categories/${category.id}?flash=saved`, 303)
  })

  app.post('/admin/categories/:id/delete', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/categories?flash=error-csrf', 303)
    const category = await getCategoryById(c.req.param('id'))
    if (!category) return c.notFound()
    await deleteCategory(category.id)
    return c.redirect('/admin/categories?flash=deleted', 303)
  })

  /* ------------------------------------------------------------------ *
   *  Tags
   * ------------------------------------------------------------------ */

  app.get('/admin/tags', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const tags = await listTags({ withCounts: true })
    return renderAdminPage(c, <TagsPage user={user} tags={tags} session={c.get('session')!} flash={flashFrom(c)} />)
  })

  app.post('/admin/tags', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/tags?flash=error-csrf', 303)
    const parsed = tagInputSchema.safeParse({
      name: text(body.name),
      slug: text(body.slug),
      description: text(body.description),
    })
    if (!parsed.success) return c.redirect('/admin/tags?flash=error-fields', 303)
    const slug = slugify(parsed.data.slug || parsed.data.name)
    if (await getTagBySlug(slug)) return c.redirect('/admin/tags?flash=error-slug', 303)
    await createTag({
      id: crypto.randomUUID(),
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    return c.redirect('/admin/tags?flash=created', 303)
  })

  app.get('/admin/tags/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const tag = await getTagById(c.req.param('id'))
    if (!tag) return c.notFound()
    return renderAdminPage(c, <TagEditPage user={user} tag={tag} session={c.get('session')!} flash={flashFrom(c)} />)
  })

  app.post('/admin/tags/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/tags?flash=error-csrf', 303)
    const tag = await getTagById(c.req.param('id'))
    if (!tag) return c.notFound()
    const parsed = tagInputSchema.safeParse({ name: text(body.name), slug: text(body.slug), description: text(body.description) })
    if (!parsed.success) return c.redirect(`/admin/tags/${tag.id}?flash=error-fields`, 303)
    const slug = slugify(parsed.data.slug || parsed.data.name)
    const conflict = await getTagBySlug(slug)
    if (conflict && conflict.id !== tag.id) return c.redirect(`/admin/tags/${tag.id}?flash=error-slug`, 303)
    await updateTag(tag.id, { slug, name: parsed.data.name, description: parsed.data.description })
    return c.redirect(`/admin/tags/${tag.id}?flash=saved`, 303)
  })

  app.post('/admin/tags/:id/delete', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/tags?flash=error-csrf', 303)
    const tag = await getTagById(c.req.param('id'))
    if (!tag) return c.notFound()
    await deleteTag(tag.id)
    return c.redirect('/admin/tags?flash=deleted', 303)
  })

  /* ------------------------------------------------------------------ *
   *  Authors
   * ------------------------------------------------------------------ */

  app.get('/admin/authors', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const authors = await listAuthors({ withCounts: true })
    return renderAdminPage(c, <AuthorsPage user={user} authors={authors} session={c.get('session')!} flash={flashFrom(c)} />)
  })

  function authorFormValues(body: Record<string, unknown>) {
    return {
      displayName: text(body.displayName),
      slug: text(body.slug),
      roleTitle: text(body.roleTitle),
      bio: text(body.bio),
      longBio: text(body.longBio),
      expertise: text(body.expertise),
      website: text(body.website),
    }
  }

  function authorPayload(parsed: ReturnType<typeof authorInputSchema.parse>) {
    const expertise = parsed.expertise
      ? parsed.expertise.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : []
    const socialLinks: Record<string, string> = {}
    if (parsed.website) socialLinks.website = parsed.website
    return {
      displayName: parsed.displayName,
      roleTitle: parsed.roleTitle || null,
      bio: parsed.bio ?? '',
      longBio: parsed.longBio || null,
      expertise,
      socialLinks,
    }
  }

  app.post('/admin/authors', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/authors?flash=error-csrf', 303)
    const parsed = authorInputSchema.safeParse(authorFormValues(body))
    if (!parsed.success) return c.redirect('/admin/authors?flash=error-fields', 303)
    const slug = slugify(parsed.data.slug || parsed.data.displayName)
    if (await getAuthorBySlug(slug)) return c.redirect('/admin/authors?flash=error-slug', 303)
    await upsertAuthor({
      id: crypto.randomUUID(),
      slug,
      ...authorPayload(parsed.data),
      isDemo: false,
    })
    return c.redirect('/admin/authors?flash=created', 303)
  })

  app.get('/admin/authors/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const author = await getAuthorById(c.req.param('id'))
    if (!author) return c.notFound()
    return renderAdminPage(c, <AuthorEditPage user={user} author={author} session={c.get('session')!} flash={flashFrom(c)} />)
  })

  app.post('/admin/authors/:id', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/authors?flash=error-csrf', 303)
    const author = await getAuthorById(c.req.param('id'))
    if (!author) return c.notFound()
    const parsed = authorInputSchema.safeParse(authorFormValues(body))
    if (!parsed.success) return c.redirect(`/admin/authors/${author.id}?flash=error-fields`, 303)
    const slug = slugify(parsed.data.slug || parsed.data.displayName)
    const conflict = await getAuthorBySlug(slug)
    if (conflict && conflict.id !== author.id) return c.redirect(`/admin/authors/${author.id}?flash=error-slug`, 303)
    await upsertAuthor({ id: author.id, slug, ...authorPayload(parsed.data) })
    return c.redirect(`/admin/authors/${author.id}?flash=saved`, 303)
  })

  app.post('/admin/authors/:id/delete', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/authors?flash=error-csrf', 303)
    const author = await getAuthorById(c.req.param('id'))
    if (!author) return c.notFound()
    const result = await deleteAuthor(author.id)
    return c.redirect(`/admin/authors?flash=${result.ok ? 'deleted' : 'error-has-articles'}`, 303)
  })

  /* ------------------------------------------------------------------ *
   *  Subscribers & settings
   * ------------------------------------------------------------------ */

  app.get('/admin/subscribers', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.redirect('/admin?flash=error', 303)
    const page = pageParam(c.req.query('page'))
    const statusRaw = c.req.query('status') ?? 'all'
    const status = statusRaw === 'subscribed' || statusRaw === 'unsubscribed' ? statusRaw : 'all'
    const [result, stats] = await Promise.all([
      listSubscribers({
        q: c.req.query('q')?.trim() || undefined,
        status,
        limit: 50,
        offset: (page - 1) * 50,
      }),
      subscriberStats(),
    ])
    const totalPages = Math.max(1, Math.ceil(result.total / 50))
    return renderAdminPage(
      c,
      <SubscribersPage
        user={user}
        subscribers={result.items}
        total={result.total}
        stats={stats}
        page={page}
        totalPages={totalPages}
        q={c.req.query('q')?.trim()}
        status={status}
        flash={flashFrom(c)}
        csrfToken={c.get('session')!.csrfToken}
      />,
    )
  })

  app.get('/admin/subscribers.csv', async (c) => {
    const user = c.get('user')!
    if (!canManageContent(user)) return c.text('Forbidden', 403)
    const csv = await exportSubscribersCsv()
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', 'attachment; filename="rhandytaverse-subscribers.csv"')
    return c.body(csv)
  })

  app.get('/admin/settings', async (c) => {
    const user = c.get('user')!
    if (!canManageSettings(user)) return c.redirect('/admin?flash=error', 303)
    const settings = await getSiteSettings()
    return renderAdminPage(c, <SettingsPage user={user} settings={settings} session={c.get('session')!} flash={flashFrom(c)} />)
  })

  app.post('/admin/settings', async (c) => {
    const user = c.get('user')!
    if (!canManageSettings(user)) return c.redirect('/admin?flash=error', 303)
    const body = await parseBody(c)
    if (!formCsrfOk(c.get('session')!, body)) return c.redirect('/admin/settings?flash=error-csrf', 303)
    const parsed = settingsInputSchema.safeParse({
      title: text(body.title),
      issue: text(body.issue),
      tagline: text(body.tagline),
      description: text(body.description),
      intro: text(body.intro),
      manifesto: text(body.manifesto),
      manifestoBy: text(body.manifestoBy),
      about: text(body.about),
      newsletterTitle: text(body.newsletterTitle),
      newsletterBlurb: text(body.newsletterBlurb),
      email: text(body.email),
      x: text(body.x),
      github: text(body.github),
      linkedin: text(body.linkedin),
    })
    if (!parsed.success) return c.redirect('/admin/settings?flash=error-fields', 303)
    await saveSiteSettings(parsed.data)
    return c.redirect('/admin/settings?flash=saved', 303)
  })

  /* ------------------------------------------------------------------ *
   *  Misc
   * ------------------------------------------------------------------ */

  app.get('/api/admin/session', (c) => {
    const user = c.get('user')!
    return c.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      csrfToken: c.get('session')!.csrfToken,
    })
  })
}
