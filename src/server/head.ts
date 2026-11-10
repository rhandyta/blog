import type { MediaInfo } from '../lib/content/doc'
import type { SiteSettings } from '../lib/db/queries/taxonomy'
import { ACCENTS } from '../lib/db/queries/taxonomy'
import type { MediaAsset } from '../lib/db/schema'
import { LOCALE_META, isExternalHref, localizedPath, type Locale } from '../lib/i18n'
import { fallbackOgPath } from '../lib/media/og-fallback'
import type { OgImage, PageHead } from '../lib/seo/meta'

export function parseMediaVariants(value: string | null | undefined): {
  avif?: Array<{ w: number; src: string }>
  webp?: Array<{ w: number; src: string }>
  og?: string
} {
  if (!value) return {}
  try {
    return JSON.parse(value) as {
      avif?: Array<{ w: number; src: string }>
      webp?: Array<{ w: number; src: string }>
      og?: string
    }
  } catch {
    return {}
  }
}

export function ogFromMedia(media: MediaAsset | MediaInfo | null): OgImage | null {
  if (!media) return null
  const raw = (media as { variants?: unknown }).variants
  const variants = typeof raw === 'string' ? parseMediaVariants(raw) : (raw as { og?: string } | undefined)
  const ogPath = variants?.og
  if (ogPath) {
    return { url: ogPath, width: 1200, height: 630, alt: media.alt || undefined }
  }
  return {
    url: media.src,
    width: media.width || undefined,
    height: media.height || undefined,
    alt: media.alt || undefined,
  }
}

/**
 * Builds the head for one localized page. `path` is the locale-free path
 * (`/articles/slug`); the canonical URL and every hreflang alternate are
 * derived from it so new routes cannot forget their translations.
 */
export function baseHead(input: {
  settings: SiteSettings
  origin: string
  locale: Locale
  title: string
  description: string
  path: string
  robots?: string
  ogType?: PageHead['ogType']
  ogImage?: OgImage | null
  publishedTime?: string | null
  modifiedTime?: string | null
  author?: string | null
  section?: string | null
  tags?: string[]
  jsonLd?: unknown[]
  alternates?: PageHead['alternates']
  /** Set when the page's language differs from the interface language. */
  htmlLang?: string
  pagination?: { prev?: string | null; next?: string | null }
}): PageHead {
  const meta = LOCALE_META[input.locale]
  const noIndex = (input.robots ?? '').includes('noindex')
  const ogImage =
    input.ogImage ??
    (noIndex
      ? null
      : {
          url: fallbackOgPath(`${input.settings.title}${input.path}`, ACCENTS[0].hex),
          width: 1200,
          height: 630,
          alt: input.settings.title,
        })

  const canonicalPath = isExternalHref(input.path) ? input.path : localizedPath(input.locale, input.path)
  const alternates =
    input.alternates ??
    (noIndex || isExternalHref(input.path)
      ? undefined
      : [
          { hreflang: 'id', path: localizedPath('id', input.path) },
          { hreflang: 'en', path: localizedPath('en', input.path) },
          // The Indonesian page is the default document for unqualified links.
          { hreflang: 'x-default', path: localizedPath('id', input.path) },
        ])

  return {
    title: input.title,
    description: input.description,
    canonicalPath,
    robots: input.robots,
    ogType: input.ogType,
    ogImage,
    publishedTime: input.publishedTime ?? null,
    modifiedTime: input.modifiedTime ?? null,
    author: input.author ?? null,
    section: input.section ?? null,
    tags: input.tags ?? [],
    jsonLd: input.jsonLd ?? [],
    siteName: input.settings.title,
    origin: input.origin,
    lang: input.htmlLang ?? meta.htmlLang,
    locale: meta.ogLocale,
    alternates,
    pagination: input.pagination,
  }
}
