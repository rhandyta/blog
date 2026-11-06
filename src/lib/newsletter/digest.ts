import { getConfig } from '../config'
import { digestEmail } from '../email/templates'
import { emailConfigured, sendEmailBatch } from '../email/mailer'
import { getSiteSettings } from '../db/queries/taxonomy'
import { getDigestArticles } from '../db/queries/analytics'
import { getNewsletterSchedule, hasDigestForPeriod } from '../db/queries/newsletter'
import { listConfirmedSubscribers, recordNewsletterBroadcast } from '../db/queries/subscribers'
import {
  cadenceLabel,
  digestIntro,
  digestSubject,
  isDigestDue,
  periodDays,
  periodKey,
} from './schedule'

export type DigestRunResult =
  | { status: 'sent'; sent: number; failed: number; recipients: number; articles: number; period: string }
  | { status: 'skipped'; reason: 'disabled' | 'not-due' | 'already-sent' | 'no-articles' | 'no-subscribers' }
  | { status: 'error'; reason: 'not-configured' | 'too-many' | 'failed' }

export async function runScheduledNewsletter(options: {
  force?: boolean
  actorId?: string | null
  now?: Date
} = {}): Promise<DigestRunResult> {
  const now = options.now ?? new Date()
  const schedule = await getNewsletterSchedule()
  if (!options.force) {
    if (!schedule.enabled) return { status: 'skipped', reason: 'disabled' }
    if (!isDigestDue(schedule, now)) return { status: 'skipped', reason: 'not-due' }
  }

  const period = periodKey(schedule.cadence, now)
  if (await hasDigestForPeriod(period)) return { status: 'skipped', reason: 'already-sent' }
  if (!emailConfigured()) return { status: 'error', reason: 'not-configured' }

  const articles = await getDigestArticles({
    days: periodDays(schedule.cadence),
    limit: schedule.articleLimit,
    metric: schedule.metric,
  })
  if (!articles.length) return { status: 'skipped', reason: 'no-articles' }

  const recipients = await listConfirmedSubscribers()
  if (!recipients.length) return { status: 'skipped', reason: 'no-subscribers' }

  const settings = await getSiteSettings()
  const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
  const subject = digestSubject(schedule.cadence)
  const intro = digestIntro(schedule.cadence)
  const messages = recipients.map((subscriber) => {
    const unsubscribeUrl = `${origin}/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`
    return {
      to: subscriber.email,
      ...digestEmail({
        siteTitle: settings.title,
        origin,
        subject,
        intro,
        articles,
        unsubscribeUrl,
      }),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  })
  const results = await sendEmailBatch(messages)
  const sent = results.filter((result) => result.ok).length
  const failed = results.length - sent

  await recordNewsletterBroadcast({
    subject,
    body: `${cadenceLabel(schedule.cadence)} digest · ${articles.map((article) => article.title).join(' · ')}`,
    recipientCount: recipients.length,
    sentCount: sent,
    failedCount: failed,
    createdBy: options.actorId ?? null,
    kind: 'digest',
    periodKey: period,
  })

  if (!sent) return { status: 'error', reason: 'failed' }
  return {
    status: 'sent',
    sent,
    failed,
    recipients: recipients.length,
    articles: articles.length,
    period,
  }
}
