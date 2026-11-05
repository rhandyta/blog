import { and, desc, eq, inArray, like, sql } from 'drizzle-orm'
import type { MediaInfo, MediaVariants } from '../../content/doc'
import { getDb } from '../client'
import { articles, authors, media, settings, type MediaAsset } from '../schema'

export function parseVariants(asset: MediaAsset): MediaVariants {
  try {
    const parsed = JSON.parse(asset.variants) as MediaVariants
    return { avif: parsed.avif ?? [], webp: parsed.webp ?? [], og: parsed.og }
  } catch {
    return { avif: [], webp: [] }
  }
}

export function toMediaInfo(asset: MediaAsset): MediaInfo {
  return {
    id: asset.id,
    src: asset.src,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    caption: asset.caption,
    variants: parseVariants(asset),
  }
}

export async function getMediaMap(ids: string[]): Promise<Map<string, MediaInfo>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const rows = await getDb().select().from(media).where(inArray(media.id, unique))
  return new Map(rows.map((row) => [row.id, toMediaInfo(row)]))
}

export async function getMediaById(id: string): Promise<MediaAsset | undefined> {
  const rows = await getDb().select().from(media).where(eq(media.id, id)).limit(1)
  return rows[0]
}

export async function listMedia(options: { q?: string; limit?: number; offset?: number } = {}) {
  const { q, limit = 60, offset = 0 } = options
  const where = q ? and(like(media.originalName, `%${q}%`), undefined) : undefined
  const rows = await getDb()
    .select()
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset)
  return rows
}

export async function countMedia(): Promise<number> {
  const rows = await getDb().select({ n: sql<number>`count(*)` }).from(media)
  return rows[0]?.n ?? 0
}

export async function createMedia(input: {
  id: string
  filename: string
  originalName: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  alt: string
  caption: string | null
  dominantColor: string
  src: string
  variants: MediaVariants
  uploadedBy: string | null
  createdAt: string
}) {
  const row: typeof media.$inferInsert = {
    id: input.id,
    filename: input.filename,
    originalName: input.originalName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    width: input.width,
    height: input.height,
    alt: input.alt,
    caption: input.caption,
    dominantColor: input.dominantColor,
    src: input.src,
    variants: JSON.stringify(input.variants),
    uploadedBy: input.uploadedBy,
    createdAt: input.createdAt,
  }
  await getDb().insert(media).values(row)
  return getMediaById(input.id)
}

export async function updateMedia(
  id: string,
  patch: { alt?: string; caption?: string | null; originalName?: string },
): Promise<boolean> {
  const result = await getDb().update(media).set(patch).where(eq(media.id, id)).returning({ id: media.id })
  return result.length > 0
}

export async function mediaUsage(id: string): Promise<{ articles: number; authors: number; settings: number }> {
  const db = getDb()
  const [articleRows, authorRows, settingsRows] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(articles)
      .where(
        sql`${articles.featuredMediaId} = ${id} OR ${articles.ogMediaId} = ${id} OR ${articles.bodyJson} LIKE ${`%${id}%`}`,
      ),
    db.select({ n: sql<number>`count(*)` }).from(authors).where(eq(authors.avatarMediaId, id)),
    db.select({ n: sql<number>`count(*)` }).from(settings).where(like(settings.value, `%${id}%`)),
  ])
  return {
    articles: articleRows[0]?.n ?? 0,
    authors: authorRows[0]?.n ?? 0,
    settings: settingsRows[0]?.n ?? 0,
  }
}

export async function deleteMedia(id: string): Promise<boolean> {
  const result = await getDb().delete(media).where(eq(media.id, id)).returning({ id: media.id })
  return result.length > 0
}

export async function getMediaReferences(id: string): Promise<string[]> {
  const db = getDb()
  const referencedByArticles = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(sql`${articles.featuredMediaId} = ${id} OR ${articles.ogMediaId} = ${id}`)
  const bodyMatches = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(like(articles.bodyJson, `%${id}%`))
  return [...new Set([...referencedByArticles, ...bodyMatches].map((row) => row.slug))]
}
