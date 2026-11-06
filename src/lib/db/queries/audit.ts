import { count, desc, eq, lt } from 'drizzle-orm'
import { getDb } from '../client'
import { adminAuditLog, users } from '../schema'

export async function recordAudit(input: {
  actorId: string | null
  action: string
  detail?: string | null
  ipHash?: string | null
}): Promise<void> {
  await getDb().insert(adminAuditLog).values({
    id: crypto.randomUUID(),
    actorId: input.actorId,
    action: input.action.slice(0, 200),
    detail: input.detail ? input.detail.slice(0, 500) : null,
    ipHash: input.ipHash ? input.ipHash.slice(0, 64) : null,
    createdAt: new Date().toISOString(),
  })
}

export async function listAuditLog(options: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  const offset = Math.max(0, options.offset ?? 0)
  const [items, totals] = await Promise.all([
    getDb()
      .select({ entry: adminAuditLog, actorName: users.name })
      .from(adminAuditLog)
      .leftJoin(users, eq(adminAuditLog.actorId, users.id))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit)
      .offset(offset),
    getDb().select({ n: count() }).from(adminAuditLog),
  ])
  return { items, total: totals[0]?.n ?? 0 }
}

export async function pruneAuditLog(days = 365): Promise<void> {
  const cutoff = new Date(Date.now() - Math.max(30, days) * 86_400_000).toISOString()
  await getDb().delete(adminAuditLog).where(lt(adminAuditLog.createdAt, cutoff))
}
