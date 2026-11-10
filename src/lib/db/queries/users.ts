import { and, asc, count, desc, eq, gt, ne } from 'drizzle-orm'
import { getDb } from '../client'
import { authors, sessions, users, type Session, type User } from '../schema'

export type UserSummary = {
  id: string
  email: string
  name: string
  role: User['role']
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  sessionCount: number
  authorId: string | null
  authorName: string | null
  authorSlug: string | null
}

export type UserSessionSummary = Pick<Session, 'id' | 'createdAt' | 'expiresAt' | 'userAgent' | 'ipHash'>

const ROLE_ORDER: Record<User['role'], number> = { admin: 0, editor: 1, author: 2 }

export async function listUsers(): Promise<UserSummary[]> {
  const db = getDb()
  const now = new Date().toISOString()
  const [userRows, authorRows, sessionCounts] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db
      .select({
        id: authors.id,
        userId: authors.userId,
        displayName: authors.displayName,
        slug: authors.slug,
      })
      .from(authors),
    db
      .select({ userId: sessions.userId, n: count() })
      .from(sessions)
      .where(gt(sessions.expiresAt, now))
      .groupBy(sessions.userId),
  ])

  const authorByUserId = new Map<string, { id: string; displayName: string; slug: string }>()
  for (const author of authorRows) {
    if (author.userId && !authorByUserId.has(author.userId)) {
      authorByUserId.set(author.userId, {
        id: author.id,
        displayName: author.displayName,
        slug: author.slug,
      })
    }
  }
  const sessionsByUserId = new Map<string, number>(sessionCounts.map((row) => [row.userId, row.n]))

  return userRows
    .map((user) => {
      const author = authorByUserId.get(user.id) ?? null
      return {
        ...user,
        sessionCount: sessionsByUserId.get(user.id) ?? 0,
        authorId: author?.id ?? null,
        authorName: author?.displayName ?? null,
        authorSlug: author?.slug ?? null,
      }
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.localeCompare(b.createdAt))
}

export async function countActiveAdmins(): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.active, true)))
  return rows[0]?.n ?? 0
}

export async function updateUserProfile(userId: string, input: { name: string }): Promise<void> {
  await getDb()
    .update(users)
    .set({ name: input.name.trim(), updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
}

/**
 * Stores the interface language on the account so the choice follows the user
 * to other browsers. Only validated locale codes are ever written.
 */
export async function updateUserLocale(userId: string, locale: 'id' | 'en'): Promise<void> {
  await getDb().update(users).set({ locale, updatedAt: new Date().toISOString() }).where(eq(users.id, userId))
}

export async function updateUserByAdmin(
  userId: string,
  input: {
    name: string
    email: string
    role: User['role']
    active: boolean
  },
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      active: input.active,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
}

export async function listUserSessions(userId: string): Promise<UserSessionSummary[]> {
  const now = new Date().toISOString()
  return getDb()
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
      ipHash: sessions.ipHash,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.createdAt))
}

export async function revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id })
  return removed.length > 0
}

export async function revokeOtherUserSessions(userId: string, currentSessionId: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
}
