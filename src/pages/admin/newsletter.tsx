import type { NewsletterBroadcast, NewsletterEvent, NewsletterSchedule, User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash } from './shared'

const weekdayKeys = [
  'adminAudience.newsletter.weekdaySunday',
  'adminAudience.newsletter.weekdayMonday',
  'adminAudience.newsletter.weekdayTuesday',
  'adminAudience.newsletter.weekdayWednesday',
  'adminAudience.newsletter.weekdayThursday',
  'adminAudience.newsletter.weekdayFriday',
  'adminAudience.newsletter.weekdaySaturday',
] as const

export function NewsletterPage({
  user,
  csrfToken,
  confirmedCount,
  pendingCount,
  emailReady,
  broadcasts,
  schedule,
  events,
  webhookReady,
  flash,
}: {
  user: User
  csrfToken: string
  confirmedCount: number
  pendingCount: number
  emailReady: boolean
  broadcasts: NewsletterBroadcast[]
  schedule: NewsletterSchedule
  events: NewsletterEvent[]
  webhookReady: boolean
  flash: Flash
}) {
  const { t, formatDate, formatNumber, href } = useI18n()
  const weekdayLabels = weekdayKeys.map((key) => t(key))
  const weekday = weekdayLabels[schedule.weekday] ?? t('adminAudience.newsletter.weekdayMonday')
  const cadence =
    schedule.cadence === 'daily'
      ? t('adminAudience.newsletter.cadenceDaily')
      : schedule.cadence === 'monthly'
        ? t('adminAudience.newsletter.cadenceMonthly')
        : t('adminAudience.newsletter.cadenceWeekly')
  return (
    <AdminLayout
      user={user}
      path="/admin/newsletter"
      title={t('adminAudience.newsletter.title')}
      subtitle={t('adminAudience.newsletter.subtitle', {
        confirmed: formatNumber(confirmedCount),
        pending: formatNumber(pendingCount),
      })}
      actions={
        <a className="btn btn--ghost" href={href('/admin/subscribers')}>
          {t('adminAudience.newsletter.subscribers')} →
        </a>
      }
      flash={flash}
      csrfToken={csrfToken}
    >
      {!emailReady ? (
        <div className="flash" data-tone="error" role="alert">
          {t('adminAudience.newsletter.emailNotConfiguredBefore')} <code>RESEND_API_KEY</code>{' '}
          {t('adminAudience.newsletter.emailNotConfiguredAfter')}
        </div>
      ) : null}

      <form method="post" action="/admin/newsletter/send" className="admin-form" style={{ maxWidth: '52rem' }}>
        <CsrfField token={csrfToken} />
        <section className="admin-card">
          <h2>{t('adminAudience.newsletter.compose')}</h2>
          <div className="field">
            <label htmlFor="subject">{t('adminAudience.common.subject')}</label>
            <input
              className="input"
              id="subject"
              name="subject"
              maxLength={160}
              required
              placeholder={t('adminAudience.newsletter.subjectPlaceholder')}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="body">{t('adminAudience.newsletter.message')}</label>
            <textarea
              className="textarea"
              id="body"
              name="body"
              rows={14}
              maxLength={20000}
              required
              placeholder={t('adminAudience.newsletter.messagePlaceholder')}
            />
            <p className="hint" style={{ marginTop: '0.45rem' }}>
              {t('adminAudience.newsletter.plainTextHint')}
            </p>
          </div>
          <div className="field">
            <label htmlFor="testEmail">{t('adminAudience.newsletter.testRecipient')}</label>
            <input className="input" id="testEmail" name="testEmail" type="email" defaultValue={user.email} />
            <p className="hint" style={{ marginTop: '0.35rem' }}>
              {t('adminAudience.newsletter.testHint')}
            </p>
          </div>
          <div className="form-actions">
            <button className="btn btn--ghost" type="submit" formAction="/admin/newsletter/test" disabled={!emailReady}>
              {t('adminAudience.newsletter.sendTest')}
            </button>
            <button
              className="btn btn--solid"
              type="submit"
              disabled={!emailReady || confirmedCount === 0}
              data-confirm={t('adminAudience.newsletter.sendConfirm', { count: confirmedCount })}
            >
              {t('adminAudience.newsletter.sendTo', { count: confirmedCount })}
            </button>
          </div>
        </section>
      </form>

      <section className="admin-card" style={{ marginTop: '1.25rem' }}>
        <div className="admin-card__head">
          <h2>{t('adminAudience.newsletter.scheduledDigest')}</h2>
          <span className="meta">
            {cadence} · {weekday} · {String(schedule.hourUtc).padStart(2, '0')}:00 UTC
          </span>
        </div>
        <p className="hint" style={{ marginBottom: '1rem' }}>
          {t('adminAudience.newsletter.scheduleHint')}
        </p>
        <form method="post" action="/admin/newsletter/schedule" className="admin-form">
          <CsrfField token={csrfToken} />
          <label className="checkbox">
            <input type="checkbox" name="enabled" defaultChecked={schedule.enabled} />
            <span>{t('adminAudience.newsletter.enableDigest')}</span>
          </label>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cadence">{t('adminAudience.newsletter.cadence')}</label>
              <select className="select" id="cadence" name="cadence" defaultValue={schedule.cadence}>
                <option value="weekly">{t('adminAudience.newsletter.cadenceWeekly')}</option>
                <option value="daily">{t('adminAudience.newsletter.cadenceDaily')}</option>
                <option value="monthly">{t('adminAudience.newsletter.cadenceMonthly')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="weekday">{t('adminAudience.newsletter.day')}</label>
              <select className="select" id="weekday" name="weekday" defaultValue={String(schedule.weekday)}>
                {weekdayKeys.map((key, index) => (
                  <option key={key} value={index}>
                    {weekdayLabels[index]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="hourUtc">{t('adminAudience.newsletter.time')}</label>
              <select className="select" id="hourUtc" name="hourUtc" defaultValue={String(schedule.hourUtc)}>
                <option value="2">02:00 UTC · 09:00 WIB</option>
                <option value="14">14:00 UTC · 21:00 WIB</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="metric">{t('adminAudience.newsletter.rankBy')}</label>
              <select className="select" id="metric" name="metric" defaultValue={schedule.metric}>
                <option value="readers">{t('adminAudience.common.uniqueReaders')}</option>
                <option value="views">{t('adminAudience.common.views')}</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="articleLimit">{t('adminAudience.newsletter.articlesInDigest')}</label>
            <select
              className="select"
              id="articleLimit"
              name="articleLimit"
              defaultValue={String(schedule.articleLimit)}
            >
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="8">8</option>
              <option value="10">10</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn--solid" type="submit">
              {t('adminAudience.newsletter.saveSchedule')}
            </button>
          </div>
        </form>
        <form
          method="post"
          action="/admin/newsletter/digest"
          style={{ marginTop: '1rem' }}
          data-confirm={t('adminAudience.newsletter.digestConfirm')}
        >
          <CsrfField token={csrfToken} />
          <button className="btn btn--ghost" type="submit" disabled={!emailReady || confirmedCount === 0}>
            {t('adminAudience.newsletter.sendDigestNow')}
          </button>
        </form>
      </section>

      <section className="admin-card" style={{ marginTop: '1.25rem' }}>
        <h2>{t('adminAudience.newsletter.recentSends')}</h2>
        {broadcasts.length ? (
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminAudience.common.subject')}</th>
                  <th>{t('adminAudience.newsletter.type')}</th>
                  <th>{t('adminAudience.newsletter.sent')}</th>
                  <th>{t('adminAudience.newsletter.recipients')}</th>
                  <th>{t('adminAudience.newsletter.failed')}</th>
                  <th>{t('adminAudience.common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((broadcast) => (
                  <tr key={broadcast.id}>
                    <td className="title-cell">{broadcast.subject}</td>
                    <td className="muted-cell">{broadcast.kind}</td>
                    <td className="num">{formatNumber(broadcast.sentCount)}</td>
                    <td className="num">{formatNumber(broadcast.recipientCount)}</td>
                    <td className="num">{formatNumber(broadcast.failedCount)}</td>
                    <td className="muted-cell">{formatDate(broadcast.createdAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">{t('adminAudience.newsletter.noBroadcasts')}</p>
        )}
      </section>

      <section className="admin-card" style={{ marginTop: '1.25rem' }}>
        <div className="admin-card__head">
          <h2>{t('adminAudience.newsletter.deliveryEvents')}</h2>
          {webhookReady ? (
            <span className="meta">{t('adminAudience.newsletter.resendWebhook')}</span>
          ) : (
            <span className="meta">{t('adminAudience.newsletter.webhookSecretMissing')}</span>
          )}
        </div>
        {!webhookReady ? (
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminAudience.newsletter.webhookHintBefore')} <code>/api/webhooks/resend</code>{' '}
            {t('adminAudience.newsletter.webhookHintMiddle')} <code>RESEND_WEBHOOK_SECRET</code>{' '}
            {t('adminAudience.newsletter.webhookHintAfter')}
          </p>
        ) : null}
        {events.length ? (
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminAudience.newsletter.event')}</th>
                  <th>{t('adminAudience.common.email')}</th>
                  <th>{t('adminAudience.common.subject')}</th>
                  <th>{t('adminAudience.common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="muted-cell">{event.type.replace(/^email\./, '')}</td>
                    <td className="muted-cell">{event.email ?? '—'}</td>
                    <td className="title-cell">{event.subject ?? '—'}</td>
                    <td className="muted-cell">{formatDate(event.createdAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">{t('adminAudience.newsletter.noEvents')}</p>
        )}
      </section>
    </AdminLayout>
  )
}
