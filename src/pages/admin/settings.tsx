import type { SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Subscriber, User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { CsrfField, type Flash, PaginationNav } from './shared'

export function SettingsPage({
  user,
  settings,
  session,
  flash,
  errors,
}: {
  user: User
  settings: SiteSettings
  session: { csrfToken: string }
  flash: Flash
  errors?: string[]
}) {
  const { t } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/settings"
      title={t('adminAudience.settings.title')}
      subtitle={t('adminAudience.settings.subtitle')}
      flash={flash}
      csrfToken={session.csrfToken}
    >
      {(errors ?? []).length ? (
        <div className="flash" data-tone="error" role="alert">
          {errors!.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : null}
      <form method="post" action="/admin/settings" className="admin-form" style={{ maxWidth: '52rem' }}>
        <CsrfField token={session.csrfToken} />
        <section className="admin-card">
          <h2>{t('adminAudience.settings.identity')}</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="title">{t('adminAudience.settings.publicationTitle')}</label>
              <input className="input" id="title" name="title" defaultValue={settings.title} required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="issue">{t('adminAudience.settings.issueLine')}</label>
              <input className="input" id="issue" name="issue" defaultValue={settings.issue} maxLength={40} />
            </div>
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="tagline">{t('adminAudience.settings.tagline')}</label>
            <input className="input" id="tagline" name="tagline" defaultValue={settings.tagline} maxLength={120} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="description">{t('adminAudience.settings.siteDescription')}</label>
            <textarea
              className="textarea"
              id="description"
              name="description"
              rows={2}
              defaultValue={settings.description}
              maxLength={300}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="intro">{t('adminAudience.settings.homepageIntroduction')}</label>
            <textarea
              className="textarea"
              id="intro"
              name="intro"
              rows={3}
              defaultValue={settings.intro}
              maxLength={500}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="siteLanguage">{t('adminAudience.settings.siteLanguage')}</label>
            <select className="select" id="siteLanguage" name="siteLanguage" defaultValue={settings.siteLanguage}>
              <option value="en">{t('adminAudience.settings.languageEnglish')}</option>
              <option value="id">{t('adminAudience.settings.languageIndonesian')}</option>
            </select>
            <p className="hint">{t('adminAudience.settings.siteLanguageHint')}</p>
          </div>
        </section>

        <section className="admin-card">
          <h2>{t('adminAudience.settings.editorialVoice')}</h2>
          <div className="field">
            <label htmlFor="manifesto">{t('adminAudience.settings.manifestoLine')}</label>
            <textarea
              className="textarea"
              id="manifesto"
              name="manifesto"
              rows={2}
              defaultValue={settings.manifesto}
              maxLength={300}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="manifestoBy">{t('adminAudience.settings.attribution')}</label>
            <input
              className="input"
              id="manifestoBy"
              name="manifestoBy"
              defaultValue={settings.manifestoBy}
              maxLength={60}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="about">{t('adminAudience.settings.aboutCopy')}</label>
            <textarea
              className="textarea"
              id="about"
              name="about"
              rows={9}
              defaultValue={settings.about}
              maxLength={6000}
            />
          </div>
        </section>

        <section className="admin-card">
          <h2>{t('adminAudience.settings.newsletter')}</h2>
          <div className="field">
            <label htmlFor="newsletterTitle">{t('adminAudience.settings.headline')}</label>
            <input
              className="input"
              id="newsletterTitle"
              name="newsletterTitle"
              defaultValue={settings.newsletterTitle}
              maxLength={120}
            />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="newsletterBlurb">{t('adminAudience.settings.description')}</label>
            <textarea
              className="textarea"
              id="newsletterBlurb"
              name="newsletterBlurb"
              rows={3}
              defaultValue={settings.newsletterBlurb}
              maxLength={400}
            />
          </div>
        </section>

        <section className="admin-card">
          <h2>{t('adminAudience.settings.contactElsewhere')}</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="email">{t('adminAudience.common.email')}</label>
              <input className="input" id="email" name="email" type="email" defaultValue={settings.email} />
            </div>
            <div className="field">
              <label htmlFor="x">X / Twitter</label>
              <input className="input" id="x" name="x" type="url" defaultValue={settings.x} />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="field">
              <label htmlFor="github">GitHub</label>
              <input className="input" id="github" name="github" type="url" defaultValue={settings.github} />
            </div>
            <div className="field">
              <label htmlFor="linkedin">LinkedIn</label>
              <input className="input" id="linkedin" name="linkedin" type="url" defaultValue={settings.linkedin} />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button className="btn btn--solid" type="submit">
            {t('adminAudience.settings.save')}
          </button>
        </div>
      </form>
    </AdminLayout>
  )
}

export function SubscribersPage({
  user,
  subscribers,
  total,
  stats,
  page,
  totalPages,
  q,
  status,
  flash,
  csrfToken,
}: {
  user: User
  subscribers: Subscriber[]
  total: number
  stats: { subscribed: number; pending: number; unsubscribed: number }
  page: number
  totalPages: number
  q?: string
  status: 'subscribed' | 'pending' | 'unsubscribed' | 'all'
  flash: Flash
  csrfToken: string
}) {
  const { t, formatDate, formatNumber, href } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/subscribers"
      title={t('adminAudience.subscribers.title')}
      subtitle={t('adminAudience.subscribers.subtitle', {
        confirmed: formatNumber(stats.subscribed),
        pending: formatNumber(stats.pending),
        unsubscribed: formatNumber(stats.unsubscribed),
      })}
      actions={
        <>
          <a className="btn btn--ghost" href={href('/admin/newsletter')}>
            {t('adminAudience.subscribers.writeNewsletter')} →
          </a>
          <a className="btn btn--ghost" href={href('/admin/subscribers.csv')}>
            {t('adminAudience.subscribers.exportCsv')}
          </a>
        </>
      }
      flash={flash}
      csrfToken={csrfToken}
    >
      <form className="filter-bar" method="get" action="/admin/subscribers">
        <div className="field">
          <label htmlFor="q">{t('adminAudience.common.email')}</label>
          <input
            className="input"
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('adminAudience.subscribers.searchPlaceholder')}
          />
        </div>
        <div className="field">
          <label htmlFor="status">{t('adminAudience.common.status')}</label>
          <select className="select" id="status" name="status" defaultValue={status}>
            <option value="all">{t('adminAudience.subscribers.all')}</option>
            <option value="subscribed">{t('adminAudience.subscribers.filterConfirmed')}</option>
            <option value="pending">{t('adminAudience.subscribers.filterPending')}</option>
            <option value="unsubscribed">{t('adminAudience.subscribers.filterUnsubscribed')}</option>
          </select>
        </div>
        <button className="btn btn--ghost btn--small" type="submit">
          {t('adminAudience.subscribers.filter')}
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('adminAudience.common.email')}</th>
              <th>{t('adminAudience.common.status')}</th>
              <th>{t('adminAudience.subscribers.source')}</th>
              <th>{t('adminAudience.subscribers.signedUp')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td>{subscriber.email}</td>
                <td>
                  <span
                    className="status"
                    data-status={
                      subscriber.status === 'unsubscribed'
                        ? 'archived'
                        : subscriber.confirmedAt
                          ? 'published'
                          : 'scheduled'
                    }
                  >
                    {subscriber.status === 'unsubscribed'
                      ? (subscriber.suppressionReason ?? 'unsubscribed')
                      : subscriber.confirmedAt
                        ? t('adminAudience.subscribers.pillConfirmed')
                        : t('adminAudience.subscribers.pillPending')}
                  </span>
                </td>
                <td className="muted-cell">{subscriber.source}</td>
                <td className="muted-cell">{formatDate(subscriber.createdAt, 'long')}</td>
                <td>
                  <div className="actions">
                    {subscriber.status === 'subscribed' && !subscriber.confirmedAt ? (
                      <form method="post" action={`/admin/subscribers/${subscriber.id}/resend`}>
                        <CsrfField token={csrfToken} />
                        <button className="btn btn--ghost btn--small" type="submit">
                          {t('adminAudience.subscribers.resend')}
                        </button>
                      </form>
                    ) : null}
                    <form
                      method="post"
                      action={`/admin/subscribers/${subscriber.id}/delete`}
                      data-confirm={t('adminAudience.subscribers.removeConfirm')}
                    >
                      <CsrfField token={csrfToken} />
                      <button className="btn btn--danger btn--small" type="submit">
                        {t('adminAudience.subscribers.remove')}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!subscribers.length ? (
              <tr>
                <td colSpan={5} className="hint" style={{ padding: '1.5rem' }}>
                  {t('adminAudience.subscribers.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationNav
        page={page}
        totalPages={totalPages}
        basePath="/admin/subscribers"
        query={{ q, status: status === 'all' ? undefined : status }}
      />
      <p className="hint" style={{ marginTop: '1rem' }}>
        {t('adminAudience.subscribers.note', { total: formatNumber(total) })}
      </p>
    </AdminLayout>
  )
}
