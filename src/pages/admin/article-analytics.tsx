import type { ArticleAnalytics } from '../../lib/db/queries/analytics'
import type { User } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { AdminLayout } from '../../components/layout'
import { BreakdownCard, ReadershipChart, labelCase, regionName } from './analytics'

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
  const { t, locale, formatDate, formatNumber } = useI18n()
  const { article } = data
  return (
    <AdminLayout
      user={user}
      path="/admin/analytics"
      title={article.title}
      subtitle={t('adminDashboard.analytics.subtitle', { slug: article.slug })}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a className="btn btn--ghost" href="/admin/analytics">
            ← {t('adminDashboard.analytics.audience')}
          </a>
          {[7, 30, 90].map((option) => (
            <a
              key={option}
              className="btn btn--ghost"
              href={`/admin/analytics/${article.id}?days=${option}`}
              aria-current={option === days ? 'page' : undefined}
              style={option === days ? { borderColor: 'var(--ink)', color: 'var(--ink)' } : undefined}
            >
              {t('adminDashboard.analytics.daysShort', { days: option })}
            </a>
          ))}
          <a className="btn btn--ghost" href={`/admin/articles/${article.id}/edit`}>
            {t('adminDashboard.analytics.editArticle')}
          </a>
          <a className="btn btn--ghost" href={`/articles/${article.slug}`} target="_blank" rel="noreferrer">
            {t('adminDashboard.analytics.viewLive')} ↗
          </a>
        </div>
      }
      csrfToken={csrfToken}
    >
      <div className="admin-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.lifetimeReaders)}</span>
            <span className="stat__label">{t('adminDashboard.analytics.lifetimeReaders')}</span>
            <span className="stat__delta">
              {t('adminDashboard.analytics.inLastDays', { count: formatNumber(data.readers), days })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.lifetimeViews)}</span>
            <span className="stat__label">{t('adminDashboard.analytics.lifetimeViews')}</span>
            <span className="stat__delta">
              {t('adminDashboard.analytics.inLastDays', { count: formatNumber(data.views), days })}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.readers)}</span>
            <span className="stat__label">{t('adminDashboard.analytics.readersLastDays', { days })}</span>
            <span className="stat__delta">
              {data.readers
                ? t('adminDashboard.analytics.viewsPerReader', {
                    ratio: formatNumber(data.views / data.readers, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                  })
                : t('adminDashboard.analytics.noReaders')}
            </span>
          </div>
        </div>
        <div className="admin-card" style={{ gridColumn: 'span 3' }}>
          <div className="stat">
            <span className="stat__value">{formatNumber(data.views)}</span>
            <span className="stat__label">{t('adminDashboard.analytics.viewsLastDays', { days })}</span>
            <span className="stat__delta">
              {article.publishedAt
                ? t('adminDashboard.analytics.published', { date: formatDate(article.publishedAt, 'long') })
                : t('adminDashboard.analytics.notPublished')}
            </span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2>{t('adminDashboard.analytics.lastDays', { days })}</h2>
          <span className="meta">{t('adminDashboard.analytics.viewsReaders')}</span>
        </div>
        <ReadershipChart data={data.daily} />
      </section>

      <div className="analytics-breakdown" style={{ marginTop: '1.25rem' }}>
        <BreakdownCard title={t('adminDashboard.analytics.trafficSources')} rows={data.referrers} />
        <BreakdownCard
          title={t('adminDashboard.analytics.countries')}
          rows={data.countries}
          formatLabel={(code) => regionName(code, locale)}
        />
        <BreakdownCard title={t('adminDashboard.analytics.devices')} rows={data.devices} formatLabel={labelCase} />
      </div>

      <p className="hint" style={{ marginTop: '1rem' }}>
        {t('adminDashboard.analytics.hint', { days })}
      </p>
    </AdminLayout>
  )
}
