import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
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
              <Kicker plain>Sections</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>Topics</h1>
            </div>
            <div>
              <p>
                The publication is organised loosely by subject. Each section has its own accent, its own archive, and
                room to change as the interests do.
              </p>
              <div className="page-hero__meta">
                <span className="meta">{categories.length} sections</span>
                <a className="text-link" href="/archive">Chronological archive →</a>
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
