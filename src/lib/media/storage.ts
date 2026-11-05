import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { getConfig } from '../config'
import type { MediaVariants } from '../content/doc'
import { createMedia } from '../db/queries/media'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const UPLOAD_WIDTHS = [480, 960, 1600]

export type StoredImage = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  alt: string
  caption: string | null
  dominantColor: string
  src: string
  variants: MediaVariants
  uploadedBy: string | null
  createdAt: string
}

export function uploadDir(): string {
  const dir = getConfig().UPLOAD_DIR
  mkdirSync(dir, { recursive: true })
  return dir
}

export function publicUploadUrl(filename: string): string {
  return `/uploads/${filename}`
}

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'svg'

export function sniffImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  const head = buffer.subarray(0, 6).toString('ascii')
  if (head === 'GIF87a' || head === 'GIF89a') return 'gif'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand.startsWith('avif') || brand.startsWith('avis') || brand === 'mif1') return 'avif'
  }
  const text = buffer.subarray(0, Math.min(buffer.length, 400)).toString('utf8').trimStart()
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return 'svg'
  return null
}

function averageColor(stats: sharp.Stats): string {
  const channels = stats.channels.slice(0, 3)
  const hex = channels
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel.mean))).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

export async function storeImage(
  buffer: Buffer,
  options: {
    originalName: string
    alt?: string
    caption?: string | null
    uploadedBy?: string | null
    allowSvg?: boolean
    id?: string
  },
): Promise<StoredImage> {
  const kind = sniffImage(buffer)
  if (!kind) throw new Error('Unsupported file type')
  if (kind === 'svg' && !options.allowSvg) throw new Error('SVG uploads are not permitted')

  const pipeline = sharp(buffer, { limitInputPixels: 60_000_000 }).rotate()
  const metadata = await pipeline.metadata()
  const originalWidth = metadata.width ?? 0
  const originalHeight = metadata.height ?? 0
  if (!originalWidth || !originalHeight) throw new Error('Could not read image dimensions')
  if (originalWidth > 12000 || originalHeight > 12000) throw new Error('Image dimensions are too large')

  const id = options.id ?? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  const dir = uploadDir()
  const widths = UPLOAD_WIDTHS.filter((width) => width < originalWidth)
  if (!widths.length) widths.push(Math.min(originalWidth, 1600))
  const rendered = [...widths, Math.min(originalWidth, 1600)]
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort((a, b) => a - b)

  const webp: MediaVariants['webp'] = []
  const avif: MediaVariants['avif'] = []

  for (const width of rendered) {
    const base = sharp(buffer, { limitInputPixels: 60_000_000 }).rotate().resize({
      width,
      withoutEnlargement: true,
    })

    const webpName = `${id}-${width}.webp`
    const webpBuffer = await base.clone().webp({ quality: 82, effort: 4 }).toBuffer()
    await Bun.write(join(dir, webpName), webpBuffer)
    webp.push({ w: width, src: publicUploadUrl(webpName) })

    try {
      const avifName = `${id}-${width}.avif`
      const avifBuffer = await base.clone().avif({ quality: 52, effort: 3 }).toBuffer()
      await Bun.write(join(dir, avifName), avifBuffer)
      avif.push({ w: width, src: publicUploadUrl(avifName) })
    } catch {
      // AVIF encoding is optional; WebP remains the fallback.
    }
  }

  const stats = await sharp(buffer, { limitInputPixels: 60_000_000 }).stats()
  const largest = rendered[rendered.length - 1]
  const masterName = `${id}-${largest}.webp`
  const masterPath = join(dir, masterName)
  const size = (await Bun.file(masterPath).stat()).size
  const processed = await sharp(masterPath).metadata()
  const displayWidth = processed.width ?? Math.min(originalWidth, largest)
  const displayHeight = processed.height ?? Math.round((originalHeight / originalWidth) * displayWidth)

  const ogName = `${id}-og.jpg`
  let ogSrc: string | undefined
  try {
    const ogBuffer = await sharp(buffer, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    await Bun.write(join(dir, ogName), ogBuffer)
    ogSrc = publicUploadUrl(ogName)
  } catch {
    // The Open Graph crop is optional.
  }

  return {
    id,
    filename: masterName,
    originalName: options.originalName,
    mimeType: 'image/webp',
    byteSize: size,
    width: displayWidth,
    height: displayHeight,
    alt: options.alt ?? '',
    caption: options.caption ?? null,
    dominantColor: averageColor(stats),
    src: publicUploadUrl(masterName),
    variants: { webp, avif, ...(ogSrc ? { og: ogSrc } : {}) },
    uploadedBy: options.uploadedBy ?? null,
    createdAt: new Date().toISOString(),
  }
}

export async function persistStoredImage(image: StoredImage) {
  return createMedia(image)
}

export async function saveUpload(
  buffer: Buffer,
  options: { originalName: string; alt?: string; caption?: string | null; uploadedBy: string | null; allowSvg?: boolean },
) {
  const stored = await storeImage(buffer, options)
  return persistStoredImage(stored)
}

export function deleteStoredFiles(asset: { variants: string }): void {
  const dir = uploadDir()
  try {
    const parsed = JSON.parse(asset.variants) as MediaVariants
    const filenames = new Set<string>()
    for (const variant of [...(parsed.webp ?? []), ...(parsed.avif ?? [])]) {
      filenames.add(variant.src.split('/').pop() ?? '')
    }
    if (parsed.og) filenames.add(parsed.og.split('/').pop() ?? '')
    for (const filename of filenames) {
      if (/^[a-zA-Z0-9_-]+\.(webp|avif|jpg)$/.test(filename)) {
        try {
          rmSync(join(dir, filename))
        } catch {
          // Missing files are safe to ignore.
        }
      }
    }
  } catch {
    // ignore malformed metadata
  }
}
