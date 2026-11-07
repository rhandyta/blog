import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { ui } from '../../lib/content/ui-copy'
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
              <Kicker plain>{ui.home.theIndex}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>{ui.listing.allArticlesTitle}</h1>
            </div>
            <div>
              <p>
                Setiap esai dan catatan di publikasi ini, terbaru lebih dulu. Arsip menyimpan lebih jauh bila kamu
                mencari sesuatu yang tertentu.
              </p>
              <div className="page-hero__meta">
                <span className="meta">{ui.home.pieces(total)}</span>
                <span className="meta">{ui.listing.pageOf(page, totalPages)}</span>
                <a className="text-link" href="/archive">{ui.footer.archive} →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="all-articles-title">
        <div className="shell">
          <h2 id="all-articles-title" className="sr-only">{ui.listing.allArticlesTitle}</h2>
          {items.length ? (
            items.map((card) => <ArticleRow key={card.id} card={card} />)
          ) : (
            <div className="empty-state">
              <h2>Belum ada yang terbit</h2>
              <p>Tulisan pertama sedang dikerjakan.</p>
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
