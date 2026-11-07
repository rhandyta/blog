import { describe, expect, test } from 'bun:test'
import { renderDoc } from '../src/lib/content/render'
import { docToText, countWords, readingMinutes, makeExcerpt, slugify, parseDoc } from '../src/lib/content/doc'
import { parseMarkdown } from '../src/lib/content/markdown'
import { escapeHtml, safeUrl, splitParagraphs } from '../src/lib/content/html'
import { highlightParts, splitTerms, buildSnippet } from '../src/lib/db/queries/search'
import type { MediaInfo } from '../src/lib/content/doc'

const media: MediaInfo = {
  id: 'media_1',
  src: '/uploads/a-960.webp',
  width: 1600,
  height: 1000,
  alt: 'An abstract cover',
  caption: 'A caption',
  variants: {
    webp: [{ w: 480, src: '/uploads/a-480.webp' }, { w: 960, src: '/uploads/a-960.webp' }],
    avif: [{ w: 480, src: '/uploads/a-480.avif' }],
  },
}

function doc(content: unknown[]) {
  return { type: 'doc', content } as Parameters<typeof renderDoc>[0]
}

describe('renderer', () => {
  test('escapes text so stored content cannot inject markup', () => {
    const { html } = renderDoc(doc([{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }]))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  test('escapes attribute values and drops unsafe URL schemes', () => {
    const { html } = renderDoc(
      doc([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
            { type: 'text', text: ' ok', marks: [{ type: 'link', attrs: { href: 'https://example.com/?q=%22x%22' } }] },
          ],
        },
      ]),
    )
    expect(html).not.toContain('javascript:')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  test('renders headings with deterministic ids and builds a table of contents', () => {
    const result = renderDoc(
      doc([
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Same Title' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Same Title' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'A Section' }] },
      ]),
    )
    expect(result.html).toContain('id="same-title"')
    expect(result.html).toContain('id="same-title-2"')
    expect(result.toc.map((entry) => entry.id)).toEqual(['same-title', 'same-title-2', 'a-section'])
    expect(result.toc[2]?.level).toBe(3)
  })

  test('renders images with responsive sources and an escaped caption', () => {
    const result = renderDoc(
      doc([
        {
          type: 'image',
          attrs: { mediaId: 'media_1', alt: 'Alt "text"', caption: '<b>caption</b>' },
        },
      ]),
      new Map([['media_1', media]]),
    )
    expect(result.html).toContain('type="image/avif"')
    expect(result.html).toContain('srcset=')
    expect(result.html).toContain('alt="Alt &quot;text&quot;"')
    expect(result.html).toContain('&lt;b&gt;caption&lt;/b&gt;')
    expect(result.html).toContain('loading="lazy"')
  })

  test('renders code blocks escaped and highlighted', () => {
    const result = renderDoc(
      doc([
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = "<hello>"' }],
        },
      ]),
    )
    expect(result.html).toContain('class="language-ts"')
    expect(result.html).toContain('&lt;hello&gt;')
    expect(result.html).toContain('hljs-keyword')
  })

  test('renders tables, quotes, lists and embeds', () => {
    const result = renderDoc(
      doc([
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Head' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] },
              ],
            },
          ],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
        { type: 'embed', attrs: { provider: 'youtube', id: 'dQw4w9WgXcQ', caption: 'A video' } },
        { type: 'embed', attrs: { provider: 'youtube', id: 'bad id' } },
      ]),
    )
    expect(result.html).toContain('<table>')
    expect(result.html).toContain('<th scope="col">')
    expect(result.html).toContain('<blockquote>')
    expect(result.html).toContain('<ul>')
    expect(result.html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(result.html.match(/<iframe/g)?.length).toBe(1)
  })
})

describe('text utilities', () => {
  test('computes plain text, word counts and reading time', () => {
    const parsed = parseMarkdown('## Heading\n\nSome words here, and some more. Another sentence follows.')
    const text = docToText(parsed)
    expect(text).toContain('Some words here')
    expect(countWords(text)).toBeGreaterThan(8)
    expect(readingMinutes(text)).toBe(1)
    expect(makeExcerpt('one two three four five', 13)).toBe('one two three…')
    expect(makeExcerpt('short', 50)).toBe('short')
  })

  test('slugifies headings and escapes HTML', () => {
    expect(slugify('Héllo, Wörld!')).toBe('hello-world')
    expect(slugify('')).toBe('untitled')
    expect(escapeHtml('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('/articles/x')).toBe('/articles/x')
    expect(safeUrl('https://example.com')).toBe('https://example.com/')
  })

  test('truncates long slugs on a word boundary', () => {
    const longTitle =
      'Ruang Antara Tombol dan Pikiran: Mengapa Desain Antarmuka adalah Dialog yang Tak Pernah Usai'
    const slug = slugify(longTitle)
    expect(slug.length).toBeLessThanOrEqual(90)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.endsWith('usa')).toBe(false)
    expect(slug.endsWith('pernah')).toBe(true)

    const manyWords = slugify(Array.from({ length: 40 }, (_, index) => `w${index}`).join(' '))
    expect(manyWords.length).toBeLessThanOrEqual(90)
    expect(manyWords.endsWith('-')).toBe(false)
  })

  test('splits paragraphs regardless of line endings', () => {
    expect(splitParagraphs('One.\n\nTwo.')).toEqual(['One.', 'Two.'])
    // Windows textareas post CRLF, which `split(/\n{2,}/)` alone would merge.
    expect(splitParagraphs('One.\r\n\r\nTwo.')).toEqual(['One.', 'Two.'])
    expect(splitParagraphs('One.\r\rTwo.')).toEqual(['One.', 'Two.'])
    expect(splitParagraphs('  \n\n One. \n\n ')).toEqual(['One.'])
    expect(splitParagraphs('')).toEqual([])
  })

  test('parses the seed markdown dialect', () => {
    const parsed = parseMarkdown(`Intro paragraph with **bold** and a [link](/about).

## A heading

- first
- second

1. one
2. two

> A quotation.

\`\`\`ts
const x = 1
\`\`\`

| A | B |
| --- | --- |
| 1 | 2 |

![Alt](media:abc "Caption")

---`)
    const types = parsed.content?.map((node) => node.type)
    expect(types).toContain('heading')
    expect(types).toContain('bulletList')
    expect(types).toContain('orderedList')
    expect(types).toContain('blockquote')
    expect(types).toContain('codeBlock')
    expect(types).toContain('table')
    expect(types).toContain('image')
    expect(types).toContain('horizontalRule')
    const image = parsed.content?.find((node) => node.type === 'image')
    expect(image?.attrs?.mediaId).toBe('abc')
    expect(image?.attrs?.caption).toBe('Caption')
  })

  test('parses corrupt document JSON into an empty document', () => {
    expect(parseDoc('not json').type).toBe('doc')
    expect(parseDoc(null).content?.[0]?.type).toBe('paragraph')
  })
})

describe('search helpers', () => {
  test('splits terms and highlights every occurrence safely', () => {
    expect(splitTerms('Hello, world! hello')).toEqual(['hello', 'world'])
    const parts = highlightParts('The notebook and the Notebook.', ['notebook'])
    expect(parts.filter((part) => part.match).length).toBe(2)
    expect(parts.map((part) => part.text).join('')).toBe('The notebook and the Notebook.')
  })

  test('builds a bounded snippet around the first match', () => {
    const text = `${'filler '.repeat(40)}needle${' filler'.repeat(40)}`
    const snippet = buildSnippet(text, ['needle'], 60)
    expect(snippet).toContain('needle')
    expect(snippet.length).toBeLessThanOrEqual(64)
  })
})
