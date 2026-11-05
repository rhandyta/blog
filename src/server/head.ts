import type { MediaInfo } from '../lib/content/doc'
import type { SiteSettings } from '../lib/db/queries/taxonomy'
import type { MediaAsset } from '../lib/db/schema'
import type { OgImage, PageHead } from '../lib/seo/meta'

export function parseMediaVariants(value: string | null | undefined): {
  avif?: Array<{ w: number; src: string }>
  webp?: Array<{ w: number; src: string }>
  og?: string
} {
  if (!value) return {}
  try {
    return JSON.parse(value) as { avif?: Array<{ w: number; src: string }>; webp?: Array<{ w: number; src: string }>; og?: string }
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

export function baseHead(input: {
  settings: SiteSettings
  origin: string
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
}): PageHead {
  return {
    title: input.title,
    description: input.description,
    canonicalPath: input.path,
    robots: input.robots,
    ogType: input.ogType,
    ogImage: input.ogImage ?? null,
    publishedTime: input.publishedTime ?? null,
    modifiedTime: input.modifiedTime ?? null,
    author: input.author ?? null,
    section: input.section ?? null,
    tags: input.tags ?? [],
    jsonLd: input.jsonLd ?? [],
    siteName: input.settings.title,
    origin: input.origin,
  }
}

