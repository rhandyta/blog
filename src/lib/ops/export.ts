import zlib from 'node:zlib'
import { asc, desc } from 'drizzle-orm'
import { parseDoc, type MediaInfo, type PMDoc, type PMMark, type PMNode } from '../content/doc'
import { safeUrl } from '../content/html'
import { getDb } from '../db/client'
import {
  articleRevisions,
  articles,
  articleTags,
  authors,
  categories,
  media,
  subscribers,
  tags,
  type Article,
} from '../db/schema'
import { getAutomationSettings } from '../db/queries/automation'
import { toMediaInfo } from '../db/queries/media'
import { getNewsletterSchedule } from '../db/queries/newsletter'
import { getSiteSettings } from '../db/queries/taxonomy'

function renderInlineMarks(text: string, marks: PMMark[] | undefined): string {
  if (!marks?.length) return text
  const codeMark = marks.find((mark) => mark.type === 'code')
  let result = codeMark ? `\`${text.replace(/`/g, '\\`')}\`` : text
  for (const mark of marks) {
    if (mark.type === 'code') continue
    if (mark.type === 'bold' || mark.type === 'strong') {
      result = `**${result}**`
    } else if (mark.type === 'italic' || mark.type === 'em') {
      result = `*${result}*`
    } else if (mark.type === 'strike') {
      result = `~~${result}~~`
    } else if (mark.type === 'underline') {
      result = `<u>${result}</u>`
    } else if (mark.type === 'link') {
      const href = safeUrl(typeof mark.attrs?.href === 'string' ? mark.attrs.href : null)
      if (href) result = `[${result}](${href})`
    }
  }
  return result
}

function renderInlineNodes(nodes: PMNode[] | undefined): string {
  if (!nodes?.length) return ''
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return renderInlineMarks(node.text ?? '', node.marks)
      }
      if (node.type === 'hardBreak') {
        return '  \n'
      }
      return renderInlineNodes(node.content)
    })
    .join('')
}

function renderListItems(nodes: PMNode[] | undefined, ordered: boolean, start: number, depth: number): string {
  const indent = '  '.repeat(depth)
  return (nodes ?? [])
    .map((item, idx) => {
      const marker = ordered ? `${start + idx}. ` : '- '
      const children = item.content ?? []
      const parts: string[] = []
      children.forEach((child, childIdx) => {
        if (child.type === 'bulletList') {
          parts.push(renderListItems(child.content, false, 1, depth + 1))
        } else if (child.type === 'orderedList') {
          const childStart = typeof child.attrs?.start === 'number' ? child.attrs.start : 1
          parts.push(renderListItems(child.content, true, childStart, depth + 1))
        } else {
          const inline = renderInlineNodes(child.content).trim()
          if (!inline) return
          if (childIdx === 0) {
            parts.push(`${indent}${marker}${inline}`)
          } else {
            parts.push(`${indent}  ${inline}`)
          }
        }
      })
      return parts.join('\n')
    })
    .filter(Boolean)
    .join('\n')
}

function renderTable(node: PMNode): string {
  const rows = (node.content ?? []).filter((row) => row.type === 'tableRow')
  if (!rows.length) return ''
  const matrix = rows.map((row) =>
    (row.content ?? []).map((cell) => {
      const cellText = (cell.content ?? [])
        .map((inner) => renderInlineNodes(inner.content).trim())
        .filter(Boolean)
        .join(' ')
      return cellText.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
    }),
  )
  const colCount = Math.max(1, ...matrix.map((row) => row.length))
  const pad = (row: string[]) => Array.from({ length: colCount }, (_, i) => row[i] ?? '')
  const header = pad(matrix[0] ?? [])
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...matrix.slice(1).map((row) => `| ${pad(row).join(' | ')} |`),
  ]
  return lines.join('\n')
}

function renderBlock(node: PMNode, mediaMap?: Map<string, MediaInfo>): string {
  switch (node.type) {
    case 'paragraph':
      return renderInlineNodes(node.content).trimEnd()
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)))
      return `${'#'.repeat(level)} ${renderInlineNodes(node.content).trim()}`
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map((child) => renderBlock(child, mediaMap)).filter(Boolean).join('\n\n')
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    }
    case 'bulletList':
      return renderListItems(node.content, false, 1, 0)
    case 'orderedList': {
      const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1
      return renderListItems(node.content, true, start, 0)
    }
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language.replace(/[^a-zA-Z0-9_-]/g, '') : ''
      const code = (node.content ?? []).map((child) => child.text ?? '').join('')
      const fence = code.includes('```') ? '````' : '```'
      return `${fence}${language}\n${code}\n${fence}`
    }
    case 'horizontalRule':
      return '---'
    case 'image':
    case 'figure': {
      const mediaId = typeof node.attrs?.mediaId === 'string' ? node.attrs.mediaId : ''
      const asset = mediaId ? mediaMap?.get(mediaId) : undefined
      const src = asset?.src ?? safeUrl(typeof node.attrs?.src === 'string' ? node.attrs.src : null)
      if (!src) return ''
      const alt = (typeof node.attrs?.alt === 'string' && node.attrs.alt) || asset?.alt || ''
      const caption = (typeof node.attrs?.caption === 'string' && node.attrs.caption) || asset?.caption || ''
      const sanitizedAlt = alt.replaceAll('[', '').replaceAll(']', '')
      return caption ? `![${sanitizedAlt}](${src})\n\n*${caption.trim()}*` : `![${sanitizedAlt}](${src})`
    }
    case 'table':
      return renderTable(node)
    default: {
      if (!node.content?.length) return node.text ?? ''
      return node.content.map((child) => renderBlock(child, mediaMap)).filter(Boolean).join('\n\n')
    }
  }
}

export function docToMarkdown(doc: PMDoc, mediaMap?: Map<string, MediaInfo>): string {
  const blocks = (doc.content ?? []).map((node) => renderBlock(node, mediaMap)).filter((block) => block.trim().length > 0)
  return `${blocks.join('\n\n')}\n`
}

export function articleToMarkdownFile(input: {
  article: Article
  authorName: string | null
  categoryName: string | null
  tags: string[]
  mediaMap?: Map<string, MediaInfo>
}): string {
  const { article, authorName, categoryName, tags: tagNames, mediaMap } = input
  const doc = parseDoc(article.bodyJson)
  const frontmatter: string[] = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `slug: ${JSON.stringify(article.slug)}`,
    `status: ${JSON.stringify(article.status)}`,
    ...(article.subtitle ? [`subtitle: ${JSON.stringify(article.subtitle)}`] : []),
    ...(article.excerpt ? [`excerpt: ${JSON.stringify(article.excerpt)}`] : []),
    ...(authorName ? [`author: ${JSON.stringify(authorName)}`] : []),
    ...(categoryName ? [`category: ${JSON.stringify(categoryName)}`] : []),
    ...(article.language ? [`language: ${JSON.stringify(article.language)}`] : []),
    ...(article.publishedAt ? [`publishedAt: ${JSON.stringify(article.publishedAt)}`] : []),
    ...(article.scheduledFor ? [`scheduledFor: ${JSON.stringify(article.scheduledFor)}`] : []),
    `updatedAt: ${JSON.stringify(article.updatedAt)}`,
    ...(article.seoTitle ? [`seoTitle: ${JSON.stringify(article.seoTitle)}`] : []),
    ...(article.seoDescription ? [`seoDescription: ${JSON.stringify(article.seoDescription)}`] : []),
    ...(article.canonicalUrl ? [`canonicalUrl: ${JSON.stringify(article.canonicalUrl)}`] : []),
    `noIndex: ${article.noIndex ? 'true' : 'false'}`,
    ...(tagNames.length
      ? ['tags:', ...tagNames.map((tag) => `  - ${JSON.stringify(tag)}`)]
      : ['tags: []']),
    '---',
    '',
  ]
  const body = docToMarkdown(doc, mediaMap)
  return `${frontmatter.join('\n')}${body}`
}

export type ZipEntryInput = {
  name: string
  content: string | Uint8Array
  mtime?: Date
}

function dosTimeAndDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()))
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = Math.floor(date.getUTCSeconds() / 2)
  const dosTime = (hours << 11) | (minutes << 5) | seconds
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

/**
 * Builds a standards-compliant PKZIP (Store / method 0, UTF-8) archive with zero
 * external dependencies using Node's native `zlib.crc32`.
 */
export function createZip(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder()
  const localChunks: Buffer[] = []
  const centralChunks: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const cleanName = entry.name.replace(/^\/+/, '')
    const nameBytes = Buffer.from(encoder.encode(cleanName))
    const dataBytes = Buffer.isBuffer(entry.content)
      ? entry.content
      : typeof entry.content === 'string'
        ? Buffer.from(encoder.encode(entry.content))
        : Buffer.from(entry.content)
    const crc = zlib.crc32(dataBytes) >>> 0
    const { dosTime, dosDate } = dosTimeAndDate(entry.mtime ?? new Date())

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // signature
    localHeader.writeUInt16LE(20, 4) // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6) // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8) // compression method 0 = store
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(dataBytes.length, 18)
    localHeader.writeUInt32LE(dataBytes.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28) // extra length

    localChunks.push(localHeader, nameBytes, dataBytes)

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed
    centralHeader.writeUInt16LE(0x0800, 8) // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10) // compression method 0
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(dataBytes.length, 20)
    centralHeader.writeUInt32LE(dataBytes.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30) // extra length
    centralHeader.writeUInt16LE(0, 32) // comment length
    centralHeader.writeUInt16LE(0, 34) // disk number
    centralHeader.writeUInt16LE(0, 36) // internal attributes
    centralHeader.writeUInt32LE(0, 38) // external attributes
    centralHeader.writeUInt32LE(offset, 42) // local header offset

    centralChunks.push(centralHeader, nameBytes)
    offset += localHeader.length + nameBytes.length + dataBytes.length
  }

  const centralDirectory = Buffer.concat(centralChunks)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // disk number
  eocd.writeUInt16LE(0, 6) // start disk
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...localChunks, centralDirectory, eocd])
}

export async function buildContentBackup(): Promise<Record<string, unknown>> {
  const db = getDb()
  const [
    siteSettings,
    automationSettings,
    newsletterSchedule,
    categoryRows,
    tagRows,
    authorRows,
    mediaRows,
    articleRows,
    articleTagRows,
    revisionRows,
    subscriberRows,
  ] = await Promise.all([
    getSiteSettings(),
    getAutomationSettings(),
    getNewsletterSchedule(),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)),
    db.select().from(authors).orderBy(asc(authors.displayName)),
    db.select().from(media).orderBy(desc(media.createdAt)),
    db.select().from(articles).orderBy(desc(articles.publishedAt), desc(articles.createdAt)),
    db.select().from(articleTags),
    db.select().from(articleRevisions).orderBy(desc(articleRevisions.createdAt)),
    db.select().from(subscribers).orderBy(desc(subscribers.createdAt)),
  ])

  // Credentials (users.passwordHash, sessions, rate_limits) are intentionally
  // excluded from content backups.
  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    siteSettings,
    automationSettings,
    newsletterSchedule,
    categories: categoryRows,
    tags: tagRows,
    authors: authorRows,
    media: mediaRows,
    articles: articleRows,
    articleTags: articleTagRows,
    revisions: revisionRows,
    subscribers: subscriberRows.map((subscriber) => ({
      id: subscriber.id,
      email: subscriber.email,
      status: subscriber.status,
      source: subscriber.source,
      suppressionReason: subscriber.suppressionReason,
      confirmedAt: subscriber.confirmedAt,
      createdAt: subscriber.createdAt,
      unsubscribedAt: subscriber.unsubscribedAt,
    })),
  }
}

export async function buildMarkdownArchive(): Promise<Uint8Array> {
  const db = getDb()
  const [siteSettings, authorRows, categoryRows, tagRows, articleRows, articleTagRows, mediaRows] = await Promise.all([
    getSiteSettings(),
    db.select().from(authors),
    db.select().from(categories),
    db.select().from(tags),
    db.select().from(articles).orderBy(desc(articles.publishedAt), desc(articles.createdAt)),
    db.select().from(articleTags),
    db.select().from(media),
  ])

  const authorMap = new Map(authorRows.map((author) => [author.id, author.displayName]))
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category.name]))
  const tagMap = new Map(tagRows.map((tag) => [tag.id, tag.name]))
  const mediaMap = new Map<string, MediaInfo>(mediaRows.map((asset) => [asset.id, toMediaInfo(asset)]))

  const articleTagsByArticle = new Map<string, string[]>()
  for (const row of articleTagRows) {
    const tagName = tagMap.get(row.tagId)
    if (!tagName) continue
    const list = articleTagsByArticle.get(row.articleId) ?? []
    list.push(tagName)
    articleTagsByArticle.set(row.articleId, list)
  }

  const usedPaths = new Set<string>()
  const entries: ZipEntryInput[] = [
    {
      name: 'README.md',
      content: `# ${siteSettings.title} — Editorial Archive\n\nExported at: ${new Date().toISOString()}\nArticles: ${articleRows.length}\nCategories: ${categoryRows.length}\nTags: ${tagRows.length}\n`,
    },
    {
      name: 'settings.json',
      content: JSON.stringify({ siteSettings, categories: categoryRows, tags: tagRows, authors: authorRows }, null, 2),
    },
  ]

  for (const article of articleRows) {
    const safeSlug = article.slug.replace(/[^a-z0-9-_]/gi, '-').replace(/^-+|-+$/g, '') || article.id
    let filename = `articles/${safeSlug}.md`
    if (usedPaths.has(filename)) {
      filename = `articles/${safeSlug}-${article.id.slice(0, 6)}.md`
    }
    usedPaths.add(filename)

    const markdown = articleToMarkdownFile({
      article,
      authorName: authorMap.get(article.authorId) ?? null,
      categoryName: article.categoryId ? (categoryMap.get(article.categoryId) ?? null) : null,
      tags: articleTagsByArticle.get(article.id) ?? [],
      mediaMap,
    })
    entries.push({
      name: filename,
      content: markdown,
      mtime: new Date(article.updatedAt || article.createdAt),
    })
  }

  return createZip(entries)
}
