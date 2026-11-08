import type { OpsEvent, User } from '../../lib/db/schema'
import type { OpsLevel } from '../../lib/ops/monitor'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash, PaginationNav } from './shared'

export type SystemIntegrationStatus = {
  db: { ok: boolean; latencyMs: number; mode: 'turso' | 'sqlite' }
  storage: 'blob' | 'local'
  emailConfigured: boolean
  webhookConfigured: boolean
  geminiConfigured: boolean
  cloudflareConfigured: boolean
  cronSecretConfigured: boolean
  alertWebhookConfigured: boolean
  alertEmailConfigured: boolean
}

function LevelBadge({ level }: { level: OpsEvent['level'] }) {
  const status = level === 'error' ? 'archived' : level === 'warn' ? 'scheduled' : 'published'
  return (
    <span className="status" data-status={status}>
      {level}
    </span>
  )
}

function ReadyBadge({ ready, yes = 'Configured', no = 'Missing' }: { ready: boolean; yes?: string; no?: string }) {
  return (
    <span className="status" data-status={ready ? 'published' : 'draft'}>
      {ready ? yes : no}
    </span>
  )
}

export function SystemPage({
  user,
  status,
  latestCron,
  events,
  summary,
  page,
  totalPages,
  level,
  session,
  flash,
}: {
  user: User
  status: SystemIntegrationStatus
  latestCron: OpsEvent | null
  events: OpsEvent[]
  summary: { errors24h: number; warns24h: number; total: number }
  page: number
  totalPages: number
  level: OpsLevel | 'all'
  session: { csrfToken: string }
  flash: Flash
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/system"
      title="System & backups"
      subtitle="Runtime health, exports, and operational monitoring"
      actions={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <a className="btn btn--ghost" href="/admin/audit">
            Audit log →
          </a>
          <a className="btn btn--solid" href="/admin/system/backup.json">
            Download JSON backup
          </a>
        </div>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{status.db.ok ? 'OK' : 'ERR'}</span>
            <span className="stat__label">Database ({status.db.mode})</span>
            <span className="stat__delta">{status.db.latencyMs} ms ping</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{summary.errors24h}</span>
            <span className="stat__label">Errors (24h)</span>
            <span className="stat__delta">{summary.warns24h} warnings · {summary.total} logged</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{latestCron ? (latestCron.level === 'error' ? 'FAIL' : 'OK') : '—'}</span>
            <span className="stat__label">Last cron heartbeat</span>
            <span className="stat__delta">
              {latestCron ? formatDate(latestCron.createdAt, 'short') : 'No cron run recorded'}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{status.alertWebhookConfigured || status.alertEmailConfigured ? 'ON' : 'LOG'}</span>
            <span className="stat__label">Alert delivery</span>
            <span className="stat__delta">
              {status.alertWebhookConfigured ? 'Webhook ' : ''}
              {status.alertEmailConfigured ? 'Email' : ''}
              {!status.alertWebhookConfigured && !status.alertEmailConfigured ? 'Console + DB only' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>Backups &amp; content export</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            Download a portable backup directly from the editorial desk. Content backups exclude password hashes,
            active session tokens, and unsubscribe secrets.
          </p>
          <div className="form-actions">
            <a className="btn btn--solid" href="/admin/system/backup.json">
              Download JSON backup
            </a>
            <a className="btn btn--ghost" href="/admin/system/articles.zip">
              Download Markdown archive (.zip)
            </a>
          </div>
          <p className="hint" style={{ marginTop: '0.9rem' }}>
            Individual articles can also be exported as frontmatter Markdown from the Articles list or Revision
            history.
          </p>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <div className="admin-card__head">
            <h2>Integrations &amp; alert routing</h2>
            <form method="post" action="/admin/system/test-alert">
              <CsrfField token={session.csrfToken} />
              <button
                className="btn btn--ghost btn--small"
                type="submit"
                disabled={!status.alertWebhookConfigured && !status.alertEmailConfigured}
              >
                Send test alert
              </button>
            </form>
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table" style={{ minWidth: '18rem' }}>
              <tbody>
                <tr>
                  <td>Media storage</td>
                  <td className="muted-cell">{status.storage === 'blob' ? 'Vercel Blob' : 'Local disk'}</td>
                </tr>
                <tr>
                  <td>Cron auth secret</td>
                  <td>
                    <ReadyBadge ready={status.cronSecretConfigured} yes="Protected" no="Missing" />
                  </td>
                </tr>
                <tr>
                  <td>Resend mailer / webhook</td>
                  <td>
                    <ReadyBadge
                      ready={status.emailConfigured && status.webhookConfigured}
                      yes="Ready"
                      no={status.emailConfigured ? 'No webhook secret' : 'Missing'}
                    />
                  </td>
                </tr>
                <tr>
                  <td>AI providers (Gemini / Cloudflare)</td>
                  <td>
                    <ReadyBadge
                      ready={status.geminiConfigured}
                      yes={status.cloudflareConfigured ? 'Gemini + CF' : 'Gemini only'}
                      no="Not configured"
                    />
                  </td>
                </tr>
                <tr>
                  <td>Alert webhook (<code>OPS_ALERT_WEBHOOK_URL</code>)</td>
                  <td>
                    <ReadyBadge ready={status.alertWebhookConfigured} />
                  </td>
                </tr>
                <tr>
                  <td>Alert email (<code>OPS_ALERT_EMAIL</code>)</td>
                  <td>
                    <ReadyBadge ready={status.alertEmailConfigured} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2>Operational events &amp; cron history</h2>
          <form method="post" action="/admin/system/prune-events">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--ghost btn--small" type="submit">
              Prune older than 30d
            </button>
          </form>
        </div>

        <form className="filter-bar" method="get" action="/admin/system">
          <div className="field">
            <label htmlFor="ops-level">Level</label>
            <select className="select" id="ops-level" name="level" defaultValue={level}>
              <option value="all">All levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info / Heartbeat</option>
            </select>
          </div>
          <button className="btn btn--ghost btn--small" type="submit">
            Filter
          </button>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Source / Code</th>
                <th>Message</th>
                <th>Path</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="muted-cell">{formatDate(event.createdAt, 'short')}</td>
                  <td>
                    <LevelBadge level={event.level} />
                  </td>
                  <td className="muted-cell">
                    {event.source} · {event.code}
                  </td>
                  <td>
                    <div>{event.message}</div>
                    {event.detail ? (
                      <div className="hint" style={{ fontSize: '0.75rem', wordBreak: 'break-word' }}>
                        {event.detail.slice(0, 180)}
                        {event.detail.length > 180 ? '…' : ''}
                      </div>
                    ) : null}
                  </td>
                  <td className="muted-cell">
                    {event.path ?? '—'}
                    {event.requestId ? ` (${event.requestId})` : ''}
                  </td>
                  <td className="muted-cell">{event.notified ? 'Sent' : '—'}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={6} className="hint" style={{ padding: '1.5rem' }}>
                    No operational events recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationNav
          page={page}
          totalPages={totalPages}
          basePath="/admin/system"
          query={{ level: level === 'all' ? undefined : level }}
        />
      </section>
    </AdminLayout>
  )
}
