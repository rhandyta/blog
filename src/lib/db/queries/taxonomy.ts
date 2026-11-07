import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '../client'
import { articleTags, articles, authors, categories, settings, tags } from '../schema'

export type AccentToken =
  | 'vermilion'
  | 'indigo'
  | 'ultramarine'
  | 'ochre'
  | 'teal'
  | 'plum'
  | 'moss'
  | 'clay'

export const ACCENTS: Array<{ token: AccentToken; label: string; hex: string }> = [
  { token: 'vermilion', label: 'Vermilion', hex: '#c8452b' },
  { token: 'indigo', label: 'Indigo', hex: '#29407a' },
  { token: 'ultramarine', label: 'Ultramarine', hex: '#33479c' },
  { token: 'ochre', label: 'Ochre', hex: '#9a6a16' },
  { token: 'teal', label: 'Teal', hex: '#1f6f63' },
  { token: 'plum', label: 'Plum', hex: '#6b3f63' },
  { token: 'moss', label: 'Moss', hex: '#5a6b2f' },
  { token: 'clay', label: 'Clay', hex: '#8a4b2a' },
]

export type SiteSettings = {
  title: string
  tagline: string
  description: string
  issue: string
  intro: string
  manifesto: string
  manifestoBy: string
  newsletterTitle: string
  newsletterBlurb: string
  about: string
  email: string
  x: string
  github: string
  linkedin: string
  siteLanguage: 'id' | 'en'
}

export const defaultSettings: SiteSettings = {
  title: 'RhandytaVERSE',
  tagline: 'The personal publication of Rhandyta Briantama',
  description:
    'RhandytaVERSE is the personal publication of Rhandyta Briantama: essays and notes on technology, design, science, culture, work, and the quieter parts of a working life.',
  issue: 'No. 01',
  intro:
    'RhandytaVERSE is the personal publication of Rhandyta Briantama: one reader, one desk, and an ongoing record of the things worth returning to.',
  manifesto: 'A place to keep the things worth keeping — and to think them through in public.',
  manifestoBy: 'Rhandyta Briantama',
  newsletterTitle: 'A letter, occasionally.',
  newsletterBlurb:
    'New essays and useful fragments, delivered when there is something worth sending. No schedule, no noise.',
  about:
    'RhandytaVERSE is the personal publication of Rhandyta Briantama. I write about technology, design, science, culture, work, and ordinary life — the things I am reading, building, and thinking about.\n\nThe name comes from the commonplace books kept by readers for centuries: private collections of passages, observations, and ideas, copied out and returned to. The publication and the person are the same project: one reader, one desk, one ongoing record.\n\nEssays are published when there is something worth saying. The archive is kept in full, with no fixed schedule to keep up with.',
  email: '',
  x: '',
  github: '',
  linkedin: '',
  siteLanguage: 'id',
}

let cachedSettings: SiteSettings | null = null

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cachedSettings) return cachedSettings
  const rows = await getDb().select().from(settings).where(eq(settings.key, 'site')).limit(1)
  if (!rows[0]) {
    cachedSettings = { ...defaultSettings }
    return cachedSettings
  }
  try {
    const stored = JSON.parse(rows[0].value) as Partial<SiteSettings>
    cachedSettings = { ...defaultSettings, ...stored }
    return cachedSettings
  } catch {
    cachedSettings = { ...defaultSettings }
    return cachedSettings
  }
}

export function invalidateSettingsCache(): void {
  cachedSettings = null
}

export async function saveSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings()
  const next = { ...current, ...patch }
  const now = new Date().toISOString()
  await getDb()
    .insert(settings)
    .values({ key: 'site', value: JSON.stringify(next), updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(next), updatedAt: now } })
  cachedSettings = next
  return next
}

/* Categories */

export type CategoryWithCount = typeof categories.$inferSelect & { articleCount: number }

export async function listCategories(options: { withCounts?: boolean } = {}): Promise<CategoryWithCount[]> {
  const db = getDb()
  if (!options.withCounts) {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
    return rows.map((row) => ({ ...row, articleCount: 0 }))
  }
  const rows = await db
    .select({
      category: categories,
      articleCount: sql<number>`count(${articles.id})`,
    })
    .from(categories)
    .leftJoin(articles, and(eq(articles.categoryId, categories.id), eq(articles.status, 'published')))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
  return rows.map((row) => ({ ...row.category, articleCount: row.articleCount }))
}

export async function getCategoryBySlug(slug: string) {
  const rows = await getDb().select().from(categories).where(eq(categories.slug, slug)).limit(1)
  return rows[0]
}

export async function getCategoryById(id: string) {
  const rows = await getDb().select().from(categories).where(eq(categories.id, id)).limit(1)
  return rows[0]
}

export async function upsertCategory(input: {
  id: string
  slug: string
  name: string
  description?: string
  intro?: string
  accent?: AccentToken
  sortOrder?: number
}) {
  const existing = await getCategoryById(input.id)
  if (existing) {
    await getDb()
      .update(categories)
      .set({
        slug: input.slug,
        name: input.name,
        description: input.description ?? existing.description,
        intro: input.intro ?? existing.intro,
        accent: input.accent ?? existing.accent,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      })
      .where(eq(categories.id, input.id))
    return
  }
  await getDb().insert(categories).values({
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description ?? '',
    intro: input.intro ?? '',
    accent: input.accent ?? 'vermilion',
    sortOrder: input.sortOrder ?? 0,
    createdAt: new Date().toISOString(),
  })
}

export async function deleteCategory(id: string): Promise<void> {
  await getDb().update(articles).set({ categoryId: null }).where(eq(articles.categoryId, id))
  await getDb().delete(categories).where(eq(categories.id, id))
}

export async function categoryArticleCount(id: string): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(articles)
    .where(and(eq(articles.categoryId, id), eq(articles.status, 'published')))
  return rows[0]?.n ?? 0
}

/* Tags */

export type TagWithCount = typeof tags.$inferSelect & { articleCount: number }

export async function listTags(options: { withCounts?: boolean; limit?: number } = {}): Promise<TagWithCount[]> {
  const db = getDb()
  if (!options.withCounts) {
    const rows = await db.select().from(tags).orderBy(asc(tags.name)).limit(options.limit ?? 500)
    return rows.map((row) => ({ ...row, articleCount: 0 }))
  }
  const rows = await db
    .select({
      tag: tags,
      articleCount: sql<number>`count(${articles.id})`,
    })
    .from(tags)
    .leftJoin(articleTags, eq(articleTags.tagId, tags.id))
    .leftJoin(articles, and(eq(articles.id, articleTags.articleId), eq(articles.status, 'published')))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${articles.id})`), asc(tags.name))
    .limit(options.limit ?? 500)
  return rows.map((row) => ({ ...row.tag, articleCount: row.articleCount }))
}

export async function getTagBySlug(slug: string) {
  const rows = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1)
  return rows[0]
}

export async function getTagById(id: string) {
  const rows = await getDb().select().from(tags).where(eq(tags.id, id)).limit(1)
  return rows[0]
}

export async function createTag(input: { id: string; slug: string; name: string; description?: string }) {
  await getDb().insert(tags).values({
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description ?? '',
    createdAt: new Date().toISOString(),
  })
}

export async function updateTag(id: string, input: { slug: string; name: string; description?: string }) {
  await getDb()
    .update(tags)
    .set({ slug: input.slug, name: input.name, description: input.description ?? '' })
    .where(eq(tags.id, id))
}

export async function deleteTag(id: string): Promise<void> {
  await getDb().delete(tags).where(eq(tags.id, id))
}

/* Authors */

export type AuthorWithCount = typeof authors.$inferSelect & { articleCount: number }

export async function listAuthors(options: { withCounts?: boolean } = {}): Promise<AuthorWithCount[]> {
  const db = getDb()
  if (!options.withCounts) {
    const rows = await db.select().from(authors).orderBy(asc(authors.displayName))
    return rows.map((row) => ({ ...row, articleCount: 0 }))
  }
  const rows = await db
    .select({ author: authors, articleCount: sql<number>`count(${articles.id})` })
    .from(authors)
    .leftJoin(articles, and(eq(articles.authorId, authors.id), eq(articles.status, 'published')))
    .groupBy(authors.id)
    .orderBy(asc(authors.displayName))
  return rows.map((row) => ({ ...row.author, articleCount: row.articleCount }))
}

export async function getAuthorBySlug(slug: string) {
  const rows = await getDb().select().from(authors).where(eq(authors.slug, slug)).limit(1)
  return rows[0]
}

export async function getAuthorById(id: string) {
  const rows = await getDb().select().from(authors).where(eq(authors.id, id)).limit(1)
  return rows[0]
}

export async function getAuthorForUser(userId: string) {
  const rows = await getDb().select().from(authors).where(eq(authors.userId, userId)).limit(1)
  return rows[0]
}

export async function upsertAuthor(input: {
  id: string
  slug: string
  displayName: string
  userId?: string | null
  roleTitle?: string | null
  bio?: string
  longBio?: string | null
  expertise?: string[]
  socialLinks?: Record<string, string>
  avatarMediaId?: string | null
  isDemo?: boolean
}) {
  const existing = await getAuthorById(input.id)
  const now = new Date().toISOString()
  if (existing) {
    await getDb()
      .update(authors)
      .set({
        slug: input.slug,
        displayName: input.displayName,
        userId: input.userId === undefined ? existing.userId : input.userId,
        roleTitle: input.roleTitle === undefined ? existing.roleTitle : input.roleTitle,
        bio: input.bio ?? existing.bio,
        longBio: input.longBio === undefined ? existing.longBio : input.longBio,
        expertise: JSON.stringify(input.expertise ?? JSON.parse(existing.expertise || '[]')),
        socialLinks: JSON.stringify(input.socialLinks ?? JSON.parse(existing.socialLinks || '{}')),
        avatarMediaId: input.avatarMediaId === undefined ? existing.avatarMediaId : input.avatarMediaId,
        updatedAt: now,
      })
      .where(eq(authors.id, input.id))
    return
  }
  await getDb().insert(authors).values({
    id: input.id,
    slug: input.slug,
    displayName: input.displayName,
    userId: input.userId ?? null,
    roleTitle: input.roleTitle ?? null,
    bio: input.bio ?? '',
    longBio: input.longBio ?? null,
    expertise: JSON.stringify(input.expertise ?? []),
    socialLinks: JSON.stringify(input.socialLinks ?? {}),
    avatarMediaId: input.avatarMediaId ?? null,
    isDemo: input.isDemo ?? false,
    createdAt: now,
    updatedAt: now,
  })
}

export async function deleteAuthor(id: string): Promise<{ ok: boolean; reason?: string }> {
  const rows = await getDb()
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.authorId, id))
  if ((rows[0]?.n ?? 0) > 0) {
    return { ok: false, reason: 'This author still has articles. Reassign or delete them first.' }
  }
  await getDb().delete(authors).where(eq(authors.id, id))
  return { ok: true }
}

export function parseJsonArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function parseJsonObject(value: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(value ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}
