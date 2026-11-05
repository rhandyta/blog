import { signValue, verifySignedValue } from '../auth/session'

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000

export function createPreviewToken(articleId: string): string {
  return signValue(articleId, Date.now() + PREVIEW_TTL_MS)
}

export function verifyPreviewToken(articleId: string, token: string | undefined | null): boolean {
  if (!token) return false
  try {
    return verifySignedValue(token, articleId)
  } catch {
    return false
  }
}
