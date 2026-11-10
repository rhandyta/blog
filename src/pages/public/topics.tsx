import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { Kicker, TopicRow } from '../../components/ui'

export function TopicsPage({ settings, categories }: { settings: SiteSettings; categories: CategoryWithCount[] }) {
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/topics">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{t('footer.sections')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {t('listing.topicsTitle')}
              </h1>
            </div>
            <div>
              <p>{t('listing.topicsIntro')}</p>
              <div className="page-hero__meta">
                <span className="meta">{t('common.sectionCount', { count: categories.length })}</span>
                <a className="text-link" href={href('/archive')}>
                  {t('footer.archive')} {t('listing.chronological')} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest">
        <div className="shell">
          <div className="topic-list">
            {categories.map((category, index) => (
              <TopicRow key={category.id} category={category} index={index} />
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
