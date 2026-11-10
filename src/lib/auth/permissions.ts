import type { User } from '../db/schema'

export type Role = User['role']

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'admin'
}

export function canManageContent(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'editor'
}

export function canEditArticle(
  user: User | null | undefined,
  article: { authorId: string } | null,
  ownAuthorId?: string | null,
): boolean {
  if (!user || !article) return false
  if (canManageContent(user)) return true
  return Boolean(ownAuthorId && article.authorId === ownAuthorId)
}

export function canManageUsers(user: User | null | undefined): boolean {
  return isAdmin(user)
}

export function canManageSettings(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'editor'
}

export function canManageMedia(user: User | null | undefined): boolean {
  return canManageContent(user)
}

export function canEditMediaAsset(user: User | null | undefined, asset: { uploadedBy: string | null } | null): boolean {
  if (!user || !asset) return false
  if (canManageMedia(user)) return true
  return Boolean(asset.uploadedBy && asset.uploadedBy === user.id)
}

/**
 * Translation key for a role label. The desk is bilingual, so callers pass the
 * key through the translator instead of rendering an English literal.
 */
export function roleKey(role: string): 'admin.roleAdmin' | 'admin.roleEditor' | 'admin.roleAuthor' {
  if (role === 'admin') return 'admin.roleAdmin'
  if (role === 'editor') return 'admin.roleEditor'
  return 'admin.roleAuthor'
}
