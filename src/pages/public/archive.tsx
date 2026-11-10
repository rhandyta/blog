import type { ArchiveEntry } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { LOCALE_META, useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { Kicker, accentClass } from '../../components/ui'

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
  const { t, href, locale, formatDate } = useI18n()
  const monthFormat = new Intl.DateTimeFormat(LOCALE_META[locale].dateLocale, { month: 'long', timeZone: 'UTC' })
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
              <Kicker plain>{t('listing.archiveKicker')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {t('listing.archiveTitle')}
              </h1>
            </div>
            <div>
              <p>{t('listing.archiveIntro')}</p>
              <div className="page-hero__meta">
                <span className="meta">{t('common.pieceCount', { count: entries.length })}</span>
                <span className="meta">{t('common.yearCount', { count: years.size })}</span>
                <a className="text-link" href="/rss.xml">
                  {t('footer.rss')} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <div className="archive-layout">
          <aside className="archive-filters" aria-label={t('listing.archiveFilterLabel')}>
            <div className="filter-group">
              <h2>{t('footer.sections')}</h2>
              <ul className="filter-list">
                {categories.map((category) => (
                  <li key={category.id}>
                    <a className={accentClass(category.accent)} href={href(`/category/${category.slug}`)}>
                      <span>{category.name}</span>
                      <span className="count">{category.articleCount}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="filter-group">
              <h2>{t('listing.tags')}</h2>
              <ul className="filter-list">
                {tags.slice(0, 14).map((tag) => (
                  <li key={tag.id}>
                    <a href={href(`/tags/${tag.slug}`)}>
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
                    <span className="meta">
                      {t('common.pieceCount', { count: [...months.values()].flat().length })}
                    </span>
                  </div>
                  {[...months.entries()].map(([month, monthEntries]) => (
                    <div className="archive-month" key={`${year}-${month}`}>
                      <h3 className="archive-month__label">{month}</h3>
                      {monthEntries.map((entry) => (
                        <a
                          key={entry.id}
                          className={`archive-item ${accentClass(entry.categoryAccent)}`}
                          href={href(`/articles/${entry.slug}`)}
                        >
                          <span className="archive-item__day">
                            {String(new Date(entry.publishedAt).getUTCDate()).padStart(2, '0')}
                          </span>
                          <span className="archive-item__title">{entry.title}</span>
                          <span className="archive-item__cat">{entry.categoryName ?? t('common.essay')}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                </section>
              ))
            ) : (
              <div className="empty-state">
                <h2>{t('listing.archiveEmpty')}</h2>
                <p>{t('listing.archiveEmptyNote')}</p>
              </div>
            )}
            <p className="meta" style={{ marginTop: '2rem' }}>
              {t('listing.lastEntry', { date: entries[0] ? formatDate(entries[0].publishedAt, 'long') : '—' })}
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}
