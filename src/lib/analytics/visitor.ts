import { createHmac } from 'node:crypto'
import { getConfig } from '../config'

export type VisitContext = {
  visitorHash: string
  day: string
  bucket: string
  referrerHost: string | null
  country: string | null
  device: string
  browser: string
  os: string
}

export function anonymizeIp(ip: string): string {
  const value = ip.trim().replace(/^\[|\]$/g, '')
  if (!value) return 'unknown'
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value)
  if (mapped) return anonymizeIp(mapped[1])
  if (value.includes(':')) {
    const parts = value.split(':').slice(0, 4)
    return `${parts.join(':') || '0'}::`
  }
  const parts = value.split('.')
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  return 'unknown'
}

export function hashVisitor(ip: string, userAgent: string): string {
  const secret = getConfig().SESSION_SECRET
  return createHmac('sha256', `analytics:${secret}`)
    .update(`${anonymizeIp(ip)}|${userAgent.slice(0, 512)}`)
    .digest('hex')
    .slice(0, 32)
}

export function parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  const ua = userAgent || ''
  const device = /iPad|Tablet|PlayBook|Silk/i.test(ua)
    ? 'tablet'
    : /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)
      ? 'mobile'
      : ua
        ? 'desktop'
        : 'unknown'
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /SamsungBrowser/i.test(ua)
        ? 'Samsung Internet'
        : /Chrome\//i.test(ua)
          ? 'Chrome'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : /Safari\//i.test(ua)
              ? 'Safari'
              : 'Other'
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Other'
  return { device, browser, os }
}

export function normalizeReferrer(referrer: string | null | undefined, origin: string): string | null {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    const self = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
    if (!host || host === self) return null
    return host.slice(0, 120)
  } catch {
    return null
  }
}

export function normalizeCountry(value: string | null | undefined): string | null {
  const country = value?.trim().toUpperCase()
  return country && /^[A-Z]{2}$/.test(country) ? country : null
}

export function buildVisitContext(input: {
  ip: string
  userAgent: string | null
  referer: string | null
  country: string | null
  origin: string
  now?: Date
}): VisitContext {
  const now = input.now ?? new Date()
  const userAgent = input.userAgent ?? ''
  const parsed = parseUserAgent(userAgent)
  const iso = now.toISOString()
  return {
    visitorHash: hashVisitor(input.ip, userAgent),
    day: iso.slice(0, 10),
    bucket: iso.slice(0, 13),
    referrerHost: normalizeReferrer(input.referer, input.origin),
    country: normalizeCountry(input.country),
    ...parsed,
  }
}
