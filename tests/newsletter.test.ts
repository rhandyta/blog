import { describe, expect, test } from 'bun:test'
import type { NewsletterSchedule } from '../src/lib/db/schema'
import { isDigestDue, periodDays, periodKey } from '../src/lib/newsletter/schedule'

const base: NewsletterSchedule = {
  id: 'digest',
  enabled: true,
  cadence: 'weekly',
  weekday: 1,
  hourUtc: 2,
  metric: 'readers',
  articleLimit: 5,
  updatedAt: '2026-11-06T00:00:00.000Z',
}

describe('newsletter schedule', () => {
  test('uses a stable period key per cadence', () => {
    expect(periodKey('weekly', new Date('2026-11-09T02:30:00Z'))).toMatch(/^2026-W\d{2}$/)
    expect(periodKey('daily', new Date('2026-11-09T02:30:00Z'))).toBe('2026-11-09')
    expect(periodKey('monthly', new Date('2026-11-09T02:30:00Z'))).toBe('2026-11')
    expect(periodDays('daily')).toBe(1)
    expect(periodDays('weekly')).toBe(7)
    expect(periodDays('monthly')).toBe(30)
  })

  test('becomes due at the scheduled weekly hour and respects the enabled flag', () => {
    expect(isDigestDue(base, new Date('2026-11-09T01:30:00Z'))).toBe(false)
    expect(isDigestDue(base, new Date('2026-11-09T02:30:00Z'))).toBe(true)
    expect(isDigestDue(base, new Date('2026-11-10T02:30:00Z'))).toBe(true)
    expect(isDigestDue(base, new Date('2026-11-15T02:30:00Z'))).toBe(false)
    expect(isDigestDue({ ...base, enabled: false }, new Date('2026-11-09T02:30:00Z'))).toBe(false)
  })

  test('supports daily and monthly schedules', () => {
    const daily = { ...base, cadence: 'daily' as const }
    expect(isDigestDue(daily, new Date('2026-11-09T01:30:00Z'))).toBe(false)
    expect(isDigestDue(daily, new Date('2026-11-09T02:30:00Z'))).toBe(true)
    const monthly = { ...base, cadence: 'monthly' as const }
    expect(isDigestDue(monthly, new Date('2026-11-01T02:30:00Z'))).toBe(true)
  })
})
