import type { PMDoc, PMMark, PMNode } from './doc'

function inline(text: string): PMNode[] {
  const nodes: PMNode[] = []
  let buffer = ''
  let index = 0

  const flush = () => {
    if (buffer) {
      nodes.push({ type: 'text', text: buffer })
      buffer = ''
    }
  }

  const readUntil = (marker: string, from: number): number => {
    const found = text.indexOf(marker, from)
    return found
  }

  while (index < text.length) {
    const rest = text.slice(index)

    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/)
    if (link) {
      flush()
      const href = link[2]
      nodes.push({ type: 'text', text: link[1], marks: [{ type: 'link', attrs: { href } }] })
      index += link[0].length
      continue
    }

    if (rest.startsWith('**')) {
      const end = readUntil('**', index + 2)
      if (end !== -1) {
        flush()
        nodes.push({ type: 'text', text: text.slice(index + 2, end), marks: [{ type: 'bold' }] })
        index = end + 2
        continue
      }
    }

    if (rest.startsWith('~~')) {
      const end = readUntil('~~', index + 2)
      if (end !== -1) {
        flush()
        nodes.push({ type: 'text', text: text.slice(index + 2, end), marks: [{ type: 'strike' }] })
        index = end + 2
        continue
      }
    }

    if (rest.startsWith('`')) {
      const end = readUntil('`', index + 1)
      if (end !== -1) {
        flush()
        nodes.push({ type: 'text', text: text.slice(index + 1, end), marks: [{ type: 'code' }] })
        index = end + 1
        continue
      }
    }

    if (rest.startsWith('*')) {
      const end = readUntil('*', index + 1)
      if (end !== -1 && end > index + 1) {
        flush()
        nodes.push({ type: 'text', text: text.slice(index + 1, end), marks: [{ type: 'italic' }] })
        index = end + 1
        continue
      }
    }

    buffer += text[index]
    index += 1
  }

  flush()
  return nodes
}

function paragraph(text: string): PMNode {
  return { type: 'paragraph', content: inline(text.trim()) }
}

const imageLine = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/
const tableSeparator = /^\|?[\s:-]+\|[\s:|-]*$/

export function parseMarkdown(source: string): PMDoc {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const content: PMNode[] = []
  let index = 0

  const skipBlank = () => {
    while (index < lines.length && !lines[index].trim()) index += 1
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (/^(```|~~~)/.test(trimmed)) {
      const language = trimmed.slice(3).trim() || undefined
      index += 1
      const code: string[] = []
      while (index < lines.length && !/^(```|~~~)/.test(lines[index].trim())) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      content.push({
        type: 'codeBlock',
        attrs: language ? { language } : {},
        content: [{ type: 'text', text: code.join('\n') }],
      })
      continue
    }

    if (trimmed === '---') {
      content.push({ type: 'horizontalRule' })
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{2,6})\s+(.*)$/)
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: inline(heading[2].trim()),
      })
      index += 1
      continue
    }

    const image = trimmed.match(imageLine)
    if (image) {
      const mediaId = image[2].startsWith('media:') ? image[2].slice(6) : undefined
      content.push({
        type: 'image',
        attrs: {
          ...(mediaId ? { mediaId } : { src: image[2] }),
          alt: image[1],
          ...(image[3] ? { caption: image[3] } : {}),
        },
      })
      index += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      content.push({
        type: 'blockquote',
        content: [paragraph(quote.join(' '))],
      })
      continue
    }

    if (trimmed.startsWith('|') && lines[index + 1] && tableSeparator.test(lines[index + 1].trim())) {
      const rows: string[][] = []
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim())
      rows.push(parseRow(trimmed))
      index += 2
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(parseRow(lines[index].trim()))
        index += 1
      }
      content.push({
        type: 'table',
        content: rows.map((cells, rowIndex) => ({
          type: 'tableRow',
          content: cells.map((cell) => ({
            type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
            content: [paragraph(cell)],
          })),
        })),
      })
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      const items: PMNode[] = []
      while (index < lines.length) {
        const match = lines[index].trim().match(/^[-*]\s+(.*)$/)
        if (!match) break
        items.push({ type: 'listItem', content: [paragraph(match[1])] })
        index += 1
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/)
    if (ordered) {
      const items: PMNode[] = []
      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.*)$/)
        if (!match) break
        items.push({ type: 'listItem', content: [paragraph(match[1])] })
        index += 1
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items })
      continue
    }

    const buffer: string[] = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = lines[index].trim()
      if (!next || /^(#{2,6}\s|```|~~~|>|\||[-*]\s|\d+\.\s|---$)/.test(next) || imageLine.test(next)) break
      buffer.push(next)
      index += 1
    }
    content.push(paragraph(buffer.join(' ')))
    skipBlank()
  }

  return { type: 'doc', content }
}
