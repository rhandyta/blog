import type { SearchHit, HighlightPart } from '../../lib/db/queries/search'
import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { Kicker, accentClass } from '../../components/ui'
import { SearchIcon } from '../../components/layout'

function Parts({ parts }: { parts: HighlightPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
      )}
    </>
  )
}

function Suggestions({ categories, tags }: { categories: CategoryWithCount[]; tags: TagWithCount[] }) {
  const { href } = useI18n()
  return (
    <div className="search-suggestions">
      {categories.slice(0, 4).map((category) => (
        <a
          key={category.id}
          className={`tag ${accentClass(category.accent)}`}
          href={href(`/category/${category.slug}`)}
        >
          {category.name}
        </a>
      ))}
      {tags.slice(0, 8).map((tag) => (
        <a key={tag.id} className="tag" href={href(`/tags/${tag.slug}`)}>
          {tag.name}
        </a>
      ))}
    </div>
  )
}

export function SearchPage({
  settings,
  categories,
  tags,
  query,
  hits,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  tags: TagWithCount[]
  query: string
  hits: SearchHit[]
}) {
  const { t, href, formatDate } = useI18n()
  const hasQuery = query.trim().length > 0
  return (
    <SiteLayout settings={settings} categories={categories} path="/search">
      <section className="search-hero">
        <div className="shell">
          <Kicker plain>{t('search.title')}</Kicker>
          <form className="search-form" role="search" action={href('/search')} method="get" data-search-form>
            <span className="search-form__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <label className="sr-only" htmlFor="search-input">
              {t('search.label')}
            </label>
            <input
              className="search-input"
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              data-search-input
            />
            <button className="btn" type="submit">
              {t('search.submit')}
            </button>
          </form>
          <div className="search-meta">
            <span data-search-status aria-live="polite">
              {hasQuery ? t('search.resultsFor', { query: query.trim() }) : t('search.placeholder')}
            </span>
            <span className="search-loading" data-search-loading hidden>
              {t('search.searching')}
            </span>
            <span>{t('search.allPublished')}</span>
          </div>
        </div>
      </section>

      <div className="shell">
        <div id="search-results-region">
          {!hasQuery ? (
            <div className="search-state">
              <h2>{t('search.startTitle')}</h2>
              <p>{t('search.startBody')}</p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          ) : hits.length ? (
            <div className="search-results" data-server-results>
              {hits.map((hit) => (
                <a key={hit.card.id} className="search-result" href={href(`/articles/${hit.card.slug}`)}>
                  <div className="search-result__top">
                    <span className={`meta ${accentClass(hit.card.category?.accent)}`} style={{ color: 'var(--cat)' }}>
                      {hit.card.category?.name ?? t('common.essay')}
                    </span>
                    <span className="meta">{formatDate(hit.card.publishedAt, 'short')}</span>
                    <span className="meta">{t('article.minRead', { count: hit.card.readingMinutes })}</span>
                  </div>
                  <h2 className="search-result__title">
                    <Parts parts={hit.titleParts} />
                  </h2>
                  <p className="search-result__excerpt">
                    <Parts parts={hit.snippetParts} />
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="search-state" data-no-results>
              <h2>{t('search.noResults', { query: query.trim() })}</h2>
              <p>{t('search.noResultsBody')}</p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          )}
          <div className="search-results" data-live-results hidden></div>
          <div className="search-state" data-live-empty hidden>
            <h2>{t('search.liveEmptyTitle')}</h2>
            <p>{t('search.liveEmptyBody')}</p>
            <Suggestions categories={categories} tags={tags} />
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}

export function SavedPage({ settings, categories }: { settings: SiteSettings; categories: CategoryWithCount[] }) {
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/saved">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>{t('saved.kicker')}</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>
                {t('saved.title')}
              </h1>
            </div>
            <div>
              <p>{t('saved.intro')}</p>
              <div className="page-hero__meta">
                <span className="meta" data-saved-meta>
                  {t('saved.loading')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="saved-list-title">
        <div className="shell">
          <h2 id="saved-list-title" className="sr-only">
            {t('saved.title')}
          </h2>
          <div data-saved-root>
            <div className="saved-list" data-saved-list></div>
            <div className="empty-state" data-saved-empty hidden>
              <h2>{t('saved.empty')}</h2>
              <p>{t('saved.emptyHint', { action: t('article.saveForLater') })}</p>
              <p style={{ marginTop: '1rem' }}>
                <a className="text-link" href={href('/articles')}>
                  {t('saved.browseIndex')} →
                </a>
              </p>
            </div>
            <noscript>
              <div className="empty-state">
                <h2>{t('saved.noscriptTitle')}</h2>
                <p>{t('saved.noscriptBody')}</p>
              </div>
            </noscript>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}

export function NotFoundPage({
  settings,
  categories,
  status,
  message,
  requestId,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  status: 404 | 500
  message?: string
  requestId?: string
}) {
  const { t, href } = useI18n()
  return (
    <SiteLayout settings={settings} categories={categories} path="/404">
      <section className="error-page">
        <div className="shell">
          <div className="error-page__grid">
            <div className="error-page__num" aria-hidden="true">
              {status}
            </div>
            <div>
              <Kicker plain>{status === 404 ? t('errors.notFoundKicker') : t('errors.serverKicker')}</Kicker>
              <h1 style={{ marginTop: '1rem' }}>
                {status === 404 ? t('errors.notFoundTitle') : t('errors.serverTitle')}
              </h1>
              <p>{message ?? (status === 404 ? t('errors.notFoundBody') : t('errors.serverBody'))}</p>
              {requestId ? (
                <p className="meta" style={{ marginTop: '1rem' }}>
                  {t('errors.reference', { id: requestId })}
                </p>
              ) : null}
              <div className="error-page__actions">
                <a className="btn" href={href('/')}>
                  {t('errors.backHome')}
                </a>
                <a className="btn btn--ghost" href={href('/articles')}>
                  {t('listing.allArticlesTitle')}
                </a>
                {status === 404 ? (
                  <a className="btn btn--ghost" href={href('/search')}>
                    {t('nav.search')}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
