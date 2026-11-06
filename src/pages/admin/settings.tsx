import type { SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Subscriber, User } from '../../lib/db/schema'
import { formatDate } from '../../lib/content/html'
import { AdminLayout } from '../../components/layout'
import { CsrfField, Flash, PaginationNav } from './shared'

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
  return (
    <AdminLayout user={user} path="/admin/settings" title="Settings" subtitle="Publication identity and contact details" flash={flash} csrfToken={session.csrfToken}>
      {(errors ?? []).length ? (
        <div className="flash" data-tone="error" role="alert">
          {errors!.map((error) => <div key={error}>{error}</div>)}
        </div>
      ) : null}
      <form method="post" action="/admin/settings" className="admin-form" style={{ maxWidth: '52rem' }}>
        <CsrfField token={session.csrfToken} />
        <section className="admin-card">
          <h2>Identity</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="title">Publication title</label>
              <input className="input" id="title" name="title" defaultValue={settings.title} required maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="issue">Issue line</label>
              <input className="input" id="issue" name="issue" defaultValue={settings.issue} maxLength={40} />
            </div>
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="tagline">Tagline</label>
            <input className="input" id="tagline" name="tagline" defaultValue={settings.tagline} maxLength={120} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="description">Site description (meta fallback)</label>
            <textarea className="textarea" id="description" name="description" rows={2} defaultValue={settings.description} maxLength={300} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="intro">Homepage introduction</label>
            <textarea className="textarea" id="intro" name="intro" rows={3} defaultValue={settings.intro} maxLength={500} />
          </div>
        </section>

        <section className="admin-card">
          <h2>Editorial voice</h2>
          <div className="field">
            <label htmlFor="manifesto">Manifesto line</label>
            <textarea className="textarea" id="manifesto" name="manifesto" rows={2} defaultValue={settings.manifesto} maxLength={300} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="manifestoBy">Attribution</label>
            <input className="input" id="manifestoBy" name="manifestoBy" defaultValue={settings.manifestoBy} maxLength={60} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="about">About page copy (blank line separates paragraphs)</label>
            <textarea className="textarea" id="about" name="about" rows={9} defaultValue={settings.about} maxLength={6000} />
          </div>
        </section>

        <section className="admin-card">
          <h2>Newsletter</h2>
          <div className="field">
            <label htmlFor="newsletterTitle">Headline</label>
            <input className="input" id="newsletterTitle" name="newsletterTitle" defaultValue={settings.newsletterTitle} maxLength={120} />
          </div>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="newsletterBlurb">Description</label>
            <textarea className="textarea" id="newsletterBlurb" name="newsletterBlurb" rows={3} defaultValue={settings.newsletterBlurb} maxLength={400} />
          </div>
        </section>

        <section className="admin-card">
          <h2>Contact &amp; elsewhere</h2>
          <div className="form-row">
            <div className="field">
              <label htmlFor="email">Email</label>
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
          <button className="btn btn--solid" type="submit">Save settings</button>
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
  return (
    <AdminLayout
      user={user}
      path="/admin/subscribers"
      title="Subscribers"
      subtitle={`${stats.subscribed} confirmed · ${stats.pending} pending · ${stats.unsubscribed} unsubscribed`}
      actions={
        <>
          <a className="btn btn--ghost" href="/admin/newsletter">Write newsletter →</a>
          <a className="btn btn--ghost" href="/admin/subscribers.csv">Export CSV</a>
        </>
      }
      flash={flash}
      csrfToken={csrfToken}
    >
      <form className="filter-bar" method="get" action="/admin/subscribers">
        <div className="field">
          <label htmlFor="q">Email</label>
          <input className="input" id="q" name="q" defaultValue={q ?? ''} placeholder="Search addresses" />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select className="select" id="status" name="status" defaultValue={status}>
            <option value="all">All</option>
            <option value="subscribed">Confirmed</option>
            <option value="pending">Pending confirmation</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
        <button className="btn btn--ghost btn--small" type="submit">Filter</button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Email</th><th>Status</th><th>Source</th><th>Signed up</th></tr>
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
                      ? 'unsubscribed'
                      : subscriber.confirmedAt
                        ? 'confirmed'
                        : 'pending'}
                  </span>
                </td>
                <td className="muted-cell">{subscriber.source}</td>
                <td className="muted-cell">{formatDate(subscriber.createdAt, 'long')}</td>
              </tr>
            ))}
            {!subscribers.length ? (
              <tr><td colSpan={4} className="hint" style={{ padding: '1.5rem' }}>No subscribers yet. The newsletter form writes here.</td></tr>
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
        {total} total records. Only confirmed subscribers receive newsletters. Pending addresses are waiting for
        double opt-in.
      </p>
    </AdminLayout>
  )
}
