import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
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
  return (
    <SiteLayout settings={settings} categories={categories} path="/articles">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>The index</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>Articles</h1>
            </div>
            <div>
              <p>
                Every essay and note in the publication, newest first. The archive goes back further if you are looking
                for something particular.
              </p>
              <div className="page-hero__meta">
                <span className="meta">{total} pieces</span>
                <span className="meta">Page {page} of {totalPages}</span>
                <a className="text-link" href="/archive">Browse the archive →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="all-articles-title">
        <div className="shell">
          <h2 id="all-articles-title" className="sr-only">All articles</h2>
          {items.length ? (
            items.map((card) => <ArticleRow key={card.id} card={card} />)
          ) : (
            <div className="empty-state">
              <h2>Nothing published yet</h2>
              <p>The first piece is being written.</p>
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
