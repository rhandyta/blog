import { escapeHtml } from '../content/html'

export type SitemapEntry = { loc: string; lastmod?: string; changefreq?: string; priority?: number }

export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const parts = [`<loc>${escapeHtml(entry.loc)}</loc>`]
      if (entry.lastmod) parts.push(`<lastmod>${escapeHtml(entry.lastmod)}</lastmod>`)
      if (entry.changefreq) parts.push(`<changefreq>${entry.changefreq}</changefreq>`)
      if (entry.priority !== undefined) parts.push(`<priority>${entry.priority.toFixed(1)}</priority>`)
      return `<url>${parts.join('')}</url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

export type RssItem = {
  title: string
  link: string
  description: string
  content?: string
  publishedAt: string | null
  author: string
  category: string | null
  guid: string
  language?: string
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function rfc822(iso: string | null): string {
  if (!iso) return new Date().toUTCString()
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString()
}

export function renderRss(input: {
  title: string
  description: string
  origin: string
  feedPath: string
  items: RssItem[]
  lastBuild?: string
  language?: string
}): string {
  const origin = input.origin.replace(/\/$/, '')
  const items = input.items
    .map((item) => {
      const content = item.content ?? ''
      return `<item>
  <title>${escapeHtml(item.title)}</title>
  <link>${escapeHtml(item.link)}</link>
  <guid isPermaLink="true">${escapeHtml(item.guid)}</guid>${item.language ? `\n  <dc:language>${escapeHtml(item.language)}</dc:language>` : ''}
  <pubDate>${rfc822(item.publishedAt)}</pubDate>
  <dc:creator>${escapeHtml(item.author)}</dc:creator>
  ${item.category ? `<category>${escapeHtml(item.category)}</category>` : ''}
  <description>${escapeHtml(item.description)}</description>
  ${content ? `<content:encoded>${cdata(content)}</content:encoded>` : ''}
</item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escapeHtml(input.title)}</title>
  <link>${escapeHtml(origin)}</link>
  <description>${escapeHtml(input.description)}</description>
  <language>${escapeHtml(input.language ?? 'en')}</language>
  <lastBuildDate>${rfc822(input.lastBuild ?? new Date().toISOString())}</lastBuildDate>
  <atom:link href="${escapeHtml(`${origin}${input.feedPath}`)}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`
}
