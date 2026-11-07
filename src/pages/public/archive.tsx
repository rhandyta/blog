import type { ArchiveEntry } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { formatDate } from '../../lib/content/html'
import { ui } from '../../lib/content/ui-copy'
import { SiteLayout } from '../../components/layout'
import { Kicker, accentClass } from '../../components/ui'

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long' })

export function ArchivePage({
  settings,
  categories,
  entries,
  tags,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  entries: ArchiveEntry[]
  tags: TagWithCount[]
}) {
  const years = new Map<string, Map<string, ArchiveEntry[]>>()
  for (const entry of entries) {
    const date = new Date(entry.publishedAt)
    const year = String(date.getUTCFullYear())
    const month = monthFormat.format(date)
    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)!
    if (!months.has(month)) months.set(month, [])
    months.get(month)!.push(entry)
  }

  return (
    <SiteLayout settings={settings} categories={categories} path="/archive">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>Semuanya, berurutan</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>{ui.listing.archiveTitle}</h1>
            </div>
            <div>
              <p>
                Catatan kronologis publikasi ini. Tidak ada yang dikubur; tulisan paling lama sama mudahnya dijangkau
                dengan yang paling baru.
              </p>
              <div className="page-hero__meta">
                <span className="meta">{ui.home.pieces(entries.length)}</span>
                <span className="meta">{years.size} tahun</span>
                <a className="text-link" href="/rss.xml">{ui.footer.rss} →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="archive-layout">
          <aside className="archive-filters" aria-label="Penyaring arsip">
            <div className="filter-group">
              <h2>{ui.footer.sections}</h2>
              <ul className="filter-list">
                {categories.map((category) => (
                  <li key={category.id}>
                    <a className={accentClass(category.accent)} href={`/category/${category.slug}`}>
                      <span>{category.name}</span>
                      <span className="count">{category.articleCount}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="filter-group">
              <h2>Tag</h2>
              <ul className="filter-list">
                {tags.slice(0, 14).map((tag) => (
                  <li key={tag.id}>
                    <a href={`/tags/${tag.slug}`}>
                      <span>{tag.name}</span>
                      <span className="count">{tag.articleCount}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            {entries.length ? (
              [...years.entries()].map(([year, months]) => (
                <section className="archive-year" key={year}>
                  <div className="archive-year__head">
                    <h2 className="archive-year__num">{year}</h2>
                    <span className="meta">{ui.home.pieces([...months.values()].flat().length)}</span>
                  </div>
                  {[...months.entries()].map(([month, monthEntries]) => (
                    <div className="archive-month" key={`${year}-${month}`}>
                      <h3 className="archive-month__label">{month}</h3>
                      {monthEntries.map((entry) => (
                        <a
                          key={entry.id}
                          className={`archive-item ${accentClass(entry.categoryAccent)}`}
                          href={`/articles/${entry.slug}`}
                        >
                          <span className="archive-item__day">
                            {String(new Date(entry.publishedAt).getUTCDate()).padStart(2, '0')}
                          </span>
                          <span className="archive-item__title">{entry.title}</span>
                          <span className="archive-item__cat">{entry.categoryName ?? ui.common.essay}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <div className="empty-state">
                <h2>Arsip masih kosong</h2>
                <p>Tulisan yang terbit akan muncul di sini dalam urutan terbaru lebih dulu.</p>
              </div>
            )}
            <p className="meta" style={{ marginTop: '2rem' }}>
              Entri terakhir {entries[0] ? formatDate(entries[0].publishedAt, 'long') : '—'}
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}
