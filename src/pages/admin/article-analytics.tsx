import type { ArticleAnalytics } from '../../lib/db/queries/analytics'
import type { User } from '../../lib/db/schema'
import { AdminLayout } from '../../components/layout'
import {
  BreakdownCard,
  ReadershipChart,
  formatNumber,
  labelCase,
  regionName,
} from './analytics'

export function ArticleAnalyticsPage({
  user,
  csrfToken,
  data,
  days,
}: {
  user: User
  csrfToken: string
  data: ArticleAnalytics
  days: number
}) {
  const { article } = data
  return (
    <AdminLayout
      user={user}
      path="/admin/analytics"
      title={article.title}
      subtitle={`Readership for /${article.slug}`}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a className="btn btn--ghost" href="/admin/analytics">← Audience</a>
          {[7, 30, 90].map((option) => (
            <a
              key={option}
              className="btn btn--ghost"
              href={`/admin/analytics/${article.id}?days=${option}`}
              aria-current={option === days ? 'page' : undefined}
              style={option === days ? { borderColor: 'var(--ink)', color: 'var(--ink)' } : undefined}
            >
              {option}d
            </a>
          ))}
          <a className="btn btn--ghost" href={`/admin/articles/${article.id}/edit`}>Edit article</a>
          <a className="btn btn--ghost" href={`/articles/${article.slug}`} target="_blank" rel="noreferrer">View live ↗</a>
        </div>
      }
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.lifetimeReaders)}</span>
            <span className="stat__label">Readers, all time</span>
            <span className="stat__delta">{formatNumber(data.readers)} in the last {days} days</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.lifetimeViews)}</span>
            <span className="stat__label">Views, all time</span>
            <span className="stat__delta">{formatNumber(data.views)} in the last {days} days</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.readers)}</span>
            <span className="stat__label">Readers, last {days} days</span>
            <span className="stat__delta">
              {data.readers ? `${(data.views / data.readers).toFixed(1)} views per reader` : 'No readers yet'}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.views)}</span>
            <span className="stat__label">Views, last {days} days</span>
            <span className="stat__delta">
              {article.publishedAt
                ? `Published ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(article.publishedAt))}`
                : 'Not published'}
            </span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2>Last {days} days</h2>
          <span className="meta">Views / unique readers</span>
        </div>
        <ReadershipChart data={data.daily} />
      </section>

      <div className="analytics-breakdown" style={{ marginTop: '1.25rem' }}>
        <BreakdownCard title="Traffic sources" rows={data.referrers} />
        <BreakdownCard title="Countries" rows={data.countries} formatLabel={regionName} />
        <BreakdownCard title="Devices" rows={data.devices} formatLabel={labelCase} />
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        Breakdowns cover the last {days} days for this article only. Readers are unique, salted visitor
        hashes; admin and DNT/GPC visits are excluded. Only aggregate, non-identifying data is stored.
      </p>
    </AdminLayout>
  )
}
