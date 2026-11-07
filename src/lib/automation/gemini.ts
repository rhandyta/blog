import { basename, join } from 'node:path'
import { z } from 'zod'
import { getConfig } from '../config'

export type GeminiDraft = {
  title: string
  subtitle: string | null
  excerpt: string
  body: string
  category: string | null
  tags: string[]
  seoDescription: string | null
}

export type GeminiContext = {
  hasActivity: boolean
  activityText: string
  imageSrc: string | null
  language: string
  authorName: string
  authorRole: string | null
  authorBio: string
  categories: Array<{ name: string; slug: string; description: string }>
  tags: Array<{ name: string; slug: string }>
  initiativeBrief: string
  recentTitles?: string[]
}

const draftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).nullable().optional(),
  excerpt: z.string().trim().max(600).optional().default(''),
  body: z.string().trim().min(100),
  category: z.string().trim().max(80).nullable().optional(),
  tags: z.array(z.string().trim().max(60)).max(8).optional().default([]),
  seoDescription: z.string().trim().max(400).nullable().optional(),
})

export function hasGeminiKey(): boolean {
  return Boolean(getConfig().GEMINI_API_KEY)
}

export function geminiModel(preferred?: string): string {
  return preferred || getConfig().GEMINI_MODEL || 'gemini-2.5-flash'
}

export function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  if (start === -1) return trimmed

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return trimmed.slice(start, index + 1)
    }
  }

  return trimmed.slice(start)
}

const responseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string', nullable: true },
    excerpt: { type: 'string' },
    body: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    seoDescription: { type: 'string' },
  },
  required: ['title', 'excerpt', 'body', 'category', 'tags', 'seoDescription'],
}

async function inlineImage(src: string | null): Promise<{ mimeType: string; data: string } | null> {
  if (!src) return null
  try {
    if (/^https?:\/\//.test(src)) {
      const response = await fetch(src)
      if (!response.ok) return null
      const buffer = Buffer.from(await response.arrayBuffer())
      const mimeType = (response.headers.get('content-type') ?? 'image/webp').split(';')[0]
      if (!mimeType.startsWith('image/')) return null
      return { mimeType, data: buffer.toString('base64') }
    }
    const path = join(getConfig().UPLOAD_DIR, basename(src))
    const file = Bun.file(path)
    if (!(await file.exists())) return null
    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = path.split('.').pop()?.toLowerCase()
    const mimeType =
      extension === 'avif'
        ? 'image/avif'
        : extension === 'png'
          ? 'image/png'
          : extension === 'jpg' || extension === 'jpeg'
            ? 'image/jpeg'
            : 'image/webp'
    return { mimeType, data: buffer.toString('base64') }
  } catch {
    return null
  }
}

function buildPrompt(context: GeminiContext): string {
  const categories = context.categories.length
    ? context.categories.map((category) => `- ${category.slug} — ${category.name}: ${category.description}`).join('\n')
    : '- (no categories configured)'
  const tags = context.tags.length
    ? context.tags.map((tag) => `- ${tag.slug} — ${tag.name}`).join('\n')
    : '- (no tags configured)'

  const source = context.hasActivity
    ? `Write from the following personal activity. Use only details that are present here or visible in the attached image. Do not invent names, dates, places, or events.\n\nActivity note:\n${context.activityText || '(no written note — use the attached image)'}`
    : `No new personal activity was provided. Write from this editorial initiative brief instead:\n${context.initiativeBrief}`

  const recent = context.recentTitles?.length
    ? `\nRecent pieces — do not repeat their subjects, arguments, or title patterns. Choose a clearly different angle:\n${context.recentTitles.map((title) => `- ${title}`).join('\n')}\n`
    : ''

  return `You are the editor of RhandytaVERSE, an independent publication of reflective essays about technology, design, science, culture, work, attention, and ordinary life.

Write one complete, publishable essay in ${context.language}.

Author voice: ${context.authorName}${context.authorRole ? `, ${context.authorRole}` : ''}. ${context.authorBio}

${source}
${recent}
Available sections (choose exactly one slug):
${categories}

Available tags (choose 1–4 slugs):
${tags}

Editorial requirements:
- Choose a concrete subject from the activity or the editorial brief. Do not write about RhandytaVERSE itself, this publication, the archive, the act of writing, or being an editor unless the input explicitly asks for it.
- 800–1000 words, specific and observant, first person where it feels natural.
- Begin with a concrete detail or scene, not a definition or a summary.
- Use Markdown: short paragraphs, several "## " section headings, occasional lists or blockquotes. Do not include a top-level title heading, images, external links, or HTML.
- The title must be 45–60 characters so it fits search results without being truncated. Prefer a concrete, specific phrase over a colon-stacked subtitle. Never exceed 60 characters.
- No clickbait, no motivational clichés, no bullet-point-only essays, no mention of AI, prompts, automation, or this instruction. Avoid repetitive title formulas and starting every title with the same word.
- Do not invent personal facts that are not supported by the activity note or image. If the material is thin, stay reflective and general rather than fabricating specifics.
- The "tags" array must contain only slugs copied exactly from the available tags list above, untranslated. If none fit, return an empty array.
- The tone is calm, precise, and human. Avoid em dashes used as a tic; vary sentence length.

Return ONLY a JSON object with these keys:
{
  "title": "headline, 45-60 characters, never longer than 60",
  "subtitle": "one sentence or null",
  "excerpt": "one or two sentences for listings, max 300 characters",
  "body": "Markdown essay body",
  "category": "one section slug from the list",
  "tags": ["tag-slug"],
  "seoDescription": "search description, 120-155 characters, no line breaks"
}`
}

export async function generateDraft(context: GeminiContext, model?: string): Promise<GeminiDraft> {
  const apiKey = getConfig().GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const image = await inlineImage(context.imageSrc)
  const prompt = buildPrompt(context)
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (image) parts.push({ inlineData: image })

  const modelName = geminiModel(model)
  const generationConfig: Record<string, unknown> = {
    temperature: 0.85,
    maxOutputTokens: 16384,
    responseMimeType: 'application/json',
    responseSchema,
  }
  if (modelName.includes('2.5') && modelName.includes('flash')) {
    // Flash uses a thinking budget by default; it can consume the output
    // allowance and leave the JSON truncated. Structured output does not need it.
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string }
        candidates?: Array<{
          finishReason?: string
          content?: { parts?: Array<{ text?: string }> }
        }>
      }
    | null

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed with status ${response.status}`)
  }

  const text =
    payload?.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('') ?? ''
  const finishReason = payload?.candidates?.[0]?.finishReason

  if (!text.trim()) throw new Error('Gemini returned an empty response')
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini response was truncated before the JSON was complete')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch {
    const snippet = text.slice(0, 240).replace(/\s+/g, ' ')
    throw new Error(
      `Gemini returned invalid JSON (${text.length} chars${finishReason ? `, finish ${finishReason}` : ''}): ${snippet}`,
    )
  }

  const result = draftSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Gemini response did not match the expected format: ${result.error.issues[0]?.message ?? 'invalid'}`)
  }

  return {
    title: result.data.title,
    subtitle: result.data.subtitle?.trim() || null,
    excerpt: result.data.excerpt?.trim() || '',
    body: result.data.body,
    category: result.data.category?.trim() || null,
    tags: result.data.tags?.map((tag) => tag.trim()).filter(Boolean).slice(0, 4) ?? [],
    seoDescription: result.data.seoDescription?.trim() || null,
  }
}
