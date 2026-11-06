import type { NewsletterSchedule } from '../db/schema'

export type Cadence = NewsletterSchedule['cadence']

export function periodDays(cadence: Cadence): number {
  if (cadence === 'daily') return 1
  if (cadence === 'monthly') return 30
  return 7
}

export function periodKey(cadence: Cadence, now = new Date()): string {
  if (cadence === 'daily') return now.toISOString().slice(0, 10)
  if (cadence === 'monthly') return now.toISOString().slice(0, 7)
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function isDigestDue(schedule: NewsletterSchedule, now = new Date()): boolean {
  if (!schedule.enabled) return false
  const hour = Math.min(23, Math.max(0, schedule.hourUtc))
  let scheduled: Date
  let graceMs: number
  if (schedule.cadence === 'daily') {
    scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour))
    graceMs = 12 * 3_600_000
  } else if (schedule.cadence === 'monthly') {
    scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, hour))
    graceMs = 48 * 3_600_000
  } else {
    const weekday = Math.min(6, Math.max(0, schedule.weekday))
    const diff = (now.getUTCDay() - weekday + 7) % 7
    scheduled = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, hour),
    )
    graceMs = 26 * 3_600_000
  }
  const elapsed = now.getTime() - scheduled.getTime()
  return elapsed >= 0 && elapsed <= graceMs
}

export function digestSubject(cadence: Cadence): string {
  if (cadence === 'daily') return 'Today on RhandytaVERSE'
  if (cadence === 'monthly') return 'This month on RhandytaVERSE'
  return 'This week on RhandytaVERSE'
}

export function digestIntro(cadence: Cadence): string {
  if (cadence === 'daily') return 'A short look at what readers have been reading today.'
  if (cadence === 'monthly') return 'A short look at what readers have been reading this month.'
  return 'A short look at what readers have been reading this week.'
}

export function cadenceLabel(cadence: Cadence): string {
  if (cadence === 'daily') return 'Daily'
  if (cadence === 'monthly') return 'Monthly'
  return 'Weekly'
}
