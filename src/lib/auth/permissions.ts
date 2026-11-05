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

export function roleLabel(role: string): string {
  if (role === 'admin') return 'Administrator'
  if (role === 'editor') return 'Editor'
  return 'Author'
}
