import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Category, Tag } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { ArticleRow, Cover, Kicker, Pagination, accentClass } from '../../components/ui'

export function CategoryPage({
  settings,
  categories,
  category,
  items,
  featured,
  total,
  page,
  totalPages,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  category: Category
  items: ArticleCard[]
  featured: ArticleCard | null
  total: number
  page: number
  totalPages: number
}) {
  const { t, href, formatDate } = useI18n()
  // When the first page promotes one card into the featured slot it is removed
  // from `items`, so emptiness must be judged against the section total, not
  // against the remaining list.
  const latest = featured?.publishedAt ?? items[0]?.publishedAt ?? null
  const hasAnyPieces = total > 0
  return (
    <SiteLayout settings={settings} categories={categories} path={`/category/${category.slug}`}>
      <section className={`category-hero ${accentClass(category.accent)}`}>
        <div className="shell">
          <div className="category-hero__grid">
            <div>
              <Kicker>{t('listing.section')}</Kicker>
              <h1 style={{ marginTop: '1rem' }}>{category.name}</h1>
              <div className="category-hero__facts">
                <div>
                  {t('listing.pieces')}
                  <strong>{total}</strong>
                </div>
                <div>
                  {t('listing.latest')}
                  <strong>{latest ? formatDate(latest, 'short') : '—'}</strong>
                </div>
                <div>
                  {t('listing.pageLabel')}
                  <strong>
                    {page} / {totalPages}
                  </strong>
                </div>
              </div>
            </div>
            <div>
              <p className="category-hero__intro">{category.intro || category.description}</p>
              <p className="meta" style={{ marginTop: '1.25rem' }}>
                <a className="text-link" href={href('/topics')}>
                  {t('listing.allTopics')} →
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {featured && page === 1 ? (
        <section className="category-feature">
          <div className="shell">
            <div className="hero__grid">
              <div className="hero__text">
                <div>
                  <Kicker accent={category.accent}>
                    {t('listing.featuredIn', { featured: t('home.featured'), name: category.name })}
                  </Kicker>
                </div>
                <h2 className="display-md">
                  <a href={href(`/articles/${featured.slug}`)} className="link-underline">
                    {featured.title}
                  </a>
                </h2>
                <p className="deck">{featured.subtitle ?? featured.excerpt}</p>
                <p className="meta">
                  {featured.author?.displayName} · {formatDate(featured.publishedAt, 'long')} ·{' '}
                  {t('common.minuteShort', { count: featured.readingMinutes })}
                </p>
              </div>
              <div className="hero__media">
                <a href={href(`/articles/${featured.slug}`)} tabIndex={-1} aria-hidden="true">
                  <Cover media={featured.media} aspect="wide" sizes="(min-width: 960px) 40vw, 100vw" />
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="latest" aria-labelledby="category-list-title">
        <div className="shell">
          {items.length ? (
            <>
              <h2 id="category-list-title" className="sr-only">
                {t('listing.moreIn', { name: category.name })}
              </h2>
              {items.map((card) => (
                <ArticleRow key={card.id} card={card} />
              ))}
            </>
          ) : hasAnyPieces ? null : (
            <div className="empty-state">
              <h2 id="category-list-title">{t('listing.noPieces')}</h2>
              <p>{t('listing.noPiecesNote')}</p>
            </div>
          )}
          {totalPages > 1 ? (
            <div style={{ marginTop: '1.5rem' }}>
              <Pagination page={page} totalPages={totalPages} basePath={`/category/${category.slug}`} />
            </div>
          ) : null}
        </div>
      </section>
    </SiteLayout>
  )
}

export function TagPage({
  settings,
  categories,
  tag,
  items,
  total,
  page,
  totalPages,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  tag: Tag
  items: ArticleCard[]
  total: number
  page: number
  totalPages: number
}) {
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path={`/tags/${tag.slug}`}>
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{t('listing.tags')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {tag.name}
              </h1>
            </div>
            <div>
              <p>{tag.description || t('listing.taggedBlurb', { name: tag.name.toLowerCase() })}</p>
              <div className="page-hero__meta">
                <span className="meta">{t('common.pieceCount', { count: total })}</span>
                <a className="text-link" href={href('/archive')}>
                  {t('footer.archive')} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="tag-list-title">
        <div className="shell">
          <h2 id="tag-list-title" className="sr-only">
            {t('listing.piecesTagged', { name: tag.name })}
          </h2>
          {items.length ? (
            items.map((card) => <ArticleRow key={card.id} card={card} />)
          ) : (
            <div className="empty-state">
              <h2>{t('listing.noTagged')}</h2>
            </div>
          )}
          <div style={{ marginTop: '1.5rem' }}>
            <Pagination page={page} totalPages={totalPages} basePath={`/tags/${tag.slug}`} />
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
