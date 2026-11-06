import { and, asc, count, desc, eq, isNotNull, isNull, like } from 'drizzle-orm'
import { hashVisitor } from '../../analytics/visitor'
import { getDb } from '../client'
import { newsletterBroadcasts, subscribers } from '../schema'

export type SubscribeResult = 'pending' | 'subscribed' | 'already' | 'invalid'

export type SubscribeOutcome =
  | { result: 'pending'; email: string; token: string; send: boolean }
  | { result: 'subscribed'; email: string }
  | { result: 'already'; email: string }
  | { result: 'invalid' }

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

function confirmationToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function subscribeEmail(
  email: string,
  options: { source?: string; ip?: string; requireConfirmation?: boolean } = {},
): Promise<SubscribeOutcome> {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) return { result: 'invalid' }

  const db = getDb()
  const existing = (
    await db.select().from(subscribers).where(eq(subscribers.email, normalized)).limit(1)
  )[0]
  const now = new Date()
  const nowIso = now.toISOString()
  const source = options.source ?? 'site'
  const ipHashValue =
    options.ip && options.ip !== 'unknown' ? hashVisitor(options.ip, 'newsletter') : null
  const requireConfirmation = options.requireConfirmation ?? false

  if (existing) {
    if (existing.status === 'subscribed' && existing.confirmedAt) {
      return { result: 'already', email: normalized }
    }

    if (!requireConfirmation) {
      await db
        .update(subscribers)
        .set({
          status: 'subscribed',
          unsubscribedAt: null,
          confirmedAt: nowIso,
          confirmationToken: null,
          confirmationSentAt: null,
          source,
          ...(ipHashValue ? { ipHash: ipHashValue } : {}),
        })
        .where(eq(subscribers.id, existing.id))
      return { result: 'subscribed', email: normalized }
    }

    if (
      existing.status === 'subscribed' &&
      !existing.confirmedAt &&
      existing.confirmationToken &&
      existing.confirmationSentAt &&
      now.getTime() - new Date(existing.confirmationSentAt).getTime() < 2 * 60_000
    ) {
      return {
        result: 'pending',
        email: normalized,
        token: existing.confirmationToken,
        send: false,
      }
    }

    const token = confirmationToken()
    await db
      .update(subscribers)
      .set({
        status: 'subscribed',
        unsubscribedAt: null,
        confirmedAt: null,
        confirmationToken: token,
        confirmationSentAt: nowIso,
        source,
        ...(ipHashValue ? { ipHash: ipHashValue } : {}),
      })
      .where(eq(subscribers.id, existing.id))
    return { result: 'pending', email: normalized, token, send: true }
  }

  const token = requireConfirmation ? confirmationToken() : null
  await db.insert(subscribers).values({
    id: crypto.randomUUID(),
    email: normalized,
    status: 'subscribed',
    unsubscribeToken: confirmationToken(),
    source,
    ipHash: ipHashValue,
    createdAt: nowIso,
    unsubscribedAt: null,
    confirmedAt: requireConfirmation ? null : nowIso,
    confirmationToken: token,
    confirmationSentAt: requireConfirmation ? nowIso : null,
  })
  return requireConfirmation && token
    ? { result: 'pending', email: normalized, token, send: true }
    : { result: 'subscribed', email: normalized }
}

export async function clearConfirmationTimestamp(email: string): Promise<void> {
  await getDb()
    .update(subscribers)
    .set({ confirmationSentAt: null })
    .where(eq(subscribers.email, normalizeEmail(email)))
}

export async function confirmSubscriber(token: string): Promise<string | null> {
  if (!token) return null
  const db = getDb()
  const row = (
    await db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.confirmationToken, token), eq(subscribers.status, 'subscribed')))
      .limit(1)
  )[0]
  if (!row) return null
  if (row.confirmationSentAt) {
    const sentAt = new Date(row.confirmationSentAt).getTime()
    if (Number.isFinite(sentAt) && Date.now() - sentAt > 7 * 86_400_000) return null
  }
  await db
    .update(subscribers)
    .set({
      confirmedAt: new Date().toISOString(),
      confirmationToken: null,
      confirmationSentAt: null,
      unsubscribedAt: null,
    })
    .where(eq(subscribers.id, row.id))
  return row.email
}

export async function unsubscribeByToken(token: string): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.status !== 'unsubscribed') {
    await db
      .update(subscribers)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        confirmationToken: null,
        confirmationSentAt: null,
      })
      .where(eq(subscribers.id, row.id))
  }
  return row.email
}

export async function listSubscribers(options: {
  q?: string
  status?: 'subscribed' | 'pending' | 'unsubscribed' | 'all'
  limit?: number
  offset?: number
} = {}) {
  const { q, status = 'all', limit = 50, offset = 0 } = options
  const conditions = []
  if (q) conditions.push(like(subscribers.email, `%${q}%`))
  if (status === 'subscribed') {
    conditions.push(eq(subscribers.status, 'subscribed'), isNotNull(subscribers.confirmedAt))
  } else if (status === 'pending') {
    conditions.push(eq(subscribers.status, 'subscribed'), isNull(subscribers.confirmedAt))
  } else if (status === 'unsubscribed') {
    conditions.push(eq(subscribers.status, 'unsubscribed'))
  }
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

export async function listConfirmedSubscribers() {
  return getDb()
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.status, 'subscribed'), isNotNull(subscribers.confirmedAt)))
    .orderBy(asc(subscribers.createdAt))
    .limit(5000)
}

export async function subscriberStats() {
  const db = getDb()
  const [subscribed, pending, unsubscribed] = await Promise.all([
    db
      .select({ n: count() })
      .from(subscribers)
      .where(and(eq(subscribers.status, 'subscribed'), isNotNull(subscribers.confirmedAt))),
    db
      .select({ n: count() })
      .from(subscribers)
      .where(and(eq(subscribers.status, 'subscribed'), isNull(subscribers.confirmedAt))),
    db.select({ n: count() }).from(subscribers).where(eq(subscribers.status, 'unsubscribed')),
  ])
  return {
    subscribed: subscribed[0]?.n ?? 0,
    pending: pending[0]?.n ?? 0,
    unsubscribed: unsubscribed[0]?.n ?? 0,
  }
}

export function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${text.replace(/"/g, '""')}"`
}

export async function exportSubscribersCsv(): Promise<string> {
  const rows = await listSubscribers({ status: 'subscribed', limit: 5000 })
  const lines = ['email,status,source,subscribed_at']
  for (const row of rows.items) {
    lines.push([row.email, row.status, row.source, row.createdAt].map(csvCell).join(','))
  }
  return lines.join('\n')
}

export async function recordNewsletterBroadcast(input: {
  subject: string
  body: string
  recipientCount: number
  sentCount: number
  failedCount: number
  createdBy: string | null
  kind?: 'manual' | 'digest'
  periodKey?: string | null
}): Promise<void> {
  await getDb().insert(newsletterBroadcasts).values({
    id: crypto.randomUUID(),
    subject: input.subject,
    body: input.body,
    recipientCount: input.recipientCount,
    sentCount: input.sentCount,
    failedCount: input.failedCount,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    kind: input.kind ?? 'manual',
    periodKey: input.periodKey ?? null,
  })
}

export async function listNewsletterBroadcasts(limit = 8) {
  return getDb()
    .select()
    .from(newsletterBroadcasts)
    .orderBy(desc(newsletterBroadcasts.createdAt))
    .limit(limit)
}
