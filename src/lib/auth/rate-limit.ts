import { createHmac } from 'node:crypto'
import { getConfig } from '../config'
import { all, run } from '../db/client'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

function keyFingerprint(key: string): string {
  return createHmac('sha256', `rate-limit:${getConfig().SESSION_SECRET}`).update(key).digest('hex').slice(0, 32)
}

function memoryRateLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 }
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now()
  try {
    const rows = await all<{ count: number; reset_at: number }>(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
       RETURNING count, reset_at`,
      [keyFingerprint(key), now + windowMs, now, now],
    )
    const row = rows[0]
    if (!row) throw new Error('Rate limit write returned no row')
    const count = Number(row.count) || 0
    const resetAt = Number(row.reset_at) || now + windowMs
    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 }
  } catch (error) {
    console.warn('[rate-limit] database limiter failed; using memory fallback', error)
    return memoryRateLimit(key, limit, windowMs, now)
  }
}

export async function pruneRateLimits(): Promise<void> {
  await run('DELETE FROM rate_limits WHERE reset_at <= ?', [Date.now()]).catch(() => undefined)
}

export async function resetRateLimits(): Promise<void> {
  buckets.clear()
  lastSweep = Date.now()
  await run('DELETE FROM rate_limits').catch(() => undefined)
}
