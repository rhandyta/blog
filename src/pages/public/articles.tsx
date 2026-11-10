import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { ArticleRow, Kicker, Pagination } from '../../components/ui'

export function ArticlesPage({
  settings,
  categories,
  items,
  total,
  page,
  totalPages,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  items: ArticleCard[]
  total: number
  page: number
  totalPages: number
}) {
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/articles">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{t('home.theIndex')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {t('listing.allArticlesTitle')}
              </h1>
            </div>
            <div>
              <p>{t('listing.articlesIntro')}</p>
              <div className="page-hero__meta">
                <span className="meta">{t('common.pieceCount', { count: total })}</span>
                <span className="meta">{t('listing.pageOf', { page, total: totalPages })}</span>
                <a className="text-link" href={href('/archive')}>
                  {t('footer.archive')} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="all-articles-title">
        <div className="shell">
          <h2 id="all-articles-title" className="sr-only">
            {t('listing.allArticlesTitle')}
          </h2>
          {items.length ? (
            items.map((card) => <ArticleRow key={card.id} card={card} />)
          ) : (
            <div className="empty-state">
              <h2>{t('listing.emptyArticlesTitle')}</h2>
              <p>{t('listing.emptyArticlesBody')}</p>
            </div>
          )}
          <div style={{ marginTop: '1.5rem' }}>
            <Pagination page={page} totalPages={totalPages} basePath="/articles" />
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
