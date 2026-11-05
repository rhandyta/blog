import { and, count, desc, eq, gte, isNotNull, isNull, lte, ne } from 'drizzle-orm'
import { getDb } from '../client'
import {
  articles,
  automationActivity,
  automationRuns,
  media,
  settings,
  type AutomationActivity,
  type AutomationRun,
  type MediaAsset,
} from '../schema'

const SETTINGS_KEY = 'automation'

export type AutomationSettings = {
  enabled: boolean
  language: string
  model: string
  authorId: string | null
  autoPublish: boolean
  autoPublishDelayHours: number
  dailyLimit: number
  lastRunAt: string | null
  initiativeBrief: string
}

export const defaultAutomationSettings: AutomationSettings = {
  enabled: false,
  language: 'Indonesian',
  model: 'gemini-2.5-flash',
  authorId: null,
  autoPublish: true,
  autoPublishDelayHours: 24,
  dailyLimit: 1,
  lastRunAt: null,
  initiativeBrief:
    'Write a reflective personal essay grounded in ordinary daily life: attention, work, the city, small observations, and the things worth returning to. Do not invent specific facts about real people.',
}

let cached: AutomationSettings | null = null

export async function getAutomationSettings(): Promise<AutomationSettings> {
  if (cached) return cached
  const rows = await getDb().select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1)
  if (!rows[0]) {
    cached = { ...defaultAutomationSettings }
    return cached
  }
  try {
    const stored = JSON.parse(rows[0].value) as Partial<AutomationSettings>
    cached = { ...defaultAutomationSettings, ...stored }
  } catch {
    cached = { ...defaultAutomationSettings }
  }
  return cached
}

export function invalidateAutomationSettings(): void {
  cached = null
}

export async function saveAutomationSettings(patch: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const current = await getAutomationSettings()
  const next = { ...current, ...patch }
  const now = new Date().toISOString()
  await getDb()
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(next), updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(next), updatedAt: now } })
  cached = next
  return next
}

export type AutomationActivityWithMedia = AutomationActivity & { media: MediaAsset | null }

export async function createActivity(input: { text: string; mediaId: string | null }): Promise<AutomationActivity> {
  const row: typeof automationActivity.$inferInsert = {
    id: crypto.randomUUID(),
    text: input.text,
    mediaId: input.mediaId,
    createdAt: new Date().toISOString(),
    consumedAt: null,
  }
  await getDb().insert(automationActivity).values(row)
  const saved = await getDb()
    .select()
    .from(automationActivity)
    .where(eq(automationActivity.id, row.id))
    .limit(1)
  return saved[0] ?? (row as AutomationActivity)
}

export async function latestUnconsumedActivity(): Promise<AutomationActivityWithMedia | null> {
  const rows = await getDb()
    .select({ activity: automationActivity, media })
    .from(automationActivity)
    .leftJoin(media, eq(automationActivity.mediaId, media.id))
    .where(isNull(automationActivity.consumedAt))
    .orderBy(desc(automationActivity.createdAt))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { ...row.activity, media: row.media ?? null }
}

export async function listActivities(limit = 20): Promise<AutomationActivityWithMedia[]> {
  const rows = await getDb()
    .select({ activity: automationActivity, media })
    .from(automationActivity)
    .leftJoin(media, eq(automationActivity.mediaId, media.id))
    .orderBy(desc(automationActivity.createdAt))
    .limit(limit)
  return rows.map((row) => ({ ...row.activity, media: row.media ?? null }))
}

export async function markActivityConsumed(id: string): Promise<void> {
  await getDb()
    .update(automationActivity)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(automationActivity.id, id))
}

export type AutomationRunWithArticle = AutomationRun & {
  articleTitle: string | null
  articleSlug: string | null
}

export async function createRun(input: {
  source: 'manual' | 'cron'
  kind: 'activity' | 'initiative'
  activityId: string | null
  articleId: string | null
  status: AutomationRun['status']
  error?: string | null
  autoPublishAt: string | null
}): Promise<AutomationRun> {
  const row: typeof automationRuns.$inferInsert = {
    id: crypto.randomUUID(),
    source: input.source,
    kind: input.kind,
    activityId: input.activityId,
    articleId: input.articleId,
    status: input.status,
    error: input.error ?? null,
    createdAt: new Date().toISOString(),
    autoPublishAt: input.autoPublishAt,
  }
  await getDb().insert(automationRuns).values(row)
  const saved = await getDb().select().from(automationRuns).where(eq(automationRuns.id, row.id)).limit(1)
  return saved[0] ?? (row as AutomationRun)
}

export async function updateRun(
  id: string,
  patch: Partial<Pick<AutomationRun, 'status' | 'error' | 'autoPublishAt' | 'articleId'>>,
): Promise<void> {
  if (!Object.keys(patch).length) return
  await getDb().update(automationRuns).set(patch).where(eq(automationRuns.id, id))
}

export async function listRuns(limit = 20): Promise<AutomationRunWithArticle[]> {
  const rows = await getDb()
    .select({ run: automationRuns, articleTitle: articles.title, articleSlug: articles.slug })
    .from(automationRuns)
    .leftJoin(articles, eq(automationRuns.articleId, articles.id))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit)
  return rows.map((row) => ({
    ...row.run,
    articleTitle: row.articleTitle ?? null,
    articleSlug: row.articleSlug ?? null,
  }))
}

export async function dueRuns(now: string): Promise<AutomationRun[]> {
  return getDb()
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.status, 'pending'), lte(automationRuns.autoPublishAt, now)))
    .orderBy(desc(automationRuns.createdAt))
    .limit(20)
}

export async function countGenerationsSince(since: string): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(automationRuns)
    .where(
      and(
        gte(automationRuns.createdAt, since),
        isNotNull(automationRuns.articleId),
        ne(automationRuns.status, 'error'),
      ),
    )
  return rows[0]?.n ?? 0
}
