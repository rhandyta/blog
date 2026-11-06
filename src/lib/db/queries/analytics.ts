import { all, get, run } from '../client'
import { isoDay } from '../../content/html'

export type AnalyticsOverview = {
  readers: number
  views: number
  readers30d: number
  views30d: number
  readersToday: number
  viewsToday: number
}

export type DailyAnalytics = {
  day: string
  views: number
  readers: number
}

export type TopArticleAnalytics = {
  id: string
  slug: string
  title: string
  readers: number
  views: number
}

export type DigestArticle = TopArticleAnalytics & {
  excerpt: string
  readingMinutes: number
  categoryName: string | null
  categoryAccent: string | null
}

export type BreakdownRow = {
  label: string
  visits: number
  readers: number
}

function numberValue(value: unknown): number {
  return Number(value) || 0
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const today = isoDay()
  const since30 = isoDay(new Date(Date.now() - 29 * 86_400_000))
  const [readers, views, readers30d, views30d, readersToday, viewsToday] = await Promise.all([
    get<{ n: number }>('SELECT COUNT(DISTINCT visitor_hash) AS n FROM article_readers'),
    get<{ n: number }>('SELECT COALESCE(SUM(count), 0) AS n FROM article_views'),
    get<{ n: number }>(
      'SELECT COUNT(DISTINCT visitor_hash) AS n FROM article_visits WHERE day >= ?',
      [since30],
    ),
    get<{ n: number }>(
      'SELECT COALESCE(SUM(count), 0) AS n FROM article_views WHERE day >= ?',
      [since30],
    ),
    get<{ n: number }>(
      'SELECT COUNT(DISTINCT visitor_hash) AS n FROM article_visits WHERE day = ?',
      [today],
    ),
    get<{ n: number }>(
      'SELECT COALESCE(SUM(count), 0) AS n FROM article_views WHERE day = ?',
      [today],
    ),
  ])
  return {
    readers: numberValue(readers?.n),
    views: numberValue(views?.n),
    readers30d: numberValue(readers30d?.n),
    views30d: numberValue(views30d?.n),
    readersToday: numberValue(readersToday?.n),
    viewsToday: numberValue(viewsToday?.n),
  }
}

export async function getDailyAnalytics(days = 14): Promise<DailyAnalytics[]> {
  const safeDays = Math.min(90, Math.max(7, Math.floor(days)))
  const since = isoDay(new Date(Date.now() - (safeDays - 1) * 86_400_000))
  const [viewRows, readerRows] = await Promise.all([
    all<{ day: string; total: number }>(
      `SELECT day, COALESCE(SUM(count), 0) AS total
       FROM article_views WHERE day >= ? GROUP BY day`,
      [since],
    ),
    all<{ day: string; total: number }>(
      `SELECT day, COUNT(DISTINCT visitor_hash) AS total
       FROM article_visits WHERE day >= ? GROUP BY day`,
      [since],
    ),
  ])
  const views = new Map(viewRows.map((row) => [row.day, numberValue(row.total)]))
  const readers = new Map(readerRows.map((row) => [row.day, numberValue(row.total)]))
  return Array.from({ length: safeDays }, (_, index) => {
    const day = isoDay(new Date(Date.now() - (safeDays - 1 - index) * 86_400_000))
    return {
      day,
      views: views.get(day) ?? 0,
      readers: readers.get(day) ?? 0,
    }
  })
}

export async function getTopArticles(limit = 8): Promise<TopArticleAnalytics[]> {
  const rows = await all<{
    id: string
    slug: string
    title: string
    readers: number
    views: number
  }>(
    `SELECT a.id, a.slug, a.title,
            COALESCE(v.views, 0) AS views,
            COALESCE(r.readers, 0) AS readers
     FROM articles a
     LEFT JOIN (
       SELECT article_id, SUM(count) AS views
       FROM article_views GROUP BY article_id
     ) v ON v.article_id = a.id
     LEFT JOIN (
       SELECT article_id, COUNT(*) AS readers
       FROM article_readers GROUP BY article_id
     ) r ON r.article_id = a.id
     WHERE a.status = 'published'
     ORDER BY readers DESC, views DESC, a.published_at DESC
     LIMIT ?`,
    [Math.min(50, Math.max(1, Math.floor(limit)))],
  )
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    readers: numberValue(row.readers),
    views: numberValue(row.views),
  }))
}

export async function getDigestArticles(input: {
  days: number
  limit: number
  metric: 'readers' | 'views'
}): Promise<DigestArticle[]> {
  const days = Math.max(1, Math.floor(input.days))
  const limit = Math.min(10, Math.max(1, Math.floor(input.limit)))
  const since = isoDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const rows = await all<{
    id: string
    slug: string
    title: string
    excerpt: string
    readingMinutes: number
    categoryName: string | null
    categoryAccent: string | null
    readers: number
    views: number
  }>(
    `SELECT a.id, a.slug, a.title, a.excerpt,
            a.reading_minutes AS readingMinutes,
            c.name AS categoryName, c.accent AS categoryAccent,
            COALESCE(r.readers, 0) AS readers,
            COALESCE(v.views, 0) AS views
     FROM articles a
     LEFT JOIN categories c ON c.id = a.category_id
     LEFT JOIN (
       SELECT article_id, COUNT(DISTINCT visitor_hash) AS readers
       FROM article_visits WHERE day >= ? GROUP BY article_id
     ) r ON r.article_id = a.id
     LEFT JOIN (
       SELECT article_id, SUM(count) AS views
       FROM article_views WHERE day >= ? GROUP BY article_id
     ) v ON v.article_id = a.id
     WHERE a.status = 'published'
       AND (COALESCE(r.readers, 0) > 0 OR COALESCE(v.views, 0) > 0)
     ORDER BY
       CASE WHEN ? = 'readers' THEN COALESCE(r.readers, 0) ELSE COALESCE(v.views, 0) END DESC,
       COALESCE(r.readers, 0) DESC,
       COALESCE(v.views, 0) DESC,
       a.published_at DESC
     LIMIT ?`,
    [since, since, input.metric, limit],
  )
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    readingMinutes: numberValue(row.readingMinutes),
    categoryName: row.categoryName,
    categoryAccent: row.categoryAccent,
    readers: numberValue(row.readers),
    views: numberValue(row.views),
  }))
}

export async function getReferrerBreakdown(days = 30, limit = 8): Promise<BreakdownRow[]> {
  const since = isoDay(new Date(Date.now() - (Math.max(1, days) - 1) * 86_400_000))
  const rows = await all<{ label: string; visits: number; readers: number }>(
    `SELECT COALESCE(NULLIF(referrer_host, ''), 'Direct') AS label,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_hash) AS readers
     FROM article_visits
     WHERE day >= ?
     GROUP BY label
     ORDER BY visits DESC, readers DESC
     LIMIT ?`,
    [since, Math.min(50, Math.max(1, Math.floor(limit)))],
  )
  return rows.map((row) => ({
    label: row.label,
    visits: numberValue(row.visits),
    readers: numberValue(row.readers),
  }))
}

async function dimensionBreakdown(
  column: 'country' | 'device' | 'browser' | 'os',
  days: number,
  limit: number,
  fallback: string,
): Promise<BreakdownRow[]> {
  const since = isoDay(new Date(Date.now() - (Math.max(1, days) - 1) * 86_400_000))
  const rows = await all<{ label: string; visits: number; readers: number }>(
    `SELECT COALESCE(NULLIF(${column}, ''), ?) AS label,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_hash) AS readers
     FROM article_visits
     WHERE day >= ?
     GROUP BY label
     ORDER BY visits DESC, readers DESC
     LIMIT ?`,
    [fallback, since, Math.min(50, Math.max(1, Math.floor(limit)))],
  )
  return rows.map((row) => ({
    label: row.label,
    visits: numberValue(row.visits),
    readers: numberValue(row.readers),
  }))
}

export function getCountryBreakdown(days = 30, limit = 8): Promise<BreakdownRow[]> {
  return dimensionBreakdown('country', days, limit, 'Unknown')
}

export function getDeviceBreakdown(days = 30, limit = 8): Promise<BreakdownRow[]> {
  return dimensionBreakdown('device', days, limit, 'Unknown')
}

export function getBrowserBreakdown(days = 30, limit = 8): Promise<BreakdownRow[]> {
  return dimensionBreakdown('browser', days, limit, 'Unknown')
}

export function getOsBreakdown(days = 30, limit = 8): Promise<BreakdownRow[]> {
  return dimensionBreakdown('os', days, limit, 'Unknown')
}

export async function pruneAnalytics(retentionDays = 180): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(1, retentionDays) * 86_400_000).toISOString()
  const row = await get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM article_visits WHERE created_at < ?',
    [cutoff],
  )
  await run('DELETE FROM article_visits WHERE created_at < ?', [cutoff])
  return numberValue(row?.n)
}
