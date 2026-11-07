import sharp from 'sharp'
import { coverSvg } from './cover'

export function articleSeed(slug: string): number {
  let hash = 0
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % 100_000
}

export function fallbackOgPath(slug: string, accentHex: string): string {
  const hex = accentHex.replace('#', '').toLowerCase()
  return `/og/${articleSeed(slug)}/${/^[0-9a-f]{6}$/.test(hex) ? hex : 'c8452b'}.jpg`
}

const cache = new Map<string, Buffer>()
const CACHE_LIMIT = 64
const RENDER_BUDGET = 120
const budgetWindowMs = 60_000
let windowStartedAt = 0
let rendersInWindow = 0

function takeRenderBudget(now = Date.now()): boolean {
  if (now - windowStartedAt >= budgetWindowMs) {
    windowStartedAt = now
    rendersInWindow = 0
  }
  if (rendersInWindow >= RENDER_BUDGET) return false
  rendersInWindow += 1
  return true
}

/**
 * Renders the procedural cover composition into a 1200×630 Open Graph card.
 * Deliberately text-free: no font dependencies are available at request time.
 * Returns null when the burst budget is exhausted and the card is not cached.
 */
export async function renderFallbackOg(seed: number, accentHex: string): Promise<Buffer | null> {
  const key = `${seed}:${accentHex}`
  const cached = cache.get(key)
  if (cached) return cached
  if (!takeRenderBudget()) return null
  const svg = coverSvg(seed, accentHex)
  const jpeg = await sharp(Buffer.from(svg), { limitInputPixels: 40_000_000 })
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, jpeg)
  return jpeg
}

export function parseOgParams(seed: string, accent: string): { seed: number; accent: string } | null {
  const value = Number(seed)
  if (!Number.isInteger(value) || value < 0 || value > 999_999) return null
  const hex = accent.replace(/\.jpg$/i, '').toLowerCase()
  if (!/^[0-9a-f]{6}$/.test(hex)) return null
  return { seed: value, accent: `#${hex}` }
}
