import type { OpsEvent, User } from '../../lib/db/schema'
import type { OpsLevel } from '../../lib/ops/monitor'
import { useI18n } from '../../lib/i18n'
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

function ReadyBadge({ ready, yes, no }: { ready: boolean; yes?: string; no?: string }) {
  const { t } = useI18n()
  return (
    <span className="status" data-status={ready ? 'published' : 'draft'}>
      {ready ? (yes ?? t('adminSystem.system.configured')) : (no ?? t('adminSystem.system.missing'))}
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
  const { t, formatDate, href } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/system"
      title={t('adminSystem.system.title')}
      subtitle={t('adminSystem.system.subtitle')}
      actions={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <a className="btn btn--ghost" href={href('/admin/audit')}>
            {t('adminSystem.system.auditLog')}
          </a>
          <a className="btn btn--solid" href={href('/admin/system/backup.json')}>
            {t('adminSystem.system.downloadJson')}
          </a>
        </div>
      }
      flash={flash}
      csrfToken={session.csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">
              {status.db.ok ? t('adminSystem.system.ok') : t('adminSystem.system.err')}
            </span>
            <span className="stat__label">{t('adminSystem.system.database', { mode: status.db.mode })}</span>
            <span className="stat__delta">{t('adminSystem.system.ping', { ms: status.db.latencyMs })}</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{summary.errors24h}</span>
            <span className="stat__label">{t('adminSystem.system.errors24h')}</span>
            <span className="stat__delta">
              {t('adminSystem.system.errorsDelta', {
                warnings: summary.warns24h,
                total: summary.total,
              })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">
              {latestCron
                ? latestCron.level === 'error'
                  ? t('adminSystem.system.fail')
                  : t('adminSystem.system.ok')
                : t('adminSystem.system.none')}
            </span>
            <span className="stat__label">{t('adminSystem.system.lastCron')}</span>
            <span className="stat__delta">
              {latestCron ? formatDate(latestCron.createdAt, 'short') : t('adminSystem.system.noCron')}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">
              {status.alertWebhookConfigured || status.alertEmailConfigured
                ? t('adminSystem.system.on')
                : t('adminSystem.system.log')}
            </span>
            <span className="stat__label">{t('adminSystem.system.alertDelivery')}</span>
            <span className="stat__delta">
              {status.alertWebhookConfigured ? `${t('adminSystem.system.webhook')} ` : ''}
              {status.alertEmailConfigured ? t('adminSystem.system.email') : ''}
              {!status.alertWebhookConfigured && !status.alertEmailConfigured
                ? t('adminSystem.system.consoleOnly')
                : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ marginBottom: '1.5rem' }}>
        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <h2>{t('adminSystem.system.backupsHeading')}</h2>
          <p className="hint" style={{ marginBottom: '1rem' }}>
            {t('adminSystem.system.backupHint')}
          </p>
          <div className="form-actions">
            <a className="btn btn--solid" href={href('/admin/system/backup.json')}>
              {t('adminSystem.system.downloadJson')}
            </a>
            <a className="btn btn--ghost" href={href('/admin/system/articles.zip')}>
              {t('adminSystem.system.downloadArchive')}
            </a>
          </div>
          <p className="hint" style={{ marginTop: '0.9rem' }}>
            {t('adminSystem.system.exportHint')}
          </p>
        </section>

        <section className="admin-card" style={{ gridColumn: 'span 6' }}>
          <div className="admin-card__head">
            <h2>{t('adminSystem.system.integrations')}</h2>
            <form method="post" action="/admin/system/test-alert">
              <CsrfField token={session.csrfToken} />
              <button
                className="btn btn--ghost btn--small"
                type="submit"
                disabled={!status.alertWebhookConfigured && !status.alertEmailConfigured}
              >
                {t('adminSystem.system.sendTestAlert')}
              </button>
            </form>
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table" style={{ minWidth: '18rem' }}>
              <tbody>
                <tr>
                  <td>{t('adminSystem.system.mediaStorage')}</td>
                  <td className="muted-cell">
                    {status.storage === 'blob' ? t('adminSystem.system.vercelBlob') : t('adminSystem.system.localDisk')}
                  </td>
                </tr>
                <tr>
                  <td>{t('adminSystem.system.cronSecret')}</td>
                  <td>
                    <ReadyBadge
                      ready={status.cronSecretConfigured}
                      yes={t('adminSystem.system.protected')}
                      no={t('adminSystem.system.missing')}
                    />
                  </td>
                </tr>
                <tr>
                  <td>{t('adminSystem.system.resendMailer')}</td>
                  <td>
                    <ReadyBadge
                      ready={status.emailConfigured && status.webhookConfigured}
                      yes={t('adminSystem.system.ready')}
                      no={
                        status.emailConfigured
                          ? t('adminSystem.system.noWebhookSecret')
                          : t('adminSystem.system.missing')
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td>{t('adminSystem.system.aiProviders')}</td>
                  <td>
                    <ReadyBadge
                      ready={status.geminiConfigured}
                      yes={
                        status.cloudflareConfigured
                          ? t('adminSystem.system.geminiCF')
                          : t('adminSystem.system.geminiOnly')
                      }
                      no={t('adminSystem.system.notConfigured')}
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    {t('adminSystem.system.alertWebhook')} (<code>OPS_ALERT_WEBHOOK_URL</code>)
                  </td>
                  <td>
                    <ReadyBadge ready={status.alertWebhookConfigured} />
                  </td>
                </tr>
                <tr>
                  <td>
                    {t('adminSystem.system.alertEmail')} (<code>OPS_ALERT_EMAIL</code>)
                  </td>
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
          <h2>{t('adminSystem.system.eventsHeading')}</h2>
          <form method="post" action="/admin/system/prune-events">
            <CsrfField token={session.csrfToken} />
            <button className="btn btn--ghost btn--small" type="submit">
              {t('adminSystem.system.prune')}
            </button>
          </form>
        </div>

        <form className="filter-bar" method="get" action="/admin/system">
          <div className="field">
            <label htmlFor="ops-level">{t('adminSystem.system.level')}</label>
            <select className="select" id="ops-level" name="level" defaultValue={level}>
              <option value="all">{t('adminSystem.system.allLevels')}</option>
              <option value="error">{t('adminSystem.system.errors')}</option>
              <option value="warn">{t('adminSystem.system.warnings')}</option>
              <option value="info">{t('adminSystem.system.infoHeartbeat')}</option>
            </select>
          </div>
          <button className="btn btn--ghost btn--small" type="submit">
            {t('adminSystem.system.filter')}
          </button>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('adminSystem.system.time')}</th>
                <th>{t('adminSystem.system.level')}</th>
                <th>{t('adminSystem.system.sourceCode')}</th>
                <th>{t('adminSystem.system.message')}</th>
                <th>{t('adminSystem.system.path')}</th>
                <th>{t('adminSystem.system.alert')}</th>
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
                    {event.path ?? t('adminSystem.system.none')}
                    {event.requestId ? ` (${event.requestId})` : ''}
                  </td>
                  <td className="muted-cell">
                    {event.notified ? t('adminSystem.system.sent') : t('adminSystem.system.none')}
                  </td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={6} className="hint" style={{ padding: '1.5rem' }}>
                    {t('adminSystem.system.noEvents')}
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
