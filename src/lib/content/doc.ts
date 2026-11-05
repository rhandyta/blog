export type PMMark = { type: string; attrs?: Record<string, unknown> }
export type PMNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  marks?: PMMark[]
  text?: string
}
export type PMDoc = { type: 'doc'; content?: PMNode[] }

export type MediaVariant = { w: number; src: string }
export type MediaVariants = { avif?: MediaVariant[]; webp?: MediaVariant[]; og?: string }
export type MediaInfo = {
  id: string
  src: string
  width: number
  height: number
  alt: string
  caption: string | null
  variants: MediaVariants
}

export type TocEntry = { id: string; text: string; level: number }

export const emptyDoc = (): PMDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] })

export function parseDoc(json: string | null | undefined): PMDoc {
  if (!json) return emptyDoc()
  try {
    const parsed = JSON.parse(json) as PMDoc
    if (parsed && parsed.type === 'doc' && (parsed.content === undefined || Array.isArray(parsed.content))) {
      return parsed
    }
  } catch {
    // fall through to empty document
  }
  return emptyDoc()
}

export function isDoc(value: unknown): value is PMDoc {
  if (!value || typeof value !== 'object') return false
  const maybe = value as PMDoc
  return maybe.type === 'doc' && (maybe.content === undefined || Array.isArray(maybe.content))
}

export function nodeText(node: PMNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  const inner = (node.content ?? []).map(nodeText).join(
    node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem' ? ' ' : '',
  )
  return inner
}

export function docToText(doc: PMDoc): string {
  const blocks: string[] = []
  for (const node of doc.content ?? []) {
    const text = nodeText(node).replace(/\s+/g, ' ').trim()
    if (text) blocks.push(text)
  }
  return blocks.join('\n\n')
}

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}'’\-]+/gu)
  return matches ? matches.length : 0
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 220))
}

export function makeExcerpt(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`
}

export function collectMediaIds(doc: PMDoc): string[] {
  const ids = new Set<string>()
  const walk = (nodes: PMNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const mediaId = node.attrs?.mediaId
      if (typeof mediaId === 'string' && mediaId) ids.add(mediaId)
      walk(node.content)
    }
  }
  walk(doc.content)
  return [...ids]
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'untitled'
}
