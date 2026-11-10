import type { ArticleCard } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { Author, MediaAsset } from '../../lib/db/schema'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { ArticleRow, Kicker, Pagination } from '../../components/ui'
import { parseJsonArray, parseJsonObject } from '../../lib/db/queries/taxonomy'

export function AuthorPage({
  settings,
  categories,
  author,
  avatar,
  items,
  total,
  page,
  totalPages,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  author: Author
  avatar: MediaAsset | null
  items: ArticleCard[]
  total: number
  page: number
  totalPages: number
}) {
  const { t, formatDate } = useI18n()
  const expertise = parseJsonArray(author.expertise)
  const socials = parseJsonObject(author.socialLinks)
  const initials = author.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <SiteLayout settings={settings} categories={categories} path={`/author/${author.slug}`}>
      <section className="author-hero">
        <div className="shell">
          <div className="author-hero__grid">
            <div className="author-hero__portrait">
              {avatar ? (
                <img
                  src={avatar.src}
                  alt={author.displayName}
                  width={avatar.width}
                  height={avatar.height}
                  loading="eager"
                />
              ) : (
                <div className="author-hero__initials" aria-hidden="true">
                  {initials || '—'}
                </div>
              )}
            </div>
            <div>
              <Kicker plain>{t('listing.authorKicker')}</Kicker>
              <h1 style={{ marginTop: '0.75rem' }}>{author.displayName}</h1>
              {author.roleTitle ? <p className="meta author-hero__role">{author.roleTitle}</p> : null}
              {author.slug === 'rhandyta-briantama' ? (
                <p className="meta" style={{ marginTop: '0.35rem' }}>
                  {t('listing.authorRole', { site: settings.title })}
                </p>
              ) : null}
              <p className="author-hero__bio">{author.longBio ?? author.bio}</p>
              {expertise.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1.25rem' }}>
                  {expertise.map((topic) => (
                    <span key={topic} className="tag">
                      {topic}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="author-hero__aside">
              <ul className="author-facts">
                <li>
                  {t('listing.authorPieces')} <strong>{total}</strong>
                </li>
                <li>
                  {t('listing.authorLatest')}{' '}
                  <strong>{items[0]?.publishedAt ? formatDate(items[0].publishedAt, 'short') : '—'}</strong>
                </li>
                <li>
                  {t('listing.authorArchive')}{' '}
                  <strong>{t('listing.authorArchivePage', { page, total: totalPages })}</strong>
                </li>
                {socials.website ? (
                  <li>
                    {t('listing.authorWebsite')}{' '}
                    <a href={socials.website} rel="noopener noreferrer" target="_blank">
                      {t('listing.authorVisit')} ↗
                    </a>
                  </li>
                ) : null}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="author-archive">
        <div className="shell">
          <h2 className="section-head">
            <span className="section-head__label">
              <span className="section-head__num">01</span>
              <span>{t('listing.authorArchive')}</span>
            </span>
            <span className="section-head__more">{t('common.pieceCount', { count: total })}</span>
          </h2>
          {items.length ? (
            items.map((card) => <ArticleRow key={card.id} card={card} />)
          ) : (
            <div className="empty-state">
              <h2>{t('listing.emptyAuthor')}</h2>
            </div>
          )}
          <div style={{ marginTop: '1.5rem' }}>
            <Pagination page={page} totalPages={totalPages} basePath={`/author/${author.slug}`} />
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
