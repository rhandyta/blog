import type { SearchHit, HighlightPart } from '../../lib/db/queries/search'
import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { formatDate } from '../../lib/content/html'
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
  return (
    <div className="search-suggestions">
      {categories.slice(0, 4).map((category) => (
        <a key={category.id} className={`tag ${accentClass(category.accent)}`} href={`/category/${category.slug}`}>
          {category.name}
        </a>
      ))}
      {tags.slice(0, 8).map((tag) => (
        <a key={tag.id} className="tag" href={`/tags/${tag.slug}`}>
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
  const hasQuery = query.trim().length > 0
  return (
    <SiteLayout settings={settings} categories={categories} path="/search">
      <section className="search-hero">
        <div className="shell">
          <Kicker plain>Search</Kicker>
          <form className="search-form" role="search" action="/search" method="get" data-search-form>
            <span className="search-form__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <label className="sr-only" htmlFor="search-input">Search articles</label>
            <input
              className="search-input"
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search the publication"
              autoComplete="off"
              data-search-input
            />
            <button className="btn" type="submit">Search</button>
          </form>
          <div className="search-meta">
            <span data-search-status aria-live="polite">
              {hasQuery ? `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${query.trim()}”` : 'Search by title, body, section, or tag'}
            </span>
            <span className="search-loading" data-search-loading hidden>Searching</span>
            <span>All published writing</span>
          </div>
        </div>
      </section>

      <div className="shell">
        <div id="search-results-region">
          {!hasQuery ? (
            <div className="search-state">
              <h2>Start with a word</h2>
              <p>
                Search covers the full text of every published essay, along with titles, subtitles, and tags. Try a
                subject, a phrase, or a name.
              </p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          ) : hits.length ? (
            <div className="search-results" data-server-results>
              {hits.map((hit) => (
                <a key={hit.card.id} className="search-result" href={`/articles/${hit.card.slug}`}>
                  <div className="search-result__top">
                    <span className={`meta ${accentClass(hit.card.category?.accent)}`} style={{ color: 'var(--cat)' }}>
                      {hit.card.category?.name ?? 'Essay'}
                    </span>
                    <span className="meta">{formatDate(hit.card.publishedAt, 'short')}</span>
                    <span className="meta">{hit.card.readingMinutes} min read</span>
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
              <h2>No results for “{query.trim()}”</h2>
              <p>
                Nothing matched that search. Try a broader phrase, or browse a section instead. Search requires at
                least two characters per word.
              </p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          )}
          <div className="search-results" data-live-results hidden></div>
          <div className="search-state" data-live-empty hidden>
            <h2>Nothing found</h2>
            <p>Try a different word or a broader phrase.</p>
            <Suggestions categories={categories} tags={tags} />
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}

export function SavedPage({
  settings,
  categories,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
}) {
  return (
    <SiteLayout settings={settings} categories={categories} path="/saved">
      <section className="page-hero">
        <div className="shell">
          <div className="page-hero__grid">
            <div>
              <Kicker plain>Your reading list</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>Saved</h1>
            </div>
            <div>
              <p>
                Articles you have saved for later are kept in this browser, not on the server. Nothing here is shared
                or tracked.
              </p>
              <div className="page-hero__meta">
                <span className="meta" data-saved-meta>Loading…</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="saved-list-title">
        <div className="shell">
          <h2 id="saved-list-title" className="sr-only">Saved articles</h2>
          <div data-saved-root>
            <div className="saved-list" data-saved-list></div>
            <div className="empty-state" data-saved-empty hidden>
              <h2>Nothing saved yet</h2>
              <p>
                Use the “Save for later” control on any article to keep it here. Saved articles live in this browser.
              </p>
              <p style={{ marginTop: '1rem' }}>
                <a className="text-link" href="/articles">Browse the index →</a>
              </p>
            </div>
            <noscript>
              <div className="empty-state">
                <h2>Saved articles need JavaScript</h2>
                <p>Bookmarks are stored locally in your browser, which requires JavaScript to read and display.</p>
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
  return (
    <SiteLayout settings={settings} categories={categories} path="/404">
      <section className="error-page">
        <div className="shell">
          <div className="error-page__grid">
            <div className="error-page__num" aria-hidden="true">{status}</div>
            <div>
              <Kicker plain>{status === 404 ? 'Lost, not forgotten' : 'Something went wrong'}</Kicker>
              <h1 style={{ marginTop: '1rem' }}>
                {status === 404 ? 'This page is not in the index.' : 'The press stopped for a moment.'}
              </h1>
              <p>
                {message ??
                  (status === 404
                    ? 'The address may have changed, or the piece may never have existed. The archive is a good place to start looking.'
                    : 'An unexpected error occurred while rendering this page. The error has been logged; please try again.')}
              </p>
              {requestId ? <p className="meta" style={{ marginTop: '1rem' }}>Reference: {requestId}</p> : null}
              <div className="error-page__actions">
                <a className="btn" href="/">Return home</a>
                <a className="btn btn--ghost" href="/articles">All articles</a>
                {status === 404 ? <a className="btn btn--ghost" href="/search">Search</a> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
