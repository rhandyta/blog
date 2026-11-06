import { describe, expect, test } from 'bun:test'
import { run } from '../src/lib/db/client'
import { recordNewsletterEvent } from '../src/lib/db/queries/newsletter-events'
import {
  confirmSubscriber,
  csvCell,
  deleteSubscriberById,
  getSubscriberByEmail,
  issueConfirmation,
  listSubscribers,
  subscribeEmail,
  unsubscribeByToken,
} from '../src/lib/db/queries/subscribers'

describe('subscriber CSV export', () => {
  test('quotes ordinary values', () => {
    expect(csvCell('reader@example.com')).toBe('"reader@example.com"')
  })

  test('escapes embedded quotes', () => {
    expect(csvCell('a"b@example.com')).toBe('"a""b@example.com"')
  })

  test('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=cmd@example.com')).toBe("\"'=cmd@example.com\"")
    expect(csvCell('+cmd@example.com')).toBe("\"'+cmd@example.com\"")
    expect(csvCell('-cmd@example.com')).toBe("\"'-cmd@example.com\"")
    expect(csvCell('@cmd@example.com')).toBe("\"'@cmd@example.com\"")
  })
})

describe('double opt-in', () => {
  test('holds a pending subscriber until the token is confirmed, then unsubscribes', async () => {
    const email = 'double-opt-in@example.com'
    try {
      const outcome = await subscribeEmail(email, {
        requireConfirmation: true,
        ip: '203.0.113.9',
        source: 'test',
      })
      expect(outcome.result).toBe('pending')
      if (outcome.result !== 'pending') return

      const pending = (await listSubscribers({ q: email })).items[0]
      expect(pending?.confirmedAt).toBeNull()
      expect(pending?.ipHash).toMatch(/^[a-f0-9]{32}$/)
      expect(pending?.confirmationToken).toBe(outcome.token)

      expect(await confirmSubscriber(outcome.token)).toBe(email)
      const confirmed = (await listSubscribers({ q: email })).items[0]
      expect(confirmed?.confirmedAt).toBeTruthy()
      expect(confirmed?.confirmationToken).toBeNull()

      expect(await unsubscribeByToken(confirmed?.unsubscribeToken ?? '')).toBe(email)
      const unsubscribed = (await listSubscribers({ q: email })).items[0]
      expect(unsubscribed?.status).toBe('unsubscribed')
    } finally {
      await run('DELETE FROM subscribers WHERE email = ?', [email])
    }
  })

  test('can resend a confirmation and delete the subscriber', async () => {
    const email = 'resend-delete@example.com'
    try {
      const outcome = await subscribeEmail(email, { requireConfirmation: true })
      if (outcome.result !== 'pending') throw new Error('expected pending')
      const subscriber = await getSubscriberByEmail(email)
      expect(subscriber).toBeTruthy()
      const issued = await issueConfirmation(subscriber!.id)
      expect(issued?.token).toBeTruthy()
      expect(issued?.token).not.toBe(subscriber?.confirmationToken)
      expect(await deleteSubscriberById(subscriber!.id)).toBe(true)
      expect(await getSubscriberByEmail(email)).toBeUndefined()
    } finally {
      await run('DELETE FROM subscribers WHERE email = ?', [email])
    }
  })

  test('suppresses a subscriber after a Resend bounce', async () => {
    const email = 'bounce-test@example.com'
    const eventId = 'evt_bounce_test'
    try {
      await subscribeEmail(email, { requireConfirmation: true })
      const pending = await getSubscriberByEmail(email)
      await confirmSubscriber(pending?.confirmationToken ?? '')
      const inserted = await recordNewsletterEvent({
        id: eventId,
        payload: JSON.stringify({ type: 'email.bounced' }),
        event: {
          type: 'email.bounced',
          data: { to: [email], email_id: 'email_test', subject: 'Test' },
        },
      })
      expect(inserted).toBe(true)
      const suppressed = await getSubscriberByEmail(email)
      expect(suppressed?.status).toBe('unsubscribed')
      expect(suppressed?.suppressionReason).toBe('bounced')
    } finally {
      await run('DELETE FROM newsletter_events WHERE id = ?', [eventId])
      await run('DELETE FROM subscribers WHERE email = ?', [email])
    }
  })
})
