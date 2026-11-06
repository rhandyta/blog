import type { User } from '../../lib/db/schema'
import type {
  AnalyticsOverview,
  BreakdownRow,
  DailyAnalytics,
  TopArticleAnalytics,
} from '../../lib/db/queries/analytics'
import { AdminLayout } from '../../components/layout'

const numberFormat = new Intl.NumberFormat('en-US')

function formatNumber(value: number): string {
  return numberFormat.format(value)
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

function regionName(code: string): string {
  if (code === 'Unknown' || code === 'Direct') return code
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function labelCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function ReadershipChart({ data }: { data: DailyAnalytics[] }) {
  const max = Math.max(1, ...data.map((point) => Math.max(point.views, point.readers)))
  return (
    <div>
      <div className="analytics-legend">
        <span><i className="analytics-dot" /> Views</span>
        <span><i className="analytics-dot analytics-dot--readers" /> Unique readers</span>
      </div>
      <div className="analytics-chart" role="img" aria-label="Daily article views and unique readers">
        {data.map((point) => (
          <div
            className="analytics-chart__col"
            key={point.day}
            title={`${formatDay(point.day)} — ${formatNumber(point.views)} views, ${formatNumber(point.readers)} readers`}
          >
            <div className="analytics-chart__bars">
              <span className="analytics-chart__bar" style={{ height: `${(point.views / max) * 100}%` }} />
              <span
                className="analytics-chart__bar analytics-chart__bar--readers"
                style={{ height: `${(point.readers / max) * 100}%` }}
              />
            </div>
            <span className="analytics-chart__label">{formatDay(point.day)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  rows,
  formatLabel,
}: {
  title: string
  rows: BreakdownRow[]
  formatLabel?: (label: string) => string
}) {
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length ? (
        <ul className="analytics-list">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{formatLabel ? formatLabel(row.label) : row.label}</span>
              <span>{formatNumber(row.visits)} views · {formatNumber(row.readers)} readers</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No data yet.</p>
      )}
    </section>
  )
}

export function AnalyticsPage({
  user,
  csrfToken,
  overview,
  daily,
  topArticles,
  referrers,
  countries,
  devices,
  browsers,
}: {
  user: User
  csrfToken: string
  overview: AnalyticsOverview
  daily: DailyAnalytics[]
  topArticles: TopArticleAnalytics[]
  referrers: BreakdownRow[]
  countries: BreakdownRow[]
  devices: BreakdownRow[]
  browsers: BreakdownRow[]
}) {
  return (
    <AdminLayout
      user={user}
      path="/admin/analytics"
      title="Audience"
      subtitle="Privacy-first readership and visitor data"
      actions={<a className="btn btn--ghost" href="/admin/articles">All articles →</a>}
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.readers)}</span>
            <span className="stat__label">Unique readers</span>
            <span className="stat__delta">{formatNumber(overview.readers30d)} in the last 30 days</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.views)}</span>
            <span className="stat__label">Article views</span>
            <span className="stat__delta">{formatNumber(overview.views30d)} in the last 30 days</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.readersToday)}</span>
            <span className="stat__label">Readers today</span>
            <span className="stat__delta">{formatNumber(overview.viewsToday)} views today</span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.viewsToday)}</span>
            <span className="stat__label">Views today</span>
            <span className="stat__delta">{formatNumber(overview.readersToday)} unique readers</span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2>Last 14 days</h2>
          <span className="meta">Views / unique readers</span>
        </div>
        <ReadershipChart data={daily} />
      </section>

      <div className="admin-grid" style={{ marginTop: '1.25rem' }}>
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-card__head">
            <h2>Top articles</h2>
            <span className="meta">All time</span>
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th className="num">Readers</th>
                  <th className="num">Views</th>
                </tr>
              </thead>
              <tbody>
                {topArticles.map((article) => (
                  <tr key={article.id}>
                    <td className="title-cell">
                      <a href={`/admin/articles/${article.id}/edit`}>{article.title}</a>
                      <div className="meta" style={{ marginTop: '0.2rem' }}>/{article.slug}</div>
                    </td>
                    <td className="num">{formatNumber(article.readers)}</td>
                    <td className="num">{formatNumber(article.views)}</td>
                  </tr>
                ))}
                {!topArticles.length ? (
                  <tr>
                    <td colSpan={3} className="hint" style={{ padding: '1.5rem' }}>
                      No published articles yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>How this is measured</h2>
          <p className="hint">
            Readers are unique visitors. Views are counted once per reader, per article, per hour.
            Internal/admin visits and DNT/GPC requests are excluded.
          </p>
          <p className="hint" style={{ marginTop: '0.85rem' }}>
            No cookies, no raw IP addresses, and no raw user-agent strings are stored. Visitor IDs are
            salted hashes used only for deduplication. Event rows are retained for 180 days; aggregate
            reader counts remain.
          </p>
          <p className="hint" style={{ marginTop: '0.85rem' }}>
            This page is visible only in the editorial desk and is never exposed on the public site.
          </p>
        </aside>
      </div>

      <div className="analytics-breakdown" style={{ marginTop: '1.25rem' }}>
        <BreakdownCard title="Traffic sources" rows={referrers} />
        <BreakdownCard title="Countries" rows={countries} formatLabel={regionName} />
        <BreakdownCard title="Devices" rows={devices} formatLabel={labelCase} />
        <BreakdownCard title="Browsers" rows={browsers} formatLabel={labelCase} />
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        Traffic sources, countries, devices, and browsers cover the last 30 days. Totals are all-time.
        Unique readers are counted from the moment analytics was enabled.
      </p>
    </AdminLayout>
  )
}
