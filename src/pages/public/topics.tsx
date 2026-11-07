import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import { ui } from '../../lib/content/ui-copy'
import { SiteLayout } from '../../components/layout'
import { Kicker, TopicRow } from '../../components/ui'

export function TopicsPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/topics">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{ui.footer.sections}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>{ui.listing.topicsTitle}</h1>
            </div>
            <div>
              <p>
                Publikasi ini disusun secara longgar menurut subjek. Setiap rubrik punya warna aksennya sendiri,
                arsipnya sendiri, dan ruang untuk berubah ketika minat pun berubah.
              </p>
              <div className="page-hero__meta">
                <span className="meta">{categories.length} rubrik</span>
                <a className="text-link" href="/archive">{ui.footer.archive} kronologis →</a>
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
