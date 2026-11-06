import { and, asc, count, desc, eq, inArray, isNotNull, like, lte, notInArray, or, sql } from 'drizzle-orm'
import type { MediaInfo } from '../../content/doc'
import { all, exec, get, getDb, hasFts5, run } from '../client'
import {
  articleReaders,
  articleRevisions,
  articleTags,
  articleViews,
  articleVisits,
  articles,
  authors,
  categories,
  media,
  subscribers,
  tags,
  type Article,
  type Author,
  type Category,
  type MediaAsset,
  type Tag,
} from '../schema'
import { getMediaById, getMediaMap } from './media'
import { isoDay } from '../../content/html'

export type AuthorSummary = {
  id: string
  slug: string
  displayName: string
  roleTitle: string | null
  bio: string
  avatarMediaId: string | null
  isDemo: boolean
}

export type CategorySummary = {
  id: string
  slug: string
  name: string
  accent: string
  description: string
}

export type ArticleCard = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string
  publishedAt: string | null
  readingMinutes: number
  isDemo: boolean
  isFeatured: boolean
  isEditorsPick: boolean
  noIndex: boolean
  author: AuthorSummary | null
  category: CategorySummary | null
  media: MediaInfo | null
}

export type ArticleDetail = {
  article: Article
  author: Author | null
  category: Category | null
  featuredMedia: MediaAsset | null
  ogMedia: MediaAsset | null
  tags: Tag[]
}

export type CardRow = { article: Article; author: Author | null; category: Category | null }

function summaryAuthor(author: Author | null): AuthorSummary | null {
  if (!author) return null
  return {
    id: author.id,
    slug: author.slug,
    displayName: author.displayName,
    roleTitle: author.roleTitle,
    bio: author.bio,
    avatarMediaId: author.avatarMediaId,
    isDemo: author.isDemo,
  }
}

function summaryCategory(category: Category | null): CategorySummary | null {
  if (!category) return null
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    accent: category.accent,
    description: category.description,
  }
}

export async function hydrateCards(rows: CardRow[]): Promise<ArticleCard[]> {
  const mediaMap = await getMediaMap(
    rows.map((row) => row.article.featuredMediaId).filter((id): id is string => Boolean(id)),
  )
  return rows.map(({ article, author, category }) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    readingMinutes: article.readingMinutes,
    isDemo: article.isDemo,
    isFeatured: article.isFeatured,
    isEditorsPick: article.isEditorsPick,
    noIndex: article.noIndex,
    author: summaryAuthor(author),
    category: summaryCategory(category),
    media: article.featuredMediaId ? mediaMap.get(article.featuredMediaId) ?? null : null,
  }))
}

const cardFrom = () =>
  getDb()
    .select({ article: articles, author: authors, category: categories })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))

function publishedCondition() {
  return and(eq(articles.status, 'published'), lte(articles.publishedAt, new Date().toISOString()))
}

export async function listPublished(options: {
  limit?: number
  offset?: number
  categoryId?: string
  authorId?: string
  excludeIds?: string[]
} = {}): Promise<ArticleCard[]> {
  const { limit = 10, offset = 0, categoryId, authorId, excludeIds } = options
  const conditions = [publishedCondition()]
  if (categoryId) conditions.push(eq(articles.categoryId, categoryId))
  if (authorId) conditions.push(eq(articles.authorId, authorId))
  if (excludeIds?.length) conditions.push(notInArray(articles.id, excludeIds))

  const rows = await cardFrom()
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset)
  return hydrateCards(rows)
}

export async function countPublished(options: { categoryId?: string; authorId?: string } = {}): Promise<number> {
  const conditions = [publishedCondition()]
  if (options.categoryId) conditions.push(eq(articles.categoryId, options.categoryId))
  if (options.authorId) conditions.push(eq(articles.authorId, options.authorId))
  const rows = await getDb()
    .select({ n: count() })
    .from(articles)
    .where(and(...conditions))
  return rows[0]?.n ?? 0
}

export async function getFeaturedArticle(): Promise<ArticleCard | null> {
  const rows = await cardFrom()
    .where(publishedCondition())
    .orderBy(desc(articles.isFeatured), asc(sql`coalesce(${articles.featuredRank}, 999)`), desc(articles.publishedAt))
    .limit(1)
  const cards = await hydrateCards(rows)
  return cards[0] ?? null
}

export async function listEditorsPicks(limit = 3): Promise<ArticleCard[]> {
  const rows = await cardFrom()
    .where(and(publishedCondition(), eq(articles.isEditorsPick, true)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
  return hydrateCards(rows)
}

export async function listFeatured(limit = 4): Promise<ArticleCard[]> {
  const rows = await cardFrom()
    .where(publishedCondition())
    .orderBy(desc(articles.isFeatured), asc(sql`coalesce(${articles.featuredRank}, 999)`), desc(articles.publishedAt))
    .limit(limit)
  return hydrateCards(rows)
}

export async function getArticleCardBySlug(slug: string): Promise<ArticleCard | null> {
  const rows = await cardFrom().where(and(eq(articles.slug, slug), publishedCondition())).limit(1)
  const cards = await hydrateCards(rows)
  return cards[0] ?? null
}

export async function listArticlesByTag(
  tagId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ArticleCard[]> {
  const { limit = 20, offset = 0 } = options
  const ids = await getDb()
    .select({ articleId: articleTags.articleId })
    .from(articleTags)
    .where(eq(articleTags.tagId, tagId))
  if (!ids.length) return []
  const rows = await cardFrom()
    .where(and(publishedCondition(), inArray(articles.id, ids.map((row) => row.articleId))))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset)
  return hydrateCards(rows)
}

export async function countArticlesByTag(tagId: string): Promise<number> {
  const ids = await getDb().select({ articleId: articleTags.articleId }).from(articleTags).where(eq(articleTags.tagId, tagId))
  if (!ids.length) return 0
  const rows = await getDb()
    .select({ n: count() })
    .from(articles)
    .where(and(publishedCondition(), inArray(articles.id, ids.map((row) => row.articleId))))
  return rows[0]?.n ?? 0
}

export async function getPublishedArticleDetail(slug: string): Promise<ArticleDetail | null> {
  const db = getDb()
  const rows = await db
    .select({ article: articles, author: authors, category: categories })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.article.publishedAt && row.article.publishedAt > new Date().toISOString()) return null
  return attachDetail(row.article, row.author, row.category)
}

export async function getArticleDetailById(id: string): Promise<ArticleDetail | null> {
  const rows = await getDb()
    .select({ article: articles, author: authors, category: categories })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return attachDetail(row.article, row.author, row.category)
}

async function attachDetail(
  article: Article,
  author: Author | null,
  category: Category | null,
): Promise<ArticleDetail> {
  const db = getDb()
  const articleTagRows = await db
    .select({ tag: tags })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, article.id))

  const [featuredMedia, ogMedia] = await Promise.all([
    article.featuredMediaId ? getMediaById(article.featuredMediaId) : Promise.resolve(undefined),
    article.ogMediaId ? getMediaById(article.ogMediaId) : Promise.resolve(undefined),
  ])

  return {
    article,
    author,
    category,
    featuredMedia: featuredMedia ?? null,
    ogMedia: ogMedia ?? null,
    tags: articleTagRows.map((row) => row.tag),
  }
}

export async function getRelatedArticles(
  article: Article,
  limit = 3,
): Promise<ArticleCard[]> {
  const db = getDb()
  const tagIds = (
    await db.select({ tagId: articleTags.tagId }).from(articleTags).where(eq(articleTags.articleId, article.id))
  ).map((row) => row.tagId)

  let ids: string[] = []
  if (tagIds.length) {
    const placeholders = tagIds.map(() => '?').join(', ')
    const rows = await all<{ id: string }>(
      `SELECT a.id AS id, COUNT(*) AS shared
       FROM articles a
       JOIN article_tags at ON at.article_id = a.id
       WHERE a.status = 'published' AND a.id != ? AND at.tag_id IN (${placeholders})
       GROUP BY a.id
       ORDER BY shared DESC, a.published_at DESC
       LIMIT ?`,
      [article.id, ...tagIds, limit],
    )
    ids = rows.map((row) => row.id)
  }

  if (ids.length < limit && article.categoryId) {
    const remaining = limit - ids.length
    const exclude = ids.length ? `AND id NOT IN (${ids.map(() => '?').join(', ')})` : ''
    const rows = await all<{ id: string }>(
      `SELECT id FROM articles
       WHERE status = 'published' AND id != ? AND category_id = ? ${exclude}
       ORDER BY published_at DESC LIMIT ?`,
      [article.id, article.categoryId, ...ids, remaining],
    )
    ids = [...ids, ...rows.map((row) => row.id)]
  }

  if (ids.length < limit) {
    const remaining = limit - ids.length
    const exclude = ids.length ? `AND id NOT IN (${ids.map(() => '?').join(', ')})` : ''
    const rows = await all<{ id: string }>(
      `SELECT id FROM articles
       WHERE status = 'published' AND id != ? ${exclude}
       ORDER BY published_at DESC LIMIT ?`,
      [article.id, ...ids, remaining],
    )
    ids = [...ids, ...rows.map((row) => row.id)]
  }

  if (!ids.length) return []
  const rows = await cardFrom()
    .where(and(publishedCondition(), inArray(articles.id, ids)))
    .limit(limit)
  const cards = await hydrateCards(rows)
  const order = new Map(ids.map((id, index) => [id, index]))
  return cards.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export async function getNeighbourArticles(article: Article): Promise<{
  previous: ArticleCard | null
  next: ArticleCard | null
}> {
  if (!article.publishedAt) return { previous: null, next: null }
  const db = getDb()
  const previousRows = await cardFrom()
    .where(and(publishedCondition(), sql`${articles.publishedAt} < ${article.publishedAt}`, sql`${articles.id} != ${article.id}`))
    .orderBy(desc(articles.publishedAt))
    .limit(1)
  const nextRows = await cardFrom()
    .where(and(publishedCondition(), sql`${articles.publishedAt} > ${article.publishedAt}`, sql`${articles.id} != ${article.id}`))
    .orderBy(asc(articles.publishedAt))
    .limit(1)
  const [previous, next] = await Promise.all([hydrateCards(previousRows), hydrateCards(nextRows)])
  return { previous: previous[0] ?? null, next: next[0] ?? null }
}

export type ArchiveEntry = {
  id: string
  slug: string
  title: string
  publishedAt: string
  categoryName: string | null
  categoryAccent: string | null
}

export async function getArchiveEntries(): Promise<ArchiveEntry[]> {
  const rows = await getDb()
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      publishedAt: articles.publishedAt,
      categoryName: categories.name,
      categoryAccent: categories.accent,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.status, 'published'), sql`${articles.publishedAt} IS NOT NULL`))
    .orderBy(desc(articles.publishedAt))
    .limit(500)
  return rows
    .filter((row): row is typeof row & { publishedAt: string } => Boolean(row.publishedAt))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt,
      categoryName: row.categoryName,
      categoryAccent: row.categoryAccent,
    }))
}

/* ------------------------------------------------------------------ *
 *  Views / popularity
 * ------------------------------------------------------------------ */

export type ArticleViewInput = {
  articleId: string
  visitorHash: string
  day: string
  bucket: string
  referrerHost: string | null
  country: string | null
  device: string
  browser: string
  os: string
}

export async function recordArticleView(input: ArticleViewInput): Promise<boolean> {
  const db = getDb()
  const now = new Date().toISOString()
  const inserted = await db
    .insert(articleVisits)
    .values({
      id: crypto.randomUUID(),
      articleId: input.articleId,
      visitorHash: input.visitorHash,
      day: input.day,
      bucket: input.bucket,
      createdAt: now,
      referrerHost: input.referrerHost,
      country: input.country,
      device: input.device,
      browser: input.browser,
      os: input.os,
    })
    .onConflictDoNothing({
      target: [articleVisits.articleId, articleVisits.visitorHash, articleVisits.bucket],
    })
    .returning({ id: articleVisits.id })
  if (!inserted.length) return false

  await db
    .insert(articleViews)
    .values({ articleId: input.articleId, day: input.day, count: 1 })
    .onConflictDoUpdate({
      target: [articleViews.articleId, articleViews.day],
      set: { count: sql`${articleViews.count} + 1` },
    })

  await db
    .insert(articleReaders)
    .values({
      articleId: input.articleId,
      visitorHash: input.visitorHash,
      firstSeenAt: now,
      lastSeenAt: now,
      visits: 1,
    })
    .onConflictDoUpdate({
      target: [articleReaders.articleId, articleReaders.visitorHash],
      set: {
        lastSeenAt: now,
        visits: sql`${articleReaders.visits} + 1`,
      },
    })

  return true
}

export type ArticleAudience = {
  views: number
  readers: number
}

export async function getArticleAudienceMap(
  articleIds: string[],
): Promise<Map<string, ArticleAudience>> {
  const ids = [...new Set(articleIds.filter(Boolean))]
  const audience = new Map<string, ArticleAudience>()
  for (const id of ids) audience.set(id, { views: 0, readers: 0 })
  if (!ids.length) return audience

  const placeholders = ids.map(() => '?').join(', ')
  const [views, readers] = await Promise.all([
    all<{ articleId: string; total: number }>(
      `SELECT article_id AS articleId, COALESCE(SUM(count), 0) AS total
       FROM article_views WHERE article_id IN (${placeholders})
       GROUP BY article_id`,
      ids,
    ),
    all<{ articleId: string; total: number }>(
      `SELECT article_id AS articleId, COUNT(*) AS total
       FROM article_readers WHERE article_id IN (${placeholders})
       GROUP BY article_id`,
      ids,
    ),
  ])

  for (const row of views) {
    const entry = audience.get(row.articleId)
    if (entry) entry.views = Number(row.total) || 0
  }
  for (const row of readers) {
    const entry = audience.get(row.articleId)
    if (entry) entry.readers = Number(row.total) || 0
  }
  return audience
}

export async function getMostRead(limit = 4, days = 14): Promise<ArticleCard[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const rows = await all<{ articleId: string; total: number }>(
    `SELECT article_id AS articleId, SUM(count) AS total
     FROM article_views WHERE day >= ?
     GROUP BY article_id ORDER BY total DESC LIMIT ?`,
    [since, limit],
  )
  if (!rows.length) return []
  const cards = await listPublishedByIds(rows.map((row) => row.articleId))
  const order = new Map(rows.map((row, index) => [row.articleId, index]))
  return cards.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export async function listPublishedByIds(ids: string[]): Promise<ArticleCard[]> {
  const cards = await getCardsByIds(ids)
  return cards.filter((card) => card.publishedAt && card.publishedAt <= new Date().toISOString())
}

export async function getCardsByIds(ids: string[]): Promise<ArticleCard[]> {
  if (!ids.length) return []
  const rows = await cardFrom().where(inArray(articles.id, ids))
  const cards = await hydrateCards(rows)
  const order = new Map(ids.map((id, index) => [id, index]))
  return cards.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export async function listRecentArticleTitles(limit = 12): Promise<string[]> {
  const rows = await getDb()
    .select({ title: articles.title })
    .from(articles)
    .orderBy(desc(articles.createdAt))
    .limit(limit)
  return rows.map((row) => row.title)
}

export async function getArticleBodyTexts(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await all<{ id: string; bodyText: string }>(
    `SELECT id, body_text AS bodyText FROM articles WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  )
  return new Map(rows.map((row) => [row.id, row.bodyText]))
}

/* ------------------------------------------------------------------ *
 *  Admin queries
 * ------------------------------------------------------------------ */

export type AdminFilters = {
  status?: Article['status'] | 'all'
  categoryId?: string
  authorId?: string
  q?: string
  limit?: number
  offset?: number
}

export async function listAdminArticles(filters: AdminFilters = {}): Promise<{
  items: Array<CardRow & { tags: Tag[]; audience: ArticleAudience }>
  total: number
}> {
  const { status = 'all', categoryId, authorId, q, limit = 30, offset = 0 } = filters
  const conditions = []
  if (status !== 'all') conditions.push(eq(articles.status, status))
  if (categoryId) conditions.push(eq(articles.categoryId, categoryId))
  if (authorId) conditions.push(eq(articles.authorId, authorId))
  if (q) conditions.push(or(like(articles.title, `%${q}%`), like(articles.slug, `%${q}%`))!)

  const where = conditions.length ? and(...conditions) : undefined
  const rows = await getDb()
    .select({ article: articles, author: authors, category: categories })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(where)
    .orderBy(desc(articles.updatedAt))
    .limit(limit)
    .offset(offset)

  const totals = await getDb()
    .select({ n: count() })
    .from(articles)
    .where(where)
  const audience = await getArticleAudienceMap(rows.map((row) => row.article.id))
  return {
    items: rows.map((row) => ({
      ...row,
      tags: [],
      audience: audience.get(row.article.id) ?? { views: 0, readers: 0 },
    })),
    total: totals[0]?.n ?? 0,
  }
}

export async function getArticleTags(articleId: string): Promise<Tag[]> {
  const rows = await getDb()
    .select({ tag: tags })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, articleId))
  return rows.map((row) => row.tag)
}

export async function getArticleById(id: string): Promise<Article | undefined> {
  const rows = await getDb().select().from(articles).where(eq(articles.id, id)).limit(1)
  return rows[0]
}

export async function getArticleBySlugAny(slug: string, excludeId?: string): Promise<Article | undefined> {
  const rows = await getDb()
    .select()
    .from(articles)
    .where(excludeId ? and(eq(articles.slug, slug), sql`${articles.id} != ${excludeId}`) : eq(articles.slug, slug))
    .limit(1)
  return rows[0]
}

export async function uniqueArticleSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base || 'untitled'
  let suffix = 2
  for (;;) {
    if (!(await getArticleBySlugAny(candidate, excludeId))) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export async function createArticle(input: {
  id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string
  bodyJson: string
  bodyText: string
  readingMinutes: number
  status: Article['status']
  authorId: string
  categoryId: string | null
  featuredMediaId: string | null
  featuredCaption: string | null
  isFeatured: boolean
  featuredRank: number | null
  isEditorsPick: boolean
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  ogMediaId: string | null
  noIndex: boolean
  isDemo: boolean
  publishedAt: string | null
  scheduledFor: string | null
  tagIds: string[]
}): Promise<Article | undefined> {
  const now = new Date().toISOString()
  await getDb().insert(articles).values({
    ...input,
    createdAt: now,
    updatedAt: now,
  })
  await setArticleTags(input.id, input.tagIds)
  await syncArticleSearch(input.id)
  return getArticleById(input.id)
}

export async function updateArticle(
  id: string,
  patch: Partial<Omit<Parameters<typeof createArticle>[0], 'id' | 'tagIds'>>,
  options: { tagIds?: string[]; actorId?: string | null; revisionNote?: string } = {},
): Promise<Article | undefined> {
  const existing = await getArticleById(id)
  if (!existing) return undefined

  if (options.actorId !== null) {
    await getDb().insert(articleRevisions).values({
      id: crypto.randomUUID(),
      articleId: id,
      title: existing.title,
      snapshotJson: JSON.stringify({
        title: existing.title,
        subtitle: existing.subtitle,
        excerpt: existing.excerpt,
        bodyJson: existing.bodyJson,
        seoTitle: existing.seoTitle,
        seoDescription: existing.seoDescription,
        status: existing.status,
        slug: existing.slug,
      }),
      note: options.revisionNote ?? null,
      createdBy: options.actorId ?? null,
      createdAt: new Date().toISOString(),
    })
    await pruneRevisions(id)
  }

  await getDb()
    .update(articles)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(articles.id, id))

  if (options.tagIds) await setArticleTags(id, options.tagIds)
  await syncArticleSearch(id)
  return getArticleById(id)
}

export async function deleteArticle(id: string): Promise<void> {
  await clearArticleSearch(id)
  await getDb().delete(articles).where(eq(articles.id, id))
}

async function pruneRevisions(articleId: string): Promise<void> {
  const rows = await getDb()
    .select({ id: articleRevisions.id })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(desc(articleRevisions.createdAt))
    .offset(30)
  if (!rows.length) return
  await getDb().delete(articleRevisions).where(inArray(articleRevisions.id, rows.map((row) => row.id)))
}

export async function setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  const db = getDb()
  await db.delete(articleTags).where(eq(articleTags.articleId, articleId))
  const unique = [...new Set(tagIds.filter(Boolean))]
  if (!unique.length) return
  await db.insert(articleTags).values(unique.map((tagId) => ({ articleId, tagId })))
}

export async function publishArticle(id: string): Promise<Article | undefined> {
  const article = await getArticleById(id)
  if (!article) return undefined
  const now = new Date().toISOString()
  await getDb()
    .update(articles)
    .set({ status: 'published', publishedAt: article.publishedAt ?? now, scheduledFor: null, updatedAt: now })
    .where(eq(articles.id, id))
  await syncArticleSearch(id)
  return getArticleById(id)
}

export async function scheduleArticle(id: string, scheduledFor: string): Promise<Article | undefined> {
  await getDb()
    .update(articles)
    .set({ status: 'scheduled', scheduledFor, updatedAt: new Date().toISOString() })
    .where(eq(articles.id, id))
  await clearArticleSearch(id)
  return getArticleById(id)
}

export async function unpublishArticle(id: string): Promise<Article | undefined> {
  await getDb()
    .update(articles)
    .set({ status: 'draft', publishedAt: null, scheduledFor: null, updatedAt: new Date().toISOString() })
    .where(eq(articles.id, id))
  await clearArticleSearch(id)
  return getArticleById(id)
}

export async function archiveArticle(id: string): Promise<Article | undefined> {
  await getDb()
    .update(articles)
    .set({ status: 'archived', updatedAt: new Date().toISOString() })
    .where(eq(articles.id, id))
  await clearArticleSearch(id)
  return getArticleById(id)
}

export async function publishDueArticles(): Promise<number> {
  const now = new Date().toISOString()
  const due = await getDb()
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.status, 'scheduled'), lte(articles.scheduledFor, now)))
  for (const row of due) {
    await publishArticle(row.id)
  }
  return due.length
}

/* ------------------------------------------------------------------ *
 *  Revisions
 * ------------------------------------------------------------------ */

export async function listRevisions(articleId: string) {
  return getDb()
    .select()
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(desc(articleRevisions.createdAt))
    .limit(30)
}

export async function restoreRevision(
  articleId: string,
  revisionId: string,
  actorId: string,
): Promise<boolean> {
  const revisions = await getDb()
    .select()
    .from(articleRevisions)
    .where(and(eq(articleRevisions.id, revisionId), eq(articleRevisions.articleId, articleId)))
    .limit(1)
  const revision = revisions[0]
  if (!revision) return false
  let snapshot: Record<string, unknown>
  try {
    snapshot = JSON.parse(revision.snapshotJson) as Record<string, unknown>
  } catch {
    return false
  }
  await updateArticle(
    articleId,
    {
      title: typeof snapshot.title === 'string' ? snapshot.title : undefined,
      subtitle: typeof snapshot.subtitle === 'string' ? snapshot.subtitle : null,
      excerpt: typeof snapshot.excerpt === 'string' ? snapshot.excerpt : undefined,
      bodyJson: typeof snapshot.bodyJson === 'string' ? snapshot.bodyJson : undefined,
      seoTitle: typeof snapshot.seoTitle === 'string' ? snapshot.seoTitle : null,
      seoDescription: typeof snapshot.seoDescription === 'string' ? snapshot.seoDescription : null,
    },
    { actorId, revisionNote: `Restored revision from ${revision.createdAt}` },
  )
  return true
}

/* ------------------------------------------------------------------ *
 *  Search index (FTS5)
 * ------------------------------------------------------------------ */

export async function syncArticleSearch(articleId: string): Promise<void> {
  if (!(await hasFts5())) return
  const article = await getArticleById(articleId)
  await run('DELETE FROM article_fts WHERE article_id = ?', [articleId])
  if (!article || article.status !== 'published') return
  const tagRows = await getArticleTags(articleId)
  let categoryName = ''
  if (article.categoryId) {
    const categoryRows = await getDb()
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, article.categoryId))
      .limit(1)
    categoryName = categoryRows[0]?.name ?? ''
  }
  try {
    await run(
      'INSERT INTO article_fts (article_id, title, subtitle, excerpt, body, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [
        article.id,
        article.title,
        article.subtitle ?? '',
        article.excerpt,
        article.bodyText,
        [tagRows.map((tag) => tag.name).join(' '), categoryName].filter(Boolean).join(' '),
      ],
    )
  } catch (error) {
    console.warn('[search] failed to index article', articleId, error)
  }
}

export async function clearArticleSearch(articleId: string): Promise<void> {
  if (!(await hasFts5())) return
  await run('DELETE FROM article_fts WHERE article_id = ?', [articleId])
}

export async function rebuildSearchIndex(): Promise<number> {
  if (!(await hasFts5())) return 0
  await exec('DELETE FROM article_fts')
  const published = await getDb()
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.status, 'published'))
  for (const row of published) await syncArticleSearch(row.id)
  return published.length
}

/* ------------------------------------------------------------------ *
 *  Dashboard stats
 * ------------------------------------------------------------------ */

export async function getDashboardStats() {
  const db = getDb()
  const [total, published, drafts, scheduled, subscriberRows, mediaRows, weekViews, weekReaders] = await Promise.all([
    db.select({ n: count() }).from(articles),
    db.select({ n: count() }).from(articles).where(eq(articles.status, 'published')),
    db.select({ n: count() }).from(articles).where(eq(articles.status, 'draft')),
    db.select({ n: count() }).from(articles).where(eq(articles.status, 'scheduled')),
    db.select({ n: count() }).from(subscribers).where(and(eq(subscribers.status, 'subscribed'), isNotNull(subscribers.confirmedAt))),
    db.select({ n: count() }).from(media),
    (async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const row = await get<{ n: number }>(
        'SELECT COALESCE(SUM(count), 0) AS n FROM article_views WHERE day >= ?',
        [since],
      )
      return row ?? { n: 0 }
    })(),
    (async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const row = await get<{ n: number }>(
        'SELECT COUNT(DISTINCT visitor_hash) AS n FROM article_visits WHERE created_at >= ?',
        [since],
      )
      return row ?? { n: 0 }
    })(),
  ])
  return {
    total: total[0]?.n ?? 0,
    published: published[0]?.n ?? 0,
    drafts: drafts[0]?.n ?? 0,
    scheduled: scheduled[0]?.n ?? 0,
    subscribers: subscriberRows[0]?.n ?? 0,
    media: mediaRows[0]?.n ?? 0,
    weekViews: weekViews?.n ?? 0,
    weekReaders: weekReaders?.n ?? 0,
  }
}
