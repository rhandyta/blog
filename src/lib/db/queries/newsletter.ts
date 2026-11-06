import { and, count, eq } from 'drizzle-orm'
import { getDb } from '../client'
import { newsletterBroadcasts, newsletterSchedule, type NewsletterSchedule } from '../schema'

export type NewsletterScheduleInput = {
  enabled: boolean
  cadence: 'daily' | 'weekly' | 'monthly'
  weekday: number
  hourUtc: number
  metric: 'readers' | 'views'
  articleLimit: number
}

const defaults: NewsletterScheduleInput = {
  enabled: true,
  cadence: 'weekly',
  weekday: 1,
  hourUtc: 2,
  metric: 'readers',
  articleLimit: 5,
}

export async function getNewsletterSchedule(): Promise<NewsletterSchedule> {
  const rows = await getDb()
    .select()
    .from(newsletterSchedule)
    .where(eq(newsletterSchedule.id, 'digest'))
    .limit(1)
  if (rows[0]) return rows[0]
  return {
    id: 'digest',
    ...defaults,
    updatedAt: new Date().toISOString(),
  }
}

export async function saveNewsletterSchedule(patch: NewsletterScheduleInput): Promise<void> {
  const updatedAt = new Date().toISOString()
  await getDb()
    .insert(newsletterSchedule)
    .values({ id: 'digest', ...patch, updatedAt })
    .onConflictDoUpdate({
      target: newsletterSchedule.id,
      set: { ...patch, updatedAt },
    })
}

export async function hasDigestForPeriod(periodKey: string): Promise<boolean> {
  const rows = await getDb()
    .select({ n: count() })
    .from(newsletterBroadcasts)
    .where(and(eq(newsletterBroadcasts.kind, 'digest'), eq(newsletterBroadcasts.periodKey, periodKey)))
  return (rows[0]?.n ?? 0) > 0
}
