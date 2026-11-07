import { createLowlight, common } from 'lowlight'
import type { MediaInfo, PMDoc, PMMark, PMNode, TocEntry } from './doc'
import { nodeText, slugify } from './doc'
import { escapeAttr, escapeHtml, safeUrl } from './html'

const lowlight = createLowlight(common)

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function hastToHtml(node: HastNode): string {
  if (node.type === 'text') return escapeHtml(node.value ?? '')
  if (node.type === 'root') return (node.children ?? []).map(hastToHtml).join('')
  if (node.type !== 'element') return ''
  const tag = node.tagName === 'span' ? 'span' : 'span'
  const className = Array.isArray(node.properties?.className)
    ? (node.properties?.className as unknown[]).filter((name): name is string => typeof name === 'string')
    : []
  const classAttr = className.length ? ` class="${escapeAttr(className.join(' '))}"` : ''
  return `<${tag}${classAttr}>${(node.children ?? []).map(hastToHtml).join('')}</${tag}>`
}

function highlightCode(code: string, language: string | undefined): string {
  if (!language) return escapeHtml(code)
  try {
    if (!lowlight.registered(language)) return escapeHtml(code)
    return hastToHtml(lowlight.highlight(language, code) as unknown as HastNode)
  } catch {
    return escapeHtml(code)
  }
}

function marksToHtml(text: string, marks: PMMark[] | undefined): string {
  let html = escapeHtml(text)
  let link: string | null = null
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`
        break
      case 'italic':
        html = `<em>${html}</em>`
        break
      case 'underline':
        html = `<u>${html}</u>`
        break
      case 'strike':
        html = `<s>${html}</s>`
        break
      case 'code':
        html = `<code>${html}</code>`
        break
      case 'link': {
        const href = safeUrl(typeof mark.attrs?.href === 'string' ? mark.attrs.href : undefined)
        if (href) link = href
        break
      }
      default:
        break
    }
  }
  if (link) {
    const isExternal = /^https?:\/\//i.test(link)
    const rel = isExternal ? ' rel="noopener noreferrer"' : ''
    const target = isExternal ? ' target="_blank"' : ''
    html = `<a href="${escapeAttr(link)}"${rel}${target}>${html}</a>`
  }
  return html
}

function srcset(variants: Array<{ w: number; src: string }> | undefined): string {
  if (!variants?.length) return ''
  return variants
    .slice()
    .sort((a, b) => a.w - b.w)
    .map((variant) => `${variant.src} ${variant.w}w`)
    .join(', ')
}

function renderImage(node: PMNode, media: Map<string, MediaInfo>): string {
  const mediaId = typeof node.attrs?.mediaId === 'string' ? node.attrs.mediaId : null
  const info = mediaId ? media.get(mediaId) : undefined
  const caption =
    (typeof node.attrs?.caption === 'string' && node.attrs.caption) || info?.caption || ''
  const alt = (typeof node.attrs?.alt === 'string' && node.attrs.alt) || info?.alt || ''
  let inner = ''

  if (info) {
    const avif = srcset(info.variants.avif)
    const webp = srcset(info.variants.webp)
    const width = info.width || undefined
    const height = info.height || undefined
    inner = `<picture>
      ${avif ? `<source type="image/avif" srcset="${escapeAttr(avif)}" sizes="(min-width: 960px) 720px, 100vw">` : ''}
      ${webp ? `<source type="image/webp" srcset="${escapeAttr(webp)}" sizes="(min-width: 960px) 720px, 100vw">` : ''}
      <img src="${escapeAttr(info.src)}" alt="${escapeAttr(alt)}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} loading="lazy" decoding="async">
    </picture>`
  } else {
    const src = safeUrl(typeof node.attrs?.src === 'string' ? node.attrs.src : undefined)
    if (!src) return ''
    const width = typeof node.attrs?.width === 'number' ? node.attrs.width : undefined
    const height = typeof node.attrs?.height === 'number' ? node.attrs.height : undefined
    inner = `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} loading="lazy" decoding="async">`
  }

  return `<figure class="article-figure">${inner}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`
}

function embedUrl(node: PMNode): string | null {
  const provider = typeof node.attrs?.provider === 'string' ? node.attrs.provider : ''
  const raw = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
  const id = typeof node.attrs?.id === 'string' ? node.attrs.id : ''
  if (provider === 'youtube') {
    const candidate = id || raw.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,20})/)?.[1] || ''
    return /^[A-Za-z0-9_-]{6,20}$/.test(candidate) ? `https://www.youtube-nocookie.com/embed/${candidate}` : null
  }
  if (provider === 'vimeo') {
    const candidate = id || raw.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/)?.[1] || ''
    return /^\d{5,12}$/.test(candidate) ? `https://player.vimeo.com/video/${candidate}` : null
  }
  return null
}

type RenderContext = {
  media: Map<string, MediaInfo>
  ids: WeakMap<object, string>
  html: string[]
  toc: TocEntry[]
}

function renderChildren(nodes: PMNode[] | undefined, context: RenderContext): string {
  return (nodes ?? []).map((node) => renderNode(node, context)).join('')
}

function renderNode(node: PMNode, context: RenderContext): string {
  switch (node.type) {
    case 'doc':
      return renderChildren(node.content, context)
    case 'paragraph': {
      const inner = renderChildren(node.content, context)
      return `<p>${inner}</p>`
    }
    case 'heading': {
      const rawLevel = typeof node.attrs?.level === 'number' ? node.attrs.level : 2
      const level = Math.min(6, Math.max(2, rawLevel))
      const id = context.ids.get(node) ?? ''
      return `<h${level} id="${escapeAttr(id)}">${renderChildren(node.content, context)}</h${level}>`
    }
    case 'text':
      return marksToHtml(node.text ?? '', node.marks)
    case 'hardBreak':
      return '<br>'
    case 'bulletList':
      return `<ul>${renderChildren(node.content, context)}</ul>`
    case 'orderedList': {
      const start = typeof node.attrs?.start === 'number' && node.attrs.start !== 1 ? ` start="${node.attrs.start}"` : ''
      return `<ol${start}>${renderChildren(node.content, context)}</ol>`
    }
    case 'listItem':
      return `<li>${renderChildren(node.content, context)}</li>`
    case 'blockquote':
      return `<blockquote>${renderChildren(node.content, context)}</blockquote>`
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : undefined
      const code = node.content?.map((child) => child.text ?? '').join('') ?? ''
      const label = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : ''
      return `<div class="code-block">${label}<button class="code-copy" type="button" data-copy-code aria-label="Copy code to clipboard">Copy</button><pre><code${language ? ` class="language-${escapeAttr(language)}"` : ''}>${highlightCode(code, language)}</code></pre></div>`
    }
    case 'horizontalRule':
      return '<hr class="article-rule">'
    case 'image':
      return renderImage(node, context.media)
    case 'table':
      return `<div class="table-scroll"><table>${renderChildren(node.content, context)}</table></div>`
    case 'tableRow':
      return `<tr>${renderChildren(node.content, context)}</tr>`
    case 'tableHeader':
      return `<th scope="col">${renderChildren(node.content, context)}</th>`
    case 'tableCell':
      return `<td>${renderChildren(node.content, context)}</td>`
    case 'embed': {
      const src = embedUrl(node)
      if (!src) return ''
      const caption = typeof node.attrs?.caption === 'string' ? node.attrs.caption : ''
      const title = caption || 'Embedded media'
      return `<figure class="embed"><div class="embed-frame"><iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`
    }
    default:
      return renderChildren(node.content, context)
  }
}

export type RenderResult = { html: string; toc: TocEntry[] }

export function renderDoc(doc: PMDoc, media: Map<string, MediaInfo> = new Map()): RenderResult {
  const ids = new WeakMap<object, string>()
  const toc: TocEntry[] = []
  const used = new Map<string, number>()

  const walk = (nodes: PMNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'heading') {
        const text = nodeText(node).replace(/\s+/g, ' ').trim()
        const base = slugify(text) || 'section'
        const seen = used.get(base) ?? 0
        used.set(base, seen + 1)
        const id = seen === 0 ? base : `${base}-${seen + 1}`
        ids.set(node, id)
        const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 2
        if (level <= 4) toc.push({ id, text: text || 'Untitled section', level })
      }
      walk(node.content)
    }
  }
  walk(doc.content)

  const context: RenderContext = { media, ids, html: [], toc }
  const html = renderChildren(doc.content, context)
  return { html, toc }
}

export const emptyRender: RenderResult = { html: '', toc: [] }
