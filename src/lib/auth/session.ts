import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { sessions, users, type Session, type User } from '../db/schema'

export const SESSION_COOKIE = 'sid'
export const SESSION_TTL_DAYS = 30

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash)
  } catch {
    return false
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function ipHash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; session: Session }> {
  const token = randomBytes(32).toString('base64url')
  const id = hashToken(token)
  const csrfToken = randomBytes(24).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString()
  const session: Session = {
    id,
    userId,
    csrfToken,
    expiresAt,
    createdAt: now.toISOString(),
    userAgent: meta.userAgent ?? null,
    ipHash: meta.ip ? ipHash(meta.ip) : null,
  }
  await getDb().insert(sessions).values(session)
  return { token, session }
}

export async function getSessionUser(token: string | undefined | null): Promise<{ session: Session; user: User } | null> {
  if (!token) return null
  const id = hashToken(token)
  const rows = await getDb()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1)
  const row = rows[0]
  if (!row || !row.user.active) return null

  const daysLeft = (new Date(row.session.expiresAt).getTime() - Date.now()) / 86_400_000
  if (daysLeft < 15) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString()
    await getDb().update(sessions).set({ expiresAt }).where(eq(sessions.id, id))
    row.session.expiresAt = expiresAt
  }
  return row
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)))
}

export async function destroyUserSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
}

export async function purgeExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()))
}

export async function touchLogin(userId: string): Promise<void> {
  const now = new Date().toISOString()
  await getDb().update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, userId))
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const rows = await getDb().select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return rows[0]
}

export async function getUserById(id: string): Promise<User | undefined> {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0]
}

export async function createUser(input: {
  id: string
  email: string
  password: string
  name: string
  role: 'admin' | 'editor' | 'author'
}): Promise<User> {
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(input.password)
  await getDb().insert(users).values({
    id: input.id,
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: input.role,
    active: true,
    createdAt: now,
    updatedAt: now,
  })
  const created = await getUserById(input.id)
  if (!created) throw new Error('Failed to create user')
  return created
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password)
  await getDb()
    .update(users)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
}

export function csrfMatches(expected: string, provided: string | undefined | null): boolean {
  if (!provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function signValue(value: string, expiresAt: number): string {
  const secret = process.env.SESSION_SECRET ?? 'dev-only-secret'
  const payload = `${value}.${expiresAt}`
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

export function verifySignedValue(token: string, expectedValue: string): boolean {
  const [payloadPart, signature] = token.split('.')
  if (!payloadPart || !signature) return false
  let payload: string
  try {
    payload = Buffer.from(payloadPart, 'base64url').toString('utf8')
  } catch {
    return false
  }
  const secret = process.env.SESSION_SECRET ?? 'dev-only-secret'
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const [value, expires] = payload.split('.')
  const expiry = Number(expires)
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false
  return value === expectedValue
}

export async function sessionCount(): Promise<number> {
  const rows = await getDb().select({ n: sql<number>`count(*)` }).from(sessions)
  return rows[0]?.n ?? 0
}
