import { describe, expect, test, beforeEach } from 'bun:test'
import {
  canEditArticle,
  canManageContent,
  canManageSettings,
  canManageUsers,
  isAdmin,
  roleKey,
} from '../src/lib/auth/permissions'
import { rateLimit, resetRateLimits } from '../src/lib/auth/rate-limit'
import { csrfMatches, hashToken, signValue, verifySignedValue } from '../src/lib/auth/session'
import { createPreviewToken, verifyPreviewToken } from '../src/lib/seo/preview-token'
import type { User } from '../src/lib/db/schema'

const admin: User = {
  id: 'u_admin',
  email: 'admin@example.com',
  passwordHash: 'x',
  name: 'Admin',
  role: 'admin',
  active: true,
  locale: null,
  createdAt: '',
  updatedAt: '',
  lastLoginAt: null,
}
const editor: User = { ...admin, id: 'u_editor', role: 'editor' }
const author: User = { ...admin, id: 'u_author', role: 'author' }

describe('permissions', () => {
  test('roles map to capabilities', () => {
    expect(isAdmin(admin)).toBe(true)
    expect(canManageContent(editor)).toBe(true)
    expect(canManageContent(author)).toBe(false)
    expect(canManageUsers(editor)).toBe(false)
    expect(canManageSettings(admin)).toBe(true)
    expect(roleKey('author')).toBe('admin.roleAuthor')
  })

  test('authors may only edit their own articles', () => {
    const own = { authorId: 'author_own' }
    const other = { authorId: 'author_other' }
    expect(canEditArticle(author, own, 'author_own')).toBe(true)
    expect(canEditArticle(author, other, 'author_own')).toBe(false)
    expect(canEditArticle(editor, other, null)).toBe(true)
    expect(canEditArticle(null, own, 'author_own')).toBe(false)
  })
})

describe('rate limiting', () => {
  beforeEach(async () => {
    await resetRateLimits()
  })

  test('allows up to the limit then blocks until the window expires', async () => {
    const key = `test:${Math.random()}`
    expect((await rateLimit(key, 2, 1000)).allowed).toBe(true)
    expect((await rateLimit(key, 2, 1000)).allowed).toBe(true)
    const blocked = await rateLimit(key, 2, 1000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('tokens', () => {
  test('session identifiers are hashed, not stored raw', () => {
    const token = 'a-raw-token'
    expect(hashToken(token)).not.toBe(token)
    expect(hashToken(token)).toHaveLength(64)
  })

  test('signed values verify and tampering fails', () => {
    const token = signValue('article_1', Date.now() + 60_000)
    expect(verifySignedValue(token, 'article_1')).toBe(true)
    expect(verifySignedValue(token, 'article_2')).toBe(false)
    expect(verifySignedValue(`${token}x`, 'article_1')).toBe(false)
    const expired = signValue('article_1', Date.now() - 10)
    expect(verifySignedValue(expired, 'article_1')).toBe(false)
  })

  test('preview tokens are scoped to an article', () => {
    const token = createPreviewToken('art_1')
    expect(verifyPreviewToken('art_1', token)).toBe(true)
    expect(verifyPreviewToken('art_2', token)).toBe(false)
    expect(verifyPreviewToken('art_1', null)).toBe(false)
  })

  test('CSRF comparison is length-safe', () => {
    expect(csrfMatches('abc', 'abc')).toBe(true)
    expect(csrfMatches('abc', 'abd')).toBe(false)
    expect(csrfMatches('abc', 'ab')).toBe(false)
    expect(csrfMatches('abc', undefined)).toBe(false)
  })
})
