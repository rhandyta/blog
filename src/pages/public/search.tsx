import type { SearchHit, HighlightPart } from '../../lib/db/queries/search'
import type { CategoryWithCount, SiteSettings, TagWithCount } from '../../lib/db/queries/taxonomy'
import { formatDate } from '../../lib/content/html'
import { ui } from '../../lib/content/ui-copy'
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
          <Kicker plain>{ui.search.title}</Kicker>
          <form className="search-form" role="search" action="/search" method="get" data-search-form>
            <span className="search-form__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <label className="sr-only" htmlFor="search-input">{ui.search.label}</label>
            <input
              className="search-input"
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={ui.search.placeholder}
              autoComplete="off"
              data-search-input
            />
            <button className="btn" type="submit">{ui.search.submit}</button>
          </form>
          <div className="search-meta">
            <span data-search-status aria-live="polite">
              {hasQuery ? ui.search.resultsFor(query.trim()) : ui.search.placeholder}
            </span>
            <span className="search-loading" data-search-loading hidden>Mencari</span>
            <span>Semua tulisan terbit</span>
          </div>
        </div>
      </section>

      <div className="shell">
        <div id="search-results-region">
          {!hasQuery ? (
            <div className="search-state">
              <h2>Mulai dengan satu kata</h2>
              <p>
                Pencarian mencakup seluruh teks setiap esai terbit, beserta judul, subjudul, dan tag. Coba sebuah
                topik, frasa, atau nama.
              </p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          ) : hits.length ? (
            <div className="search-results" data-server-results>
              {hits.map((hit) => (
                <a key={hit.card.id} className="search-result" href={`/articles/${hit.card.slug}`}>
                  <div className="search-result__top">
                    <span className={`meta ${accentClass(hit.card.category?.accent)}`} style={{ color: 'var(--cat)' }}>
                      {hit.card.category?.name ?? ui.common.essay}
                    </span>
                    <span className="meta">{formatDate(hit.card.publishedAt, 'short')}</span>
                    <span className="meta">{ui.article.minRead(hit.card.readingMinutes)}</span>
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
              <h2>{ui.search.noResults(query.trim())}</h2>
              <p>
                Tidak ada yang cocok. Coba frasa yang lebih umum, atau jelajahi rubrik lain. Pencarian membutuhkan
                sedikitnya dua karakter per kata.
              </p>
              <Suggestions categories={categories} tags={tags} />
            </div>
          )}
          <div className="search-results" data-live-results hidden></div>
          <div className="search-state" data-live-empty hidden>
            <h2>Tidak ditemukan</h2>
            <p>Coba kata lain atau frasa yang lebih umum.</p>
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
              <Kicker plain>Daftar bacaanmu</Kicker>
              <h1 className="display-lg" style={{ marginTop: '1rem' }}>{ui.saved.title}</h1>
            </div>
            <div>
              <p>
                Artikel yang kamu simpan tersimpan di peramban ini, bukan di server. Tidak ada yang dibagikan atau
                dilacak.
              </p>
              <div className="page-hero__meta">
                <span className="meta" data-saved-meta>Memuat…</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="latest" aria-labelledby="saved-list-title">
        <div className="shell">
          <h2 id="saved-list-title" className="sr-only">{ui.saved.title}</h2>
          <div data-saved-root>
            <div className="saved-list" data-saved-list></div>
            <div className="empty-state" data-saved-empty hidden>
              <h2>Belum ada yang disimpan</h2>
              <p>
                Gunakan tombol “{ui.article.saveForLater}” pada artikel mana pun untuk menyimpannya di sini. Tersimpan
                hanya di peramban ini.
              </p>
              <p style={{ marginTop: '1rem' }}>
                <a className="text-link" href="/articles">Jelajahi indeks →</a>
              </p>
            </div>
            <noscript>
              <div className="empty-state">
                <h2>Artikel tersimpan membutuhkan JavaScript</h2>
                <p>Daftar bacaan disimpan secara lokal di perambanmu, sehingga perlu JavaScript untuk membacanya.</p>
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
              <Kicker plain>{status === 404 ? 'Tersesat, bukan terlupakan' : 'Ada yang tidak berjalan'}</Kicker>
              <h1 style={{ marginTop: '1rem' }}>
                {status === 404 ? 'Halaman ini tidak ada di indeks.' : 'Mesin cetak berhenti sejenak.'}
              </h1>
              <p>
                {message ??
                  (status === 404
                    ? 'Alamatnya mungkin sudah berubah, atau tulisan itu memang tidak pernah ada. Arsip adalah tempat yang baik untuk mulai mencari.'
                    : 'Terjadi kesalahan tak terduga saat merender halaman ini. Kesalahan sudah dicatat; silakan coba lagi.')}
              </p>
              {requestId ? <p className="meta" style={{ marginTop: '1rem' }}>Referensi: {requestId}</p> : null}
              <div className="error-page__actions">
                <a className="btn" href="/">Kembali ke beranda</a>
                <a className="btn btn--ghost" href="/articles">{ui.listing.allArticlesTitle}</a>
                {status === 404 ? <a className="btn btn--ghost" href="/search">{ui.nav.search}</a> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
