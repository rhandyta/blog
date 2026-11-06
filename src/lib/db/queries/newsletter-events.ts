import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../client'
import { newsletterEvents, subscribers } from '../schema'

export type ResendWebhookEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[]
    subject?: string
  }
}

export async function recordNewsletterEvent(input: {
  id: string
  event: ResendWebhookEvent
  payload: string
}): Promise<boolean> {
  const type = input.event.type ?? 'unknown'
  const email = input.event.data?.to?.[0]?.trim().toLowerCase() || null
  const emailId = input.event.data?.email_id ?? null
  const subject = input.event.data?.subject ?? null
  const createdAt = input.event.created_at ?? new Date().toISOString()
  const inserted = await getDb()
    .insert(newsletterEvents)
    .values({
      id: input.id,
      type,
      email,
      emailId,
      subject,
      payload: input.payload,
      createdAt,
      processedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: newsletterEvents.id })
    .returning({ id: newsletterEvents.id })
  if (!inserted.length) return false

  if (email && (type === 'email.bounced' || type === 'email.complained')) {
    await getDb()
      .update(subscribers)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        suppressionReason: type === 'email.complained' ? 'complained' : 'bounced',
        confirmationToken: null,
        confirmationSentAt: null,
      })
      .where(and(eq(subscribers.email, email), eq(subscribers.status, 'subscribed')))
  }
  return true
}

export async function listNewsletterEvents(limit = 12) {
  return getDb()
    .select()
    .from(newsletterEvents)
    .orderBy(desc(newsletterEvents.createdAt))
    .limit(limit)
}
