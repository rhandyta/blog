import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyResendWebhook(input: {
  id: string | null
  timestamp: string | null
  signature: string | null
  payload: string
  secret: string
  toleranceSeconds?: number
}): boolean {
  if (!input.id || !input.timestamp || !input.signature || !input.secret) return false
  const timestamp = Number(input.timestamp)
  if (!Number.isFinite(timestamp)) return false
  const tolerance = (input.toleranceSeconds ?? 300) * 1000
  if (Math.abs(Date.now() - timestamp * 1000) > tolerance) return false

  const key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key)
    .update(`${input.id}.${input.timestamp}.${input.payload}`)
    .digest('base64')

  for (const part of input.signature.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    const actual = Buffer.from(value, 'base64')
    const wanted = Buffer.from(expected, 'base64')
    if (actual.length === wanted.length && timingSafeEqual(actual, wanted)) return true
  }
  return false
}
