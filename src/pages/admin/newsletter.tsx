import type { NewsletterBroadcast, NewsletterSchedule, User } from '../../lib/db/schema'
import { formatDate } from '../../lib/content/html'
import { cadenceLabel } from '../../lib/newsletter/schedule'
import { AdminLayout } from '../../components/layout'
import { CsrfField, Flash } from './shared'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function NewsletterPage({
  user,
  csrfToken,
  confirmedCount,
  pendingCount,
  emailReady,
  broadcasts,
  schedule,
  flash,
}: {
  user: User
  csrfToken: string
  confirmedCount: number
  pendingCount: number
  emailReady: boolean
  broadcasts: NewsletterBroadcast[]
  schedule: NewsletterSchedule
  flash: Flash
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/newsletter"
      title="Newsletter"
      subtitle={`${confirmedCount} confirmed · ${pendingCount} pending`}
      actions={<a className="btn btn--ghost" href="/admin/subscribers">Subscribers →</a>}
      flash={flash}
      csrfToken={csrfToken}
    >
      {!emailReady ? (
        <div className="flash" data-tone="error" role="alert">
          Email delivery is not configured. Add <code>RESEND_API_KEY</code> and verify the sending domain before
          sending a newsletter.
        </div>
      ) : null}

      <form
        method="post"
        action="/admin/newsletter/send"
        className="admin-form"
        style={{ maxWidth: '52rem' }}
        data-confirm={`Send this newsletter to ${confirmedCount} confirmed subscriber${confirmedCount === 1 ? '' : 's'}?`}
      >
        <CsrfField token={csrfToken} />
        <section className="admin-card">
          <h2>Compose</h2>
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input
              className="input"
              id="subject"
              name="subject"
              maxLength={160}
              required
              placeholder="A new letter from RhandytaVERSE"
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="body">Message</label>
            <textarea
              className="textarea"
              id="body"
              name="body"
              rows={14}
              maxLength={20000}
              required
              placeholder="Write the letter here. Leave a blank line between paragraphs."
            />
            <p className="hint" style={{ marginTop: '0.45rem' }}>
              Plain text. The unsubscribe link and List-Unsubscribe header are added automatically for each recipient.
              The free Resend tier supports up to 100 messages per day.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="btn btn--solid"
              type="submit"
              disabled={!emailReady || confirmedCount === 0}
            >
              Send to {confirmedCount} subscriber{confirmedCount === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      </form>

      <section className="admin-card" style={{ marginTop: '1.25rem' }}>
        <div className="admin-card__head">
          <h2>Scheduled digest</h2>
          <span className="meta">
            {cadenceLabel(schedule.cadence)} · {weekdays[schedule.weekday] ?? 'Monday'} · {String(schedule.hourUtc).padStart(2, '0')}:00 UTC
          </span>
        </div>
        <p className="hint" style={{ marginBottom: '1rem' }}>
          Weekly is the recommended rhythm: one calm reminder instead of a daily interruption. The digest ranks by
          unique readers and shows views as context.
        </p>
        <form method="post" action="/admin/newsletter/schedule" className="admin-form">
          <CsrfField token={csrfToken} />
          <label className="checkbox">
            <input type="checkbox" name="enabled" defaultChecked={schedule.enabled} />
            <span>Enable scheduled digest</span>
          </label>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cadence">Cadence</label>
              <select className="select" id="cadence" name="cadence" defaultValue={schedule.cadence}>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="weekday">Day</label>
              <select className="select" id="weekday" name="weekday" defaultValue={String(schedule.weekday)}>
                {weekdays.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="hourUtc">Time</label>
              <select className="select" id="hourUtc" name="hourUtc" defaultValue={String(schedule.hourUtc)}>
                <option value="2">02:00 UTC · 09:00 WIB</option>
                <option value="14">14:00 UTC · 21:00 WIB</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="metric">Rank by</label>
              <select className="select" id="metric" name="metric" defaultValue={schedule.metric}>
                <option value="readers">Unique readers</option>
                <option value="views">Views</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="articleLimit">Articles in the digest</label>
            <select className="select" id="articleLimit" name="articleLimit" defaultValue={String(schedule.articleLimit)}>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="8">8</option>
              <option value="10">10</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn--solid" type="submit">Save schedule</button>
          </div>
        </form>
        <form
          method="post"
          action="/admin/newsletter/digest"
          style={{ marginTop: '1rem' }}
          data-confirm="Send the digest to every confirmed subscriber now? This will also mark the current period as sent."
        >
          <CsrfField token={csrfToken} />
          <button className="btn btn--ghost" type="submit" disabled={!emailReady || confirmedCount === 0}>
            Send digest now
          </button>
        </form>
      </section>

      <section className="admin-card" style={{ marginTop: '1.25rem' }}>
        <h2>Recent sends</h2>
        {broadcasts.length ? (
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Sent</th>
                  <th>Recipients</th>
                  <th>Failed</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((broadcast) => (
                  <tr key={broadcast.id}>
                    <td className="title-cell">{broadcast.subject}</td>
                    <td className="muted-cell">{broadcast.kind}</td>
                    <td className="num">{broadcast.sentCount.toLocaleString('en-US')}</td>
                    <td className="num">{broadcast.recipientCount.toLocaleString('en-US')}</td>
                    <td className="num">{broadcast.failedCount.toLocaleString('en-US')}</td>
                    <td className="muted-cell">{formatDate(broadcast.createdAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No newsletter has been sent yet.</p>
        )}
      </section>
    </AdminLayout>
  )
}
