import { and, count, desc, eq, like } from 'drizzle-orm'
import { getDb } from '../client'
import { subscribers } from '../schema'

export type SubscribeResult = 'subscribed' | 'already' | 'invalid'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

export async function subscribeEmail(
  email: string,
  options: { source?: string; ipHash?: string } = {},
): Promise<SubscribeResult> {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) return 'invalid'
  const db = getDb()
  const existing = await db.select().from(subscribers).where(eq(subscribers.email, normalized)).limit(1)
  if (existing[0]) {
    if (existing[0].status === 'subscribed') return 'already'
    await db
      .update(subscribers)
      .set({ status: 'subscribed', unsubscribedAt: null })
      .where(eq(subscribers.id, existing[0].id))
    return 'subscribed'
  }
  await db.insert(subscribers).values({
    id: crypto.randomUUID(),
    email: normalized,
    status: 'subscribed',
    unsubscribeToken: crypto.randomUUID().replace(/-/g, ''),
    source: options.source ?? 'site',
    ipHash: options.ipHash ?? null,
    createdAt: new Date().toISOString(),
  })
  return 'subscribed'
}

export async function unsubscribeByToken(token: string): Promise<string | null> {
  const db = getDb()
  const rows = await db.select().from(subscribers).where(eq(subscribers.unsubscribeToken, token)).limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.status !== 'unsubscribed') {
    await db
      .update(subscribers)
      .set({ status: 'unsubscribed', unsubscribedAt: new Date().toISOString() })
      .where(eq(subscribers.id, row.id))
  }
  return row.email
}

export async function listSubscribers(options: {
  q?: string
  status?: 'subscribed' | 'unsubscribed' | 'all'
  limit?: number
  offset?: number
} = {}) {
  const { q, status = 'all', limit = 50, offset = 0 } = options
  const conditions = []
  if (q) conditions.push(like(subscribers.email, `%${q}%`))
  if (status !== 'all') conditions.push(eq(subscribers.status, status))
  const where = conditions.length ? and(...conditions) : undefined
  const [items, totals] = await Promise.all([
    getDb()
      .select()
      .from(subscribers)
      .where(where)
      .orderBy(desc(subscribers.createdAt))
      .limit(limit)
      .offset(offset),
    getDb().select({ n: count() }).from(subscribers).where(where),
  ])
  return { items, total: totals[0]?.n ?? 0 }
}

export async function subscriberStats() {
  const db = getDb()
  const [subscribed, unsubscribed] = await Promise.all([
    db.select({ n: count() }).from(subscribers).where(eq(subscribers.status, 'subscribed')),
    db.select({ n: count() }).from(subscribers).where(eq(subscribers.status, 'unsubscribed')),
  ])
  return { subscribed: subscribed[0]?.n ?? 0, unsubscribed: unsubscribed[0]?.n ?? 0 }
}

export async function exportSubscribersCsv(): Promise<string> {
  const rows = await listSubscribers({ status: 'subscribed', limit: 5000 })
  const lines = ['email,status,source,subscribed_at']
  for (const row of rows.items) {
    lines.push(
      [row.email, row.status, row.source, row.createdAt]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  return lines.join('\n')
}
