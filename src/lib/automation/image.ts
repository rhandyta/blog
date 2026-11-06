import { getConfig } from '../config'

export type ImageProvider = 'gemini' | 'cloudflare'

export type GeneratedCover = {
  buffer: Buffer
  mimeType: string
  prompt: string
}

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'

export function resolveImageModel(provider: ImageProvider, preferred: string): string {
  if (provider === 'cloudflare') {
    return preferred.startsWith('@cf/') ? preferred : CLOUDFLARE_IMAGE_MODEL
  }
  return preferred.startsWith('@cf/') || !preferred ? GEMINI_IMAGE_MODEL : preferred
}

export function hasImageGenerationKey(provider: ImageProvider): boolean {
  const config = getConfig()
  if (provider === 'cloudflare') {
    return Boolean(config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_API_TOKEN)
  }
  return Boolean(config.GEMINI_API_KEY)
}

function buildCoverPrompt(context: {
  title: string
  excerpt: string
  categoryName: string | null
  categoryDescription: string | null
  accentHex: string
  language: string
}): string {
  return `Create an abstract editorial cover image for an essay titled "${context.title}".

Editorial context: ${context.excerpt || context.title}
Section: ${context.categoryName ?? 'Essay'}${context.categoryDescription ? ` — ${context.categoryDescription}` : ''}
Language of the publication: ${context.language}.

Visual direction:
- Print-inspired editorial art, not a photograph and not a generic tech illustration.
- Warm paper background (#f2ede2), near-black ink (#17140f), one strong accent colour (${context.accentHex}).
- Geometric or still-life composition with generous negative space and a clear focal point.
- Calm, intelligent, literary, suitable for a long-form essay.
- Wide 16:10 composition that still reads well when cropped to a square or a 1200x630 social card.
- Absolutely no text, letters, numbers, logos, watermarks, signatures, UI elements, or recognisable people.
- No gradients-as-decoration, no neon, no glossy 3D, no stock-photo look.

Return only the image.`
}

async function generateGeminiCover(
  prompt: string,
  model: string,
): Promise<GeneratedCover> {
  const apiKey = getConfig().GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  )

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string }
        candidates?: Array<{
          finishReason?: string
          content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }
        }>
      }
    | null

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini image request failed with status ${response.status}`)
  }

  const parts = payload?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((part) => part.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    const finishReason = payload?.candidates?.[0]?.finishReason
    throw new Error(`Gemini image model returned no image${finishReason ? ` (finish ${finishReason})` : ''}`)
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    prompt,
  }
}

async function generateCloudflareCover(prompt: string, model: string): Promise<GeneratedCover> {
  const config = getConfig()
  if (!config.CLOUDFLARE_ACCOUNT_ID || !config.CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare Workers AI is not configured')
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.CLOUDFLARE_ACCOUNT_ID)}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(90_000),
    },
  )

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Cloudflare image request failed (${response.status}): ${text.slice(0, 300)}`)
  }

  if (contentType.startsWith('image/')) {
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: contentType.split(';')[0],
      prompt,
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        result?: { image?: string; data?: string; mimeType?: string } | string
        image?: string
        data?: string
        mimeType?: string
      }
    | null

  const result = payload?.result
  const base64 =
    (typeof result === 'string' ? result : result?.image ?? result?.data) ??
    payload?.image ??
    payload?.data

  if (!base64) throw new Error('Cloudflare image model returned no image')

  const mimeType =
    (typeof result === 'object' ? result?.mimeType : undefined) ??
    payload?.mimeType ??
    'image/jpeg'

  return { buffer: Buffer.from(base64, 'base64'), mimeType, prompt }
}

export async function generateCoverImage(context: {
  provider: ImageProvider
  title: string
  excerpt: string
  categoryName: string | null
  categoryDescription: string | null
  accentHex: string
  language: string
  model: string
}): Promise<GeneratedCover> {
  const prompt = buildCoverPrompt(context)
  const model = resolveImageModel(context.provider, context.model)
  return context.provider === 'cloudflare'
    ? generateCloudflareCover(prompt, model)
    : generateGeminiCover(prompt, model)
}
