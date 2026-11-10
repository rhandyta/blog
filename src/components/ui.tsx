import type { ReactNode } from 'react'
import type { MediaInfo } from '../lib/content/doc'
import type { ArticleCard } from '../lib/db/queries/articles'
import type { CategoryWithCount, TagWithCount } from '../lib/db/queries/taxonomy'
import { useI18n } from '../lib/i18n'

export function Fleuron({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="fleuron"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
    </svg>
  )
}

export function accentClass(accent: string | null | undefined): string {
  return `accent-${accent || 'vermilion'}`
}

function srcset(variants: Array<{ w: number; src: string }> | undefined): string | undefined {
  if (!variants?.length) return undefined
  return variants
    .slice()
    .sort((a, b) => a.w - b.w)
    .map((variant) => `${variant.src} ${variant.w}w`)
    .join(', ')
}

export function Cover({
  media,
  aspect = 'wide',
  sizes = '(min-width: 1320px) 30vw, (min-width: 760px) 45vw, 100vw',
  priority = false,
  decorative = false,
  className = '',
}: {
  media: MediaInfo | null
  aspect?: 'wide' | 'hero' | 'square' | 'portrait' | 'thumb'
  sizes?: string
  priority?: boolean
  decorative?: boolean
  className?: string
}) {
  if (!media) {
    return <div className={`cover cover--${aspect} cover--empty ${className}`} aria-hidden="true" />
  }
  return (
    <div className={`cover cover--${aspect} ${className}`}>
      <picture>
        <source type="image/avif" srcSet={srcset(media.variants.avif)} sizes={sizes} />
        <source type="image/webp" srcSet={srcset(media.variants.webp)} sizes={sizes} />
        <img
          src={media.src}
          alt={decorative ? '' : media.alt}
          width={media.width || undefined}
          height={media.height || undefined}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      </picture>
    </div>
  )
}

export function Kicker({
  children,
  accent,
  plain = false,
}: {
  children: ReactNode
  accent?: string | null
  plain?: boolean
}) {
  return (
    <span className={`kicker ${accent ? accentClass(accent) : ''} ${plain ? 'kicker--plain' : ''}`}>{children}</span>
  )
}

export function SectionHead({
  number,
  label,
  moreHref,
  moreLabel,
}: {
  number: string
  label: string
  moreHref?: string
  moreLabel?: string
}) {
  const { t, href } = useI18n()
  return (
    <h2 className="section-head">
      <span className="section-head__label">
        <span className="section-head__num">{number}</span>
        <span>{label}</span>
      </span>
      {moreHref ? (
        <a className="section-head__more" href={href(moreHref)}>
          {moreLabel ?? t('listing.allArticlesTitle')} →
        </a>
      ) : null}
    </h2>
  )
}

export function ArticleRow({ card, showExcerpt = true }: { card: ArticleCard; showExcerpt?: boolean }) {
  const { t, href, formatDate } = useI18n()
  return (
    <a className={`article-row ${accentClass(card.category?.accent)}`} href={href(`/articles/${card.slug}`)}>
      <div className="article-row__meta">
        <span className="cat">{card.category?.name ?? t('common.essay')}</span>
        <span className="meta">{formatDate(card.publishedAt, 'short')}</span>
        <span className="meta">{t('common.minuteShort', { count: card.readingMinutes })}</span>
      </div>
      <div className="article-row__body">
        <h3 className="article-row__title">{card.title}</h3>
        {showExcerpt && card.excerpt ? <p className="article-row__excerpt">{card.excerpt}</p> : null}
      </div>
      <div className="article-row__thumb">
        <Cover media={card.media} aspect="thumb" sizes="(min-width: 760px) 140px, 88px" decorative />
      </div>
      <span className="article-row__arrow" aria-hidden="true">
        →
      </span>
    </a>
  )
}

export function PickLead({ card }: { card: ArticleCard }) {
  const { t, href, formatDate } = useI18n()
  return (
    <a className={`pick pick--lead ${accentClass(card.category?.accent)}`} href={href(`/articles/${card.slug}`)}>
      <Cover media={card.media} aspect="wide" sizes="(min-width: 960px) 50vw, 100vw" decorative />
      <span className="pick__index">{t('common.editorsPick')}</span>
      <div className="pick__body">
        <h3 className="pick__title">{card.title}</h3>
        <p className="pick__excerpt">{card.excerpt}</p>
        <span className="meta">
          {card.category?.name} · {formatDate(card.publishedAt, 'short')} ·{' '}
          {t('common.minuteShort', { count: card.readingMinutes })}
        </span>
      </div>
    </a>
  )
}

export function PickSmall({ card, index }: { card: ArticleCard; index: number }) {
  const { t, href } = useI18n()
  return (
    <a className={`pick pick--small ${accentClass(card.category?.accent)}`} href={href(`/articles/${card.slug}`)}>
      <Cover media={card.media} aspect="square" sizes="120px" decorative />
      <div className="pick__body">
        <span className="pick__index">0{index}</span>
        <h3 className="pick__title">{card.title}</h3>
        <span className="meta">
          {card.category?.name} · {t('common.minuteShort', { count: card.readingMinutes })}
        </span>
      </div>
    </a>
  )
}

export function TagList({ tags }: { tags: Array<Pick<TagWithCount, 'slug' | 'name'>> }) {
  const { href } = useI18n()
  if (!tags.length) return null
  return (
    <div className="article-tags">
      {tags.map((tag) => (
        <a key={tag.slug} className="tag" href={href(`/tags/${tag.slug}`)}>
          {tag.name}
        </a>
      ))}
    </div>
  )
}

export function TopicRow({ category, index }: { category: CategoryWithCount; index: number }) {
  const { t, href } = useI18n()
  return (
    <a className={`topic-row ${accentClass(category.accent)}`} href={href(`/category/${category.slug}`)}>
      <span className="topic-row__num">{String(index + 1).padStart(2, '0')}</span>
      <span className="topic-row__name">{category.name}</span>
      <span className="topic-row__desc">{category.description}</span>
      <span className="topic-row__count">{t('common.pieceCount', { count: category.articleCount })}</span>
      <span className="topic-row__arrow" aria-hidden="true">
        →
      </span>
    </a>
  )
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number
  totalPages: number
  basePath: string
  params?: Record<string, string | undefined>
}) {
  const { t, href } = useI18n()
  if (totalPages <= 1) return null
  const buildHref = (target: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value)
    }
    if (target > 1) search.set('page', String(target))
    const query = search.toString()
    return href(query ? `${basePath}?${query}` : basePath)
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const visible = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)

  return (
    <nav className="paginator" aria-label={t('listing.pagination')}>
      {page > 1 ? (
        <a href={buildHref(page - 1)} rel="prev">
          ← {t('listing.newer')}
        </a>
      ) : (
        <span className="disabled">← {t('listing.newer')}</span>
      )}
      <div className="paginator__pages">
        {visible.map((value, index) => {
          const previous = visible[index - 1]
          return (
            <span key={value} style={{ display: 'contents' }}>
              {previous && value - previous > 1 ? <span className="disabled">…</span> : null}
              {value === page ? (
                <span aria-current="page">{value}</span>
              ) : (
                <a href={buildHref(value)} aria-label={t('listing.page', { page: value })}>
                  {value}
                </a>
              )}
            </span>
          )
        })}
      </div>
      {page < totalPages ? (
        <a href={buildHref(page + 1)} rel="next">
          {t('listing.older')} →
        </a>
      ) : (
        <span className="disabled">{t('listing.older')} →</span>
      )}
    </nav>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  )
}

export function AuthorInitials({ name, className = 'byline-initials' }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <span className={className} aria-hidden="true">
      {initials || '—'}
    </span>
  )
}

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const { t } = useI18n()
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  return (
    <div className="rail-actions" role="group" aria-label={t('article.share')}>
      <button className="rail-action" type="button" data-share="native" data-share-url={url} data-share-title={title}>
        <span>{t('article.share')}</span>
        <span aria-hidden="true">↗</span>
      </button>
      <a
        className="rail-action"
        href={`https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>{t('article.postToX')}</span>
        <span aria-hidden="true">↗</span>
      </a>
      <a
        className="rail-action"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>{t('article.linkedin')}</span>
        <span aria-hidden="true">↗</span>
      </a>
      <a className="rail-action" href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}>
        <span>{t('article.email')}</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}
