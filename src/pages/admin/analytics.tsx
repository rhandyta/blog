import type { User } from '../../lib/db/schema'
import type {
  AnalyticsOverview,
  BreakdownRow,
  DailyAnalytics,
  TopArticleAnalytics,
} from '../../lib/db/queries/analytics'
import { LOCALE_META, useI18n, type Locale } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'

function formatDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].dateLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

export function regionName(code: string, locale: Locale = 'en'): string {
  if (code === 'Unknown' || code === 'Direct') return code
  try {
    return new Intl.DisplayNames([LOCALE_META[locale].dateLocale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function labelCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function ReadershipChart({ data }: { data: DailyAnalytics[] }) {
  const { t, locale, formatNumber } = useI18n()
  const max = Math.max(1, ...data.map((point) => Math.max(point.views, point.readers)))
  return (
    <div>
      <div className="analytics-legend">
        <span>
          <i className="analytics-dot" /> {t('adminAudience.common.views')}
        </span>
        <span>
          <i className="analytics-dot analytics-dot--readers" /> {t('adminAudience.common.uniqueReaders')}
        </span>
      </div>
      <div className="analytics-chart" role="img" aria-label={t('adminAudience.analytics.chartAria')}>
        {data.map((point) => (
          <div
            className="analytics-chart__col"
            key={point.day}
            title={t('adminAudience.analytics.chartPointTitle', {
              day: formatDay(point.day, locale),
              views: formatNumber(point.views),
              readers: formatNumber(point.readers),
            })}
          >
            <div className="analytics-chart__bars">
              <span className="analytics-chart__bar" style={{ height: `${(point.views / max) * 100}%` }} />
              <span
                className="analytics-chart__bar analytics-chart__bar--readers"
                style={{ height: `${(point.readers / max) * 100}%` }}
              />
            </div>
            <span className="analytics-chart__label">{formatDay(point.day, locale)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BreakdownCard({
  title,
  rows,
  formatLabel,
}: {
  title: string
  rows: BreakdownRow[]
  formatLabel?: (label: string) => string
}) {
  const { t, formatNumber } = useI18n()
  return (
    <section className="admin-card">
      <h2>{title}</h2>
      {rows.length ? (
        <ul className="analytics-list">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{formatLabel ? formatLabel(row.label) : row.label}</span>
              <span>
                {t('adminAudience.analytics.breakdownRow', {
                  views: formatNumber(row.visits),
                  readers: formatNumber(row.readers),
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{t('adminAudience.analytics.noData')}</p>
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
  const { t, locale, formatNumber, href } = useI18n()
  return (
    <AdminLayout
      user={user}
      path="/admin/analytics"
      title={t('adminAudience.analytics.title')}
      subtitle={t('adminAudience.analytics.subtitle')}
      actions={
        <a className="btn btn--ghost" href={href('/admin/articles')}>
          {t('adminAudience.analytics.allArticles')} →
        </a>
      }
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.readers)}</span>
            <span className="stat__label">{t('adminAudience.common.uniqueReaders')}</span>
            <span className="stat__delta">
              {t('adminAudience.analytics.last30DaysDelta', { count: formatNumber(overview.readers30d) })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.views)}</span>
            <span className="stat__label">{t('adminAudience.analytics.statArticleViews')}</span>
            <span className="stat__delta">
              {t('adminAudience.analytics.last30DaysDelta', { count: formatNumber(overview.views30d) })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.readersToday)}</span>
            <span className="stat__label">{t('adminAudience.analytics.statReadersToday')}</span>
            <span className="stat__delta">
              {t('adminAudience.analytics.viewsTodayDelta', { count: formatNumber(overview.viewsToday) })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(overview.viewsToday)}</span>
            <span className="stat__label">{t('adminAudience.analytics.statViewsToday')}</span>
            <span className="stat__delta">
              {t('adminAudience.analytics.readersTodayDelta', { count: formatNumber(overview.readersToday) })}
            </span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2>{t('adminAudience.analytics.last14Days')}</h2>
          <span className="meta">{t('adminAudience.analytics.viewsPerUniqueReaders')}</span>
        </div>
        <ReadershipChart data={daily} />
      </section>

      <div className="admin-grid" style={{ marginTop: '1.25rem' }}>
        <section className="admin-card" style={{ gridColumn: 'span 8' }}>
          <div className="admin-card__head">
            <h2>{t('adminAudience.analytics.topArticles')}</h2>
            <span className="meta">{t('adminAudience.analytics.allTime')}</span>
          </div>
          <div className="admin-table-wrap" style={{ border: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminAudience.common.article')}</th>
                  <th className="num">{t('adminAudience.common.readers')}</th>
                  <th className="num">{t('adminAudience.common.views')}</th>
                </tr>
              </thead>
              <tbody>
                {topArticles.map((article) => (
                  <tr key={article.id}>
                    <td className="title-cell">
                      <a href={`/admin/articles/${article.id}/edit`}>{article.title}</a>
                      <div className="meta" style={{ marginTop: '0.2rem' }}>
                        /{article.slug} ·{' '}
                        <a href={`/admin/analytics/${article.id}`}>{t('adminAudience.analytics.readership')}</a>
                      </div>
                    </td>
                    <td className="num">{formatNumber(article.readers)}</td>
                    <td className="num">{formatNumber(article.views)}</td>
                  </tr>
                ))}
                {!topArticles.length ? (
                  <tr>
                    <td colSpan={3} className="hint" style={{ padding: '1.5rem' }}>
                      {t('adminAudience.analytics.noPublishedArticles')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="admin-card" style={{ gridColumn: 'span 4' }}>
          <h2>{t('adminAudience.analytics.howMeasuredTitle')}</h2>
          <p className="hint">{t('adminAudience.analytics.howMeasuredBody1')}</p>
          <p className="hint" style={{ marginTop: '0.85rem' }}>
            {t('adminAudience.analytics.howMeasuredBody2')}
          </p>
          <p className="hint" style={{ marginTop: '0.85rem' }}>
            {t('adminAudience.analytics.howMeasuredBody3')}
          </p>
        </aside>
      </div>

      <div className="analytics-breakdown" style={{ marginTop: '1.25rem' }}>
        <BreakdownCard title={t('adminAudience.analytics.trafficSources')} rows={referrers} />
        <BreakdownCard
          title={t('adminAudience.analytics.countries')}
          rows={countries}
          formatLabel={(code) => regionName(code, locale)}
        />
        <BreakdownCard title={t('adminAudience.analytics.devices')} rows={devices} formatLabel={labelCase} />
        <BreakdownCard title={t('adminAudience.analytics.browsers')} rows={browsers} formatLabel={labelCase} />
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        {t('adminAudience.analytics.breakdownNote')}
      </p>
    </AdminLayout>
  )
}
