import type { SiteSettings } from '../db/queries/taxonomy'
import { absoluteUrl, escapeAttr, escapeHtml } from '../content/html'

export type OgImage = { url: string; width?: number; height?: number; alt?: string }

export type PageHead = {
  title: string
  description: string
  canonicalPath: string
  robots?: string
  ogType?: 'website' | 'article' | 'profile'
  ogImage?: OgImage | null
  publishedTime?: string | null
  modifiedTime?: string | null
  author?: string | null
  section?: string | null
  tags?: string[]
  jsonLd?: unknown[]
  siteName: string
  origin: string
  lang?: string
  locale?: string
}

export function fullTitle(title: string, siteName: string): string {
  if (!title) return siteName
  return title.includes(siteName) ? title : `${title} — ${siteName}`
}

export function renderHead(head: PageHead): string {
  const origin = head.origin.replace(/\/$/, '')
  const title = fullTitle(head.title, head.siteName)
  const canonical = absoluteUrl(origin, head.canonicalPath)
  const tags: string[] = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(head.description)}">`,
    `<meta name="author" content="Rhandyta Briantama">`,
    `<link rel="author" href="${escapeAttr(absoluteUrl(origin, '/author/rhandyta-briantama'))}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    `<meta name="robots" content="${escapeAttr(head.robots ?? 'index, follow, max-image-preview:large')}">`,
    `<meta property="og:site_name" content="${escapeAttr(head.siteName)}">`,
    `<meta property="og:title" content="${escapeAttr(head.title)}">`,
    `<meta property="og:description" content="${escapeAttr(head.description)}">`,
    `<meta property="og:type" content="${head.ogType ?? 'website'}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    ...(head.locale
      ? [
          `<meta property="og:locale" content="${escapeAttr(head.locale)}">`,
          `<meta property="og:locale:alternate" content="${head.locale === 'id_ID' ? 'en_US' : 'id_ID'}">`,
        ]
      : []),
    `<meta name="twitter:card" content="${head.ogImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeAttr(head.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(head.description)}">`,
  ]

  if (head.ogImage) {
    const imageUrl = absoluteUrl(origin, head.ogImage.url)
    tags.push(`<meta property="og:image" content="${escapeAttr(imageUrl)}">`)
    tags.push(`<meta name="twitter:image" content="${escapeAttr(imageUrl)}">`)
    if (head.ogImage.width) tags.push(`<meta property="og:image:width" content="${head.ogImage.width}">`)
    if (head.ogImage.height) tags.push(`<meta property="og:image:height" content="${head.ogImage.height}">`)
    if (head.ogImage.alt) {
      tags.push(`<meta property="og:image:alt" content="${escapeAttr(head.ogImage.alt)}">`)
      tags.push(`<meta name="twitter:image:alt" content="${escapeAttr(head.ogImage.alt)}">`)
    }
  }

  if (head.ogType === 'article') {
    if (head.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeAttr(head.publishedTime)}">`)
    if (head.modifiedTime) tags.push(`<meta property="article:modified_time" content="${escapeAttr(head.modifiedTime)}">`)
    if (head.author) tags.push(`<meta property="article:author" content="${escapeAttr(head.author)}">`)
    if (head.section) tags.push(`<meta property="article:section" content="${escapeAttr(head.section)}">`)
    for (const tag of head.tags ?? []) {
      tags.push(`<meta property="article:tag" content="${escapeAttr(tag)}">`)
    }
  }

  tags.push(`<link rel="alternate" type="application/rss+xml" title="${escapeAttr(head.siteName)} — RSS" href="${escapeAttr(absoluteUrl(origin, '/rss.xml'))}">`)

  for (const block of head.jsonLd ?? []) {
    const json = JSON.stringify(block).replace(/</g, '\\u003c')
    tags.push(`<script type="application/ld+json">${json}</script>`)
  }

  return tags.join('\n    ')
}

export function websiteJsonLd(settings: SiteSettings, origin: string): unknown {
  const person = {
    '@type': 'Person',
    name: 'Rhandyta Briantama',
    url: `${origin}/author/rhandyta-briantama`,
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.title,
    description: settings.description,
    url: origin,
    author: person,
    creator: person,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
    publisher: { '@type': 'Organization', name: settings.title, url: origin },
  }
}

export function articleJsonLd(input: {
  origin: string
  title: string
  description: string
  slug: string
  publishedAt: string | null
  modifiedAt: string
  authorName: string
  authorUrl: string | null
  image: OgImage | null
  section: string | null
  tags: string[]
  wordCount?: number
  canonicalUrl?: string | null
  settings: SiteSettings
  language?: string
}): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.canonicalUrl || `${input.origin}/articles/${input.slug}`,
    },
    headline: input.title,
    description: input.description,
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    dateModified: input.modifiedAt,
    ...(input.image
      ? {
          image: {
            '@type': 'ImageObject',
            url: absoluteUrl(input.origin, input.image.url),
            ...(input.image.width ? { width: input.image.width } : {}),
            ...(input.image.height ? { height: input.image.height } : {}),
          },
        }
      : {}),
    author: {
      '@type': 'Person',
      name: input.authorName,
      ...(input.authorUrl ? { url: absoluteUrl(input.origin, input.authorUrl) } : {}),
    },
    publisher: { '@type': 'Organization', name: input.settings.title, url: input.origin },
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.tags.length ? { keywords: input.tags.join(', ') } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
    ...(input.language ? { inLanguage: input.language } : {}),
  }
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  origin: string,
): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(origin, item.path),
    })),
  }
}

export function personJsonLd(input: {
  name: string
  url: string
  description: string
  image: string | null
  origin: string
  jobTitle?: string
  sameAs?: string[]
}): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    url: absoluteUrl(input.origin, input.url),
    description: input.description,
    ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    ...(input.image ? { image: absoluteUrl(input.origin, input.image) } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  }
}

export function collectionJsonLd(input: {
  name: string
  description: string
  url: string
  origin: string
  items: Array<{ title: string; path: string }>
}): unknown {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.origin, input.url),
    hasPart: input.items.map((item) => ({
      '@type': 'BlogPosting',
      headline: item.title,
      url: absoluteUrl(input.origin, item.path),
    })),
  }
}
