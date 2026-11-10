import type { ArticleCard, ArticleDetail } from '../../lib/db/queries/articles'
import type { CategoryWithCount, SiteSettings } from '../../lib/db/queries/taxonomy'
import type { TocEntry } from '../../lib/content/doc'
import type { Locale } from '../../lib/i18n'
import { articleStatusKey } from '../../lib/i18n/status'
import { useI18n } from '../../lib/i18n'
import { SiteLayout } from '../../components/layout'
import { AuthorInitials, Cover, Kicker, ShareLinks, TagList, accentClass } from '../../components/ui'

export function ArticlePage({
  settings,
  categories,
  detail,
  html,
  toc,
  url,
  related,
  previous,
  next,
  preview = false,
  contentLanguage,
}: {
  settings: SiteSettings
  categories: CategoryWithCount[]
  detail: ArticleDetail
  html: string
  toc: TocEntry[]
  url: string
  related: ArticleCard[]
  previous: ArticleCard | null
  next: ArticleCard | null
  preview?: boolean
  /** Language of the article body, independent of the interface language. */
  contentLanguage: Locale
}) {
  const { t, href, formatDate } = useI18n()
  const { article, author, category, featuredMedia, tags } = detail
  const accent = category?.accent ?? 'vermilion'
  const initials = author?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <SiteLayout settings={settings} categories={categories} path={`/articles/${article.slug}`}>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-bar" data-progress></div>
      </div>

      <div className={`article-page ${accentClass(accent)}`}>
        {preview ? (
          <div className="shell" style={{ paddingTop: '1rem' }}>
            <div className="flash" data-tone="success" role="status">
              {t('article.previewBanner', { status: t(articleStatusKey(article.status)) })}
            </div>
          </div>
        ) : null}
        <div className="shell">
          <nav className="breadcrumb" aria-label={t('article.breadcrumb')}>
            <a href={href('/')}>{t('nav.home')}</a>
            <span className="sep" aria-hidden="true">
              /
            </span>
            {category ? (
              <>
                <a href={href(`/category/${category.slug}`)}>{category.name}</a>
                <span className="sep" aria-hidden="true">
                  /
                </span>
              </>
            ) : null}
            <span aria-current="page">
              {article.title.length > 48 ? `${article.title.slice(0, 48)}…` : article.title}
            </span>
          </nav>
        </div>

        <article lang={contentLanguage}>
          <header className="article-head shell">
            <div className="article-head__kicker">
              <Kicker accent={accent}>{category?.name ?? t('common.essay')}</Kicker>
              <span className="meta">{t('article.kind')}</span>
            </div>
            <h1 className="article-title">{article.title}</h1>
            {article.subtitle ? <p className="article-deck">{article.subtitle}</p> : null}
            <div className="article-byline">
              {author ? (
                <a className="article-byline__author" href={href(`/author/${author.slug}`)}>
                  <AuthorInitials name={author.displayName} />
                  <span>
                    <span className="article-byline__name">{author.displayName}</span>
                    {author.roleTitle ? (
                      <span className="meta" style={{ display: 'block' }}>
                        {author.roleTitle}
                      </span>
                    ) : null}
                  </span>
                </a>
              ) : null}
              <div className="article-byline__meta">
                {article.publishedAt ? (
                  <time className="meta" dateTime={article.publishedAt}>
                    {formatDate(article.publishedAt, 'long')}
                  </time>
                ) : null}
                <span className="meta">{t('article.minRead', { count: article.readingMinutes })}</span>
                {article.updatedAt &&
                article.publishedAt &&
                article.updatedAt.slice(0, 10) !== article.publishedAt.slice(0, 10) ? (
                  <span className="meta">{t('article.updated', { date: formatDate(article.updatedAt, 'short') })}</span>
                ) : null}
              </div>
            </div>
          </header>

          {featuredMedia ? (
            <figure className="article-hero shell shell--wide">
              <Cover
                media={{
                  id: featuredMedia.id,
                  src: featuredMedia.src,
                  width: featuredMedia.width,
                  height: featuredMedia.height,
                  alt: featuredMedia.alt,
                  caption: featuredMedia.caption,
                  variants: (() => {
                    try {
                      return JSON.parse(featuredMedia.variants) as {
                        avif?: Array<{ w: number; src: string }>
                        webp?: Array<{ w: number; src: string }>
                      }
                    } catch {
                      return {}
                    }
                  })(),
                }}
                aspect="wide"
                sizes="(min-width: 1320px) 1200px, 100vw"
                priority
              />
              {article.featuredCaption || featuredMedia.caption ? (
                <figcaption className="figure-caption">{article.featuredCaption ?? featuredMedia.caption}</figcaption>
              ) : null}
            </figure>
          ) : null}

          <div className="shell">
            <div className="article-layout">
              <aside className="article-rail" aria-label={t('article.rail')}>
                <div className="rail-inner">
                  {toc.length >= 2 ? (
                    <nav className="rail-toc toc" aria-label={t('article.contents')}>
                      <div className="rail-label">{t('article.contents')}</div>
                      <ol>
                        {toc.map((entry) => (
                          <li key={entry.id} data-level={entry.level}>
                            <a href={`#${entry.id}`}>{entry.text}</a>
                          </li>
                        ))}
                      </ol>
                    </nav>
                  ) : null}
                  <div className="rail-share">
                    <div className="rail-label">{t('article.share')}</div>
                    <ShareLinks url={url} title={article.title} />
                  </div>
                  <div className="rail-save">
                    <div className="rail-label">{t('article.savedLabel')}</div>
                    <button
                      className="rail-action"
                      type="button"
                      data-bookmark={article.slug}
                      data-bookmark-title={article.title}
                      data-saved-label={t('article.savedLabel')}
                      data-save-label={t('article.saveForLater')}
                      aria-pressed="false"
                    >
                      <span data-bookmark-label>{t('article.saveForLater')}</span>
                      <span aria-hidden="true" data-bookmark-icon>
                        ⌑
                      </span>
                    </button>
                    <div className="article-sidebar-note">{t('article.savedNote')}</div>
                  </div>
                </div>
              </aside>

              <div>
                <div className="article-body" lang={contentLanguage} dangerouslySetInnerHTML={{ __html: html }} />

                <footer className="article-end">
                  <TagList tags={tags} />
                </footer>

                {author ? (
                  <aside className="author-card" aria-label={t('article.aboutAuthor')}>
                    {author.avatarMediaId ? null : (
                      <div className="author-card__initials" aria-hidden="true">
                        {initials || '—'}
                      </div>
                    )}
                    <div>
                      <span className="kicker kicker--plain">{t('article.writtenBy')}</span>
                      <h2 style={{ marginTop: '0.4rem' }}>
                        <a href={href(`/author/${author.slug}`)}>{author.displayName}</a>
                      </h2>
                      {author.roleTitle ? <p className="meta author-card__role">{author.roleTitle}</p> : null}
                      <p>{author.longBio ?? author.bio}</p>
                      <div className="author-card__links">
                        <a className="text-link" href={href(`/author/${author.slug}`)}>
                          {t('article.moreFrom', { name: author.displayName.split(' ')[0] })} →
                        </a>
                      </div>
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          </div>

          {related.length ? (
            <aside className="related shell" aria-labelledby="related-title">
              <h2 className="section-head" id="related-title">
                <span className="section-head__label">
                  <span className="section-head__num" aria-hidden="true">
                    ↳
                  </span>
                  <span>{t('article.relatedReading')}</span>
                </span>
                <a className="section-head__more" href={href(category ? `/category/${category.slug}` : '/articles')}>
                  {t('article.moreIn', { name: category?.name ?? t('home.theIndex') })} →
                </a>
              </h2>
              <div className="related__grid">
                {related.map((card) => (
                  <a
                    key={card.id}
                    className={`related-card ${accentClass(card.category?.accent)}`}
                    href={href(`/articles/${card.slug}`)}
                  >
                    <Cover media={card.media} aspect="wide" sizes="(min-width: 900px) 32vw, 100vw" decorative />
                    <span className="meta">
                      {card.category?.name} · {t('common.minuteShort', { count: card.readingMinutes })}
                    </span>
                    <h3>{card.title}</h3>
                  </a>
                ))}
              </div>
            </aside>
          ) : null}

          <nav className="article-nav shell" aria-label={t('article.adjacent')}>
            <div className="article-nav__item">
              {previous ? (
                <>
                  <span className="kicker kicker--plain">{t('article.earlier')}</span>
                  <a className="article-nav__title" href={href(`/articles/${previous.slug}`)}>
                    ← {previous.title}
                  </a>
                  <span className="meta">
                    {previous.category?.name} · {formatDate(previous.publishedAt, 'short')}
                  </span>
                </>
              ) : (
                <span className="meta">{t('article.earliest')}</span>
              )}
            </div>
            <div className="article-nav__item">
              {next ? (
                <>
                  <span className="kicker kicker--plain">{t('article.later')}</span>
                  <a className="article-nav__title" href={href(`/articles/${next.slug}`)}>
                    {next.title} →
                  </a>
                  <span className="meta">
                    {next.category?.name} · {formatDate(next.publishedAt, 'short')}
                  </span>
                </>
              ) : (
                <span className="meta">{t('article.mostRecent')}</span>
              )}
            </div>
          </nav>
        </article>
      </div>
    </SiteLayout>
  )
}
