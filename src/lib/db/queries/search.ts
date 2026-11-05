import { and, eq, like, or, sql } from 'drizzle-orm'
import { all, getDb, hasFts5 } from '../client'
import { articles } from '../schema'
import { getArticleBodyTexts, getCardsByIds, type ArticleCard } from './articles'

export type HighlightPart = { text: string; match: boolean }

export type SearchHit = {
  card: ArticleCard
  titleParts: HighlightPart[]
  snippetParts: HighlightPart[]
}

export function splitTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((term) => term.trim())
        .filter((term) => term.length > 1),
    ),
  ].slice(0, 8)
}

function buildFtsQuery(query: string): string {
  const terms = splitTerms(query)
    .map((term) => term.replace(/["*:^(){}[\]]/g, ''))
    .filter(Boolean)
  if (!terms.length) return ''
  return terms.map((term) => `"${term}"*`).join(' AND ')
}

export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  if (!text) return []
  if (!terms.length) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const ranges: Array<{ start: number; end: number }> = []
  for (const term of terms) {
    let index = 0
    while (index < lower.length) {
      const found = lower.indexOf(term, index)
      if (found === -1) break
      ranges.push({ start: found, end: found + term.length })
      index = found + term.length
    }
  }
  if (!ranges.length) return [{ text, match: false }]
  ranges.sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  const parts: HighlightPart[] = []
  let cursor = 0
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), match: false })
    parts.push({ text: text.slice(range.start, range.end), match: true })
    cursor = range.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}

export function buildSnippet(text: string, terms: string[], maxLength = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (!terms.length) return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean
  const lower = clean.toLowerCase()
  let index = -1
  for (const term of terms) {
    const found = lower.indexOf(term)
    if (found !== -1 && (index === -1 || found < index)) index = found
  }
  if (index === -1) return clean.length > maxLength ? `${clean.slice(0, maxLength)}…` : clean
  const start = Math.max(0, index - Math.floor(maxLength * 0.35))
  const end = Math.min(clean.length, start + maxLength)
  let snippet = clean.slice(start, end)
  if (start > 0) snippet = `…${snippet.replace(/^\S*\s/, '')}`
  if (end < clean.length) snippet = `${snippet.replace(/\s\S*$/, '')}…`
  return snippet
}

async function fallbackIds(query: string, limit: number): Promise<string[]> {
  const pattern = `%${query.trim()}%`
  const rows = await getDb()
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.status, 'published'),
        or(
          like(articles.title, pattern),
          like(articles.subtitle, pattern),
          like(articles.excerpt, pattern),
          like(articles.bodyText, pattern),
        ),
      ),
    )
    .orderBy(sql`${articles.publishedAt} DESC`)
    .limit(limit)
  return rows.map((row) => row.id)
}

export async function searchPublished(query: string, limit = 20): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const terms = splitTerms(trimmed)

  let ids: string[] = []
  if (await hasFts5()) {
    const ftsQuery = buildFtsQuery(trimmed)
    if (ftsQuery) {
      try {
        const rows = await all<{ id: string }>(
          `SELECT article_id AS id FROM article_fts
           WHERE article_fts MATCH ? ORDER BY bm25(article_fts) LIMIT ?`,
          [ftsQuery, limit],
        )
        ids = rows.map((row) => row.id)
      } catch {
        ids = []
      }
    }
  }
  if (!ids.length) ids = await fallbackIds(trimmed, limit)
  if (!ids.length) return []

  const cards = await getCardsByIds(ids)
  const bodies = await getArticleBodyTexts(ids)

  const hits: SearchHit[] = []
  for (const card of cards) {
    const body = bodies.get(card.id) ?? ''
    const snippet = buildSnippet(`${card.excerpt} ${body}`, terms)
    hits.push({
      card,
      titleParts: highlightParts(card.title, terms),
      snippetParts: highlightParts(snippet, terms),
    })
  }
  const order = new Map(ids.map((id, index) => [id, index]))
  return hits.sort((a, b) => (order.get(a.card.id) ?? 99) - (order.get(b.card.id) ?? 99))
}
