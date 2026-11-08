import { and, count, desc, gte, like, lt } from 'drizzle-orm'
import { getConfig, isRemoteDatabase } from '../config'
import { get, getDb } from '../db/client'
import { opsEvents, type OpsEvent } from '../db/schema'
import { emailConfigured, sendEmail } from '../email/mailer'

export type OpsLevel = 'info' | 'warn' | 'error'

export type RecordOpsEventInput = {
  level: OpsLevel
  source: string
  code: string
  message: string
  detail?: string | Record<string, unknown> | null
  requestId?: string | null
  path?: string | null
  notify?: boolean
  bypassCooldown?: boolean
}

export type OpsDeliveryHooks = {
  fetchImpl?: typeof fetch
  sendEmailImpl?: typeof sendEmail
}

const ALERT_COOLDOWN_MS = 15 * 60 * 1000
const COOLDOWN_MAX_ENTRIES = 500
const alertCooldowns = new Map<string, number>()

export function resetAlertCooldowns(): void {
  alertCooldowns.clear()
}

function serializeDetail(detail: RecordOpsEventInput['detail']): string | null {
  if (detail === undefined || detail === null) return null
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail)
  return text ? text.slice(0, 2000) : null
}

function shouldDispatchAlert(fingerprint: string, bypassCooldown: boolean): boolean {
  if (bypassCooldown) return true
  const now = Date.now()
  const last = alertCooldowns.get(fingerprint)
  if (last !== undefined && now - last < ALERT_COOLDOWN_MS) {
    return false
  }
  alertCooldowns.set(fingerprint, now)
  if (alertCooldowns.size > COOLDOWN_MAX_ENTRIES) {
    for (const [key, timestamp] of alertCooldowns) {
      if (now - timestamp >= ALERT_COOLDOWN_MS) alertCooldowns.delete(key)
    }
    while (alertCooldowns.size > COOLDOWN_MAX_ENTRIES) {
      const oldest = alertCooldowns.keys().next().value
      if (oldest === undefined) break
      alertCooldowns.delete(oldest)
    }
  }
  return true
}

export async function dispatchOpsAlert(
  event: {
    level: OpsLevel
    source: string
    code: string
    message: string
    detail: string | null
    requestId: string | null
    path: string | null
    at: string
  },
  hooks: OpsDeliveryHooks = {},
): Promise<{ notified: boolean; webhookOk?: boolean; emailOk?: boolean }> {
  const config = getConfig()
  const fetchFn = hooks.fetchImpl ?? fetch
  const mailFn = hooks.sendEmailImpl ?? sendEmail

  let webhookOk: boolean | undefined
  let emailOk: boolean | undefined

  const summary = `[${event.level.toUpperCase()}] ${config.SITE_NAME} · ${event.source}/${event.code}: ${event.message}${
    event.path ? ` (${event.path})` : ''
  }${event.requestId ? ` [req:${event.requestId}]` : ''}`

  if (config.OPS_ALERT_WEBHOOK_URL) {
    try {
      const response = await fetchFn(config.OPS_ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: summary,
          content: summary,
          site: config.SITE_NAME,
          origin: config.PUBLIC_ORIGIN,
          severity: event.level,
          source: event.source,
          code: event.code,
          message: event.message,
          detail: event.detail,
          requestId: event.requestId,
          path: event.path,
          at: event.at,
        }),
        signal: AbortSignal.timeout(5_000),
      })
      webhookOk = response.ok
      if (!response.ok) {
        console.error(`[ops] webhook alert returned HTTP ${response.status}`)
      }
    } catch (error) {
      webhookOk = false
      console.error('[ops] webhook alert delivery failed', error)
    }
  }

  if (config.OPS_ALERT_EMAIL && emailConfigured()) {
    try {
      const escapedMessage = event.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const escapedDetail = (event.detail ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const result = await mailFn({
        to: config.OPS_ALERT_EMAIL,
        subject: `[${config.SITE_NAME}] Alert (${event.level.toUpperCase()}): ${event.source}/${event.code}`,
        text: [
          summary,
          `Time: ${event.at}`,
          event.path ? `Path: ${event.path}` : null,
          event.requestId ? `Request ID: ${event.requestId}` : null,
          event.detail ? `\nDetail:\n${event.detail}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        html: `<p><strong>${summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></p>
<ul>
  <li><strong>Time:</strong> ${event.at}</li>
  <li><strong>Source:</strong> ${event.source}</li>
  <li><strong>Code:</strong> ${event.code}</li>
  ${event.path ? `<li><strong>Path:</strong> ${event.path}</li>` : ''}
  ${event.requestId ? `<li><strong>Request ID:</strong> ${event.requestId}</li>` : ''}
</ul>
<p>${escapedMessage}</p>
${escapedDetail ? `<pre>${escapedDetail}</pre>` : ''}`,
      })
      emailOk = result.ok
      if (!result.ok) {
        console.error('[ops] email alert delivery failed:', result.error)
      }
    } catch (error) {
      emailOk = false
      console.error('[ops] email alert delivery crashed', error)
    }
  }

  return {
    notified: Boolean(webhookOk || emailOk),
    webhookOk,
    emailOk,
  }
}

export async function recordOpsEvent(
  input: RecordOpsEventInput,
  hooks: OpsDeliveryHooks = {},
): Promise<OpsEvent | null> {
  const now = new Date().toISOString()
  const source = input.source.slice(0, 80)
  const code = input.code.slice(0, 80)
  const message = input.message.slice(0, 500)
  const detail = serializeDetail(input.detail)
  const requestId = input.requestId ? input.requestId.slice(0, 64) : null
  const path = input.path ? input.path.slice(0, 200) : null

  const logLine = `[ops:${input.level}] ${source}/${code}${requestId ? ` [${requestId}]` : ''}${
    path ? ` ${path}` : ''
  } — ${message}`
  if (input.level === 'error') {
    console.error(logLine)
  } else if (input.level === 'warn') {
    console.warn(logLine)
  } else {
    console.info(logLine)
  }

  const wantsNotify = input.notify ?? input.level === 'error'
  let notified = false
  if (wantsNotify) {
    const fingerprint = `${source}:${code}:${path ?? ''}`
    if (shouldDispatchAlert(fingerprint, Boolean(input.bypassCooldown))) {
      const delivered = await dispatchOpsAlert(
        {
          level: input.level,
          source,
          code,
          message,
          detail,
          requestId,
          path,
          at: now,
        },
        hooks,
      )
      notified = delivered.notified
    }
  }

  const row: OpsEvent = {
    id: crypto.randomUUID(),
    level: input.level,
    source,
    code,
    message,
    detail,
    requestId,
    path,
    notified,
    createdAt: now,
  }

  try {
    await getDb().insert(opsEvents).values(row)
    return row
  } catch (error) {
    console.error('[ops] failed to persist ops event', error)
    return null
  }
}

export async function listOpsEvents(options: {
  limit?: number
  offset?: number
  level?: OpsLevel | 'all'
} = {}): Promise<{
  items: OpsEvent[]
  total: number
  summary: { errors24h: number; warns24h: number; total: number }
}> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 40))
  const offset = Math.max(0, options.offset ?? 0)
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const filter = options.level && options.level !== 'all' ? like(opsEvents.level, options.level) : undefined

  const [items, totalRows, errors24hRows, warns24hRows, allTotalRows] = await Promise.all([
    filter
      ? getDb()
          .select()
          .from(opsEvents)
          .where(filter)
          .orderBy(desc(opsEvents.createdAt))
          .limit(limit)
          .offset(offset)
      : getDb().select().from(opsEvents).orderBy(desc(opsEvents.createdAt)).limit(limit).offset(offset),
    filter
      ? getDb().select({ n: count() }).from(opsEvents).where(filter)
      : getDb().select({ n: count() }).from(opsEvents),
    getDb()
      .select({ n: count() })
      .from(opsEvents)
      .where(and(like(opsEvents.level, 'error'), gte(opsEvents.createdAt, cutoff24h))),
    getDb()
      .select({ n: count() })
      .from(opsEvents)
      .where(and(like(opsEvents.level, 'warn'), gte(opsEvents.createdAt, cutoff24h))),
    getDb().select({ n: count() }).from(opsEvents),
  ])

  return {
    items,
    total: Number(totalRows[0]?.n ?? 0),
    summary: {
      errors24h: Number(errors24hRows[0]?.n ?? 0),
      warns24h: Number(warns24hRows[0]?.n ?? 0),
      total: Number(allTotalRows[0]?.n ?? 0),
    },
  }
}

export async function getLatestCronHeartbeat(): Promise<OpsEvent | null> {
  const rows = await getDb()
    .select()
    .from(opsEvents)
    .where(like(opsEvents.source, 'cron.%'))
    .orderBy(desc(opsEvents.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function pruneOpsEvents(days = 30): Promise<void> {
  const cutoff = new Date(Date.now() - Math.max(7, days) * 86_400_000).toISOString()
  await getDb().delete(opsEvents).where(lt(opsEvents.createdAt, cutoff))
}

export async function checkDatabaseHealth(): Promise<{
  ok: boolean
  latencyMs: number
  mode: 'turso' | 'sqlite'
}> {
  const start = performance.now()
  const mode = isRemoteDatabase() ? 'turso' : 'sqlite'
  try {
    const row = await get<{ ok: number }>('SELECT 1 AS ok')
    return {
      ok: Number(row?.ok) === 1,
      latencyMs: Math.round(performance.now() - start),
      mode,
    }
  } catch {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      mode,
    }
  }
}

export async function sendTestAlert(
  actorEmail: string,
  hooks: OpsDeliveryHooks = {},
): Promise<{ status: 'sent' | 'not-configured' | 'error'; webhookOk?: boolean; emailOk?: boolean }> {
  const config = getConfig()
  const hasWebhook = Boolean(config.OPS_ALERT_WEBHOOK_URL)
  const hasEmail = Boolean(config.OPS_ALERT_EMAIL && emailConfigured())
  if (!hasWebhook && !hasEmail) {
    return { status: 'not-configured' }
  }

  const now = new Date().toISOString()
  const delivery = await dispatchOpsAlert(
    {
      level: 'info',
      source: 'admin.system',
      code: 'test_alert',
      message: `Manual test alert triggered by ${actorEmail}`,
      detail: JSON.stringify({ actorEmail, origin: config.PUBLIC_ORIGIN }),
      requestId: null,
      path: '/admin/system/test-alert',
      at: now,
    },
    hooks,
  )

  try {
    await getDb().insert(opsEvents).values({
      id: crypto.randomUUID(),
      level: delivery.notified ? 'info' : 'error',
      source: 'admin.system',
      code: 'test_alert',
      message: delivery.notified
        ? `Test alert sent (${actorEmail})`
        : `Test alert delivery failed (${actorEmail})`,
      detail: JSON.stringify(delivery),
      requestId: null,
      path: '/admin/system/test-alert',
      notified: delivery.notified,
      createdAt: now,
    })
  } catch {
    // ignore ops event insert error
  }

  return {
    status: delivery.notified ? 'sent' : 'error',
    webhookOk: delivery.webhookOk,
    emailOk: delivery.emailOk,
  }
}
