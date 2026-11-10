import type { NewsletterSchedule } from '../db/schema'
import { DEFAULT_LOCALE, getTranslator, type Locale } from '../i18n'

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
    scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, hour))
    graceMs = 26 * 3_600_000
  }
  const elapsed = now.getTime() - scheduled.getTime()
  return elapsed >= 0 && elapsed <= graceMs
}

/** Digest subject line in the requested language. */
export function digestSubject(cadence: Cadence, locale: Locale = DEFAULT_LOCALE, siteTitle = 'RhandytaVERSE'): string {
  const t = getTranslator(locale)
  const vars = { site: siteTitle }
  if (cadence === 'daily') return t('mail.digestDailySubject', vars)
  if (cadence === 'monthly') return t('mail.digestMonthlySubject', vars)
  return t('mail.digestWeeklySubject', vars)
}

export function digestIntro(cadence: Cadence, locale: Locale = DEFAULT_LOCALE): string {
  const t = getTranslator(locale)
  if (cadence === 'daily') return t('mail.digestDailyIntro')
  if (cadence === 'monthly') return t('mail.digestMonthlyIntro')
  return t('mail.digestWeeklyIntro')
}

export function cadenceLabel(cadence: Cadence, locale: Locale = DEFAULT_LOCALE): string {
  const t = getTranslator(locale)
  if (cadence === 'daily') return t('mail.cadenceDaily')
  if (cadence === 'monthly') return t('mail.cadenceMonthly')
  return t('mail.cadenceWeekly')
}
